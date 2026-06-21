#!/usr/bin/env node

import { readFileSync, realpathSync } from "node:fs";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { checkCollectorToken, fetchStatusData, registerCollector } from "./api.js";
import { getConfigMode, getConfigPath, readConfig, writeConfig } from "./config.js";
import { formatStatus } from "./format.js";
import { previewPayload } from "./privacy.js";
import type { SignalSource } from "./types.js";

const DEFAULT_BASE_URL = "https://notjustyou.dev";
const WATCH_INTERVAL_MS = 2_000;
const DEFAULT_SOURCE = "api_middleware";
const DEFAULT_SERVICE_ID = "openai-api";
const CLIENT_NAME = "notjustyou-cli";
const CLIENT_VERSION = "0.1.0";
const SIGNAL_SOURCES = new Set([
  "api_middleware",
  "cli_hook",
  "ide_extension",
  "browser_extension",
  "mcp_monitor",
  "local_probe",
]);
const SERVICE_IDS = new Set([
  "anthropic-claude-code",
  "anthropic-claude-ai",
  "anthropic-claude-cowork",
  "anthropic-claude-api",
  "openai-codex-cli",
  "openai-codex-app",
  "openai-chatgpt",
  "openai-api",
  "google-antigravity-cli",
  "google-antigravity",
  "google-antigravity-ide",
  "google-gemini-web",
  "google-gemini-api",
  "cursor-ide",
  "cursor-cli",
]);

export async function main(argv = process.argv.slice(2)) {
  const parsed = parseCliArgs(argv);

  if (parsed.command === "help") {
    printUsage();
    return 0;
  }

  if (parsed.command === "status") {
    await runStatus({
      baseUrl: parsed.baseUrl,
      serviceId: parsed.serviceId,
      watch: parsed.watch,
    });

    return 0;
  }

  if (parsed.command === "setup") {
    await runSetup(parsed);
    return 0;
  }

  if (parsed.command === "register") {
    await runRegister(parsed);
    return 0;
  }

  if (parsed.command === "doctor") {
    return runDoctor(parsed);
  }

  if (parsed.command === "payload-preview") {
    return runPayloadPreview(parsed);
  }

  printUsage();
  return 1;
}

export function parseCliArgs(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      "base-url": {
        type: "string",
      },
      source: {
        type: "string",
      },
      service: {
        type: "string",
      },
      fixture: {
        type: "string",
      },
      watch: {
        type: "boolean",
        default: false,
      },
      help: {
        type: "boolean",
        short: "h",
        default: false,
      },
    },
  });
  const [command = "", serviceId] = positionals;

  const service = values.service ?? serviceId;

  return {
    command: values.help ? "help" : command,
    serviceId,
    source: values.source ?? DEFAULT_SOURCE,
    service,
    fixture: values.fixture,
    watch: values.watch ?? false,
    baseUrl:
      values["base-url"] ?? process.env.NOTJUSTYOU_BASE_URL ?? DEFAULT_BASE_URL,
  };
}

async function runStatus(input: {
  baseUrl: string;
  serviceId: string | undefined;
  watch: boolean;
}) {
  let keepRunning = true;

  process.once("SIGINT", () => {
    keepRunning = false;
  });

  do {
    const data = await fetchStatusData(input.baseUrl);
    const output = formatStatus(data, input.serviceId);

    console.log(output);

    if (!input.watch) return;
    await delay(WATCH_INTERVAL_MS);
    if (keepRunning) {
      console.log("");
    }
  } while (keepRunning);
}

async function runSetup(input: {
  baseUrl: string;
  source: string;
  service: string | undefined;
}) {
  const config = await registerAndWriteConfig({
    baseUrl: input.baseUrl,
    source: input.source,
    service: input.service ?? DEFAULT_SERVICE_ID,
  });
  const doctorExitCode = await runDoctor({
    baseUrl: config.baseUrl,
  });

  if (doctorExitCode !== 0) {
    throw new Error("Setup completed, but doctor checks did not pass.");
  }

  console.log("");
  console.log("Setup complete.");
  console.log(`Config: ${getConfigPath()}`);
  console.log(`Collector: ${config.collectorId}`);
  console.log(`Allowed source: ${config.source}`);
  console.log(`Allowed services: ${config.serviceIds.join(", ")}`);
  console.log("Next: configure the SDK collector to reuse this local config.");
}

async function runRegister(input: {
  baseUrl: string;
  source: string;
  service: string | undefined;
}) {
  const config = await registerAndWriteConfig({
    baseUrl: input.baseUrl,
    source: input.source,
    service: input.service ?? DEFAULT_SERVICE_ID,
  });

  console.log("Collector registered.");
  console.log(`Config: ${getConfigPath()}`);
  console.log(`Collector: ${config.collectorId}`);
  console.log(`Allowed source: ${config.source}`);
  console.log(`Allowed services: ${config.serviceIds.join(", ")}`);
  console.log("Token: saved locally; raw token is not printed.");
}

async function registerAndWriteConfig(input: {
  baseUrl: string;
  source: string;
  service: string;
}) {
  assertSupportedSource(input.source);
  assertSupportedService(input.service);

  const source = input.source as SignalSource;
  const serviceIds = [input.service];
  const registration = await registerCollector({
    baseUrl: input.baseUrl,
    source,
    serviceIds,
    clientName: CLIENT_NAME,
    clientVersion: CLIENT_VERSION,
  });

  return writeConfig({
    baseUrl: input.baseUrl,
    collectorId: registration.collectorId,
    collectorToken: registration.collectorToken,
    source,
    serviceIds,
    clientName: CLIENT_NAME,
    clientVersion: CLIENT_VERSION,
  });
}

async function runDoctor(input: { baseUrl: string }) {
  const checks: string[] = [];
  let failed = false;

  try {
    await fetchStatusData(input.baseUrl);
    checks.push("OK public status endpoints");
  } catch (error) {
    failed = true;
    checks.push(`FAIL public status endpoints (${formatError(error)})`);
  }

  let config;
  let configReadFailed = false;
  try {
    config = readConfig();
  } catch (error) {
    failed = true;
    configReadFailed = true;
    checks.push(`FAIL local config (${formatError(error)})`);
  }

  if (!config && !configReadFailed) {
    failed = true;
    checks.push(`FAIL local config (${getConfigPath()} not found)`);
  } else {
    if (!config) {
      console.log(checks.join("\n"));
      return 1;
    }

    checks.push(`OK local config (${getConfigPath()})`);
    const configMode = getConfigMode();
    checks.push(
      configMode === 0o600
        ? "OK local config permissions (0600)"
        : "FAIL local config permissions (expected 0600)",
    );
    failed = failed || configMode !== 0o600;
    checks.push(`OK collector allowlist (${config.source}: ${config.serviceIds.join(", ")})`);

    if (normalizeUrlForCompare(input.baseUrl) !== normalizeUrlForCompare(config.baseUrl)) {
      failed = true;
      checks.push("FAIL signal auth readiness (base URL differs from local config)");
    } else {
      try {
        await checkCollectorToken({
          baseUrl: config.baseUrl,
          collectorToken: config.collectorToken,
          clientVersion: config.clientVersion,
        });
        checks.push("OK signal auth readiness");
      } catch (error) {
        failed = true;
        checks.push(`FAIL signal auth readiness (${formatError(error)})`);
      }
    }
  }

  console.log(checks.join("\n"));
  return failed ? 1 : 0;
}

function runPayloadPreview(input: { fixture: string | undefined }) {
  if (!input.fixture) {
    throw new Error("payload-preview requires --fixture <path>.");
  }

  const fixture = JSON.parse(readFileSync(input.fixture, "utf8")) as unknown;
  const result = previewPayload(fixture);

  if (!result.ok) {
    console.log(`Rejected: ${result.reason}`);
    return 1;
  }

  console.log("Metadata-only payload preview:");
  console.log(JSON.stringify(result.payload, null, 2));
  return 0;
}

function assertSupportedSource(source: string) {
  if (!SIGNAL_SOURCES.has(source)) {
    throw new Error(`Unsupported source: ${source}`);
  }
}

function assertSupportedService(serviceId: string) {
  if (!SERVICE_IDS.has(serviceId)) {
    throw new Error(`Unsupported service: ${serviceId}`);
  }
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeUrlForCompare(url: string) {
  return url.replace(/\/+$/, "");
}

function printUsage() {
  console.log(`Usage:
  njy status [serviceId] [--base-url <url>] [--watch]
  njy setup [--source <source>] [--service <serviceId>] [--base-url <url>]
  njy register [--source <source>] [--service <serviceId>] [--base-url <url>]
  njy doctor [--base-url <url>]
  njy payload-preview --fixture <path>

Examples:
  njy status
  njy setup
  njy status openai-api --base-url http://localhost:3000
  njy status openai-api --watch
  njy payload-preview --fixture ./signal.json`);
}

export function isDirectRun(metaUrl: string, argvPath = process.argv[1]) {
  if (!argvPath) return false;

  try {
    return realpathSync(argvPath) === realpathSync(fileURLToPath(metaUrl));
  } catch {
    return false;
  }
}

if (isDirectRun(import.meta.url)) {
  main().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
