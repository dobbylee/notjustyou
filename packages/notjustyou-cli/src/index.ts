#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { checkCollectorToken, fetchStatusData } from "./api.js";
import { getConfigMode, getConfigPath, readConfig, writeConfig } from "./config.js";
import { formatStatus } from "./format.js";
import { previewPayload } from "./privacy.js";
import { createLocalHookReceiver, LOCAL_HOOK_RECEIVER_HEALTH } from "./receiver.js";
import {
  CLIENT_NAME,
  CLIENT_VERSION,
  DEFAULT_BASE_URL,
  getReportingSurface,
  registerAndWriteConfig,
} from "./reporting-setup.js";

const WATCH_INTERVAL_MS = 2_000;
const DEFAULT_SOURCE = "api_middleware";
const DEFAULT_SERVICE_ID = "openai-api";

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

  if (parsed.command === "enable") {
    await runEnable(parsed);
    return 0;
  }

  if (parsed.command === "disable") {
    runDisable(parsed);
    return 0;
  }

  if (parsed.command === "doctor") {
    return runDoctor(parsed);
  }

  if (parsed.command === "payload-preview") {
    return runPayloadPreview(parsed);
  }

  if (parsed.command === "hook-receiver") {
    await runHookReceiver(parsed);
    return 0;
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
        multiple: true,
      },
      fixture: {
        type: "string",
      },
      port: {
        type: "string",
      },
      send: {
        type: "boolean",
        default: false,
      },
      "enable-local-hooks": {
        type: "boolean",
        default: false,
      },
      "skip-receiver": {
        type: "boolean",
        default: false,
      },
      quiet: {
        type: "boolean",
        default: false,
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

  const service = values.service ?? (serviceId ? [serviceId] : undefined);

  return {
    command: values.help ? "help" : command,
    serviceId,
    source: values.source ?? DEFAULT_SOURCE,
    service,
    fixture: values.fixture,
    port: values.port,
    send: values.send ?? false,
    enableLocalHooks: values["enable-local-hooks"] ?? false,
    skipReceiver: values["skip-receiver"] ?? false,
    quiet: values.quiet ?? false,
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
  service: string[] | undefined;
  enableLocalHooks: boolean;
}) {
  const config = await registerAndWriteConfig({
    baseUrl: input.baseUrl,
    source: input.source,
    serviceIds: input.service ?? [DEFAULT_SERVICE_ID],
    enableLocalHooks: input.enableLocalHooks,
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
  service: string[] | undefined;
  enableLocalHooks: boolean;
}) {
  const config = await registerAndWriteConfig({
    baseUrl: input.baseUrl,
    source: input.source,
    serviceIds: input.service ?? [DEFAULT_SERVICE_ID],
    enableLocalHooks: input.enableLocalHooks,
  });

  console.log("Collector registered.");
  console.log(`Config: ${getConfigPath()}`);
  console.log(`Collector: ${config.collectorId}`);
  console.log(`Allowed source: ${config.source}`);
  console.log(`Allowed services: ${config.serviceIds.join(", ")}`);
  console.log("Token: saved locally; raw token is not printed.");
}

async function runEnable(input: {
  baseUrl: string;
  serviceId: string | undefined;
  skipReceiver: boolean;
  quiet: boolean;
}) {
  const surface = getReportingSurface(input.serviceId);

  const existingConfig = readConfig();
  let config = existingConfig;

  if (
    !config ||
    config.source !== "cli_hook" ||
    !config.serviceIds.includes(surface.serviceId) ||
    config.localHookSignalOptIn !== true
  ) {
    if (config && config.source !== "cli_hook") {
      throw new Error(
        `Existing config uses a different collector source. Automatic ${surface.displayName} reporting needs a cli_hook config.`,
      );
    }
    if (
      config &&
      config.source === "cli_hook" &&
      config.serviceIds.some((serviceId) => serviceId !== surface.serviceId)
    ) {
      throw new Error(
        `Existing cli_hook config includes services outside ${surface.displayName}. Re-run manual registration for a ${surface.displayName}-only hook config.`,
      );
    }

    config = await registerAndWriteConfig({
      baseUrl: input.baseUrl,
      source: "cli_hook",
      serviceIds: [surface.serviceId],
      enableLocalHooks: true,
    });
  }

  const receiverStatus = input.skipReceiver
    ? "skipped"
    : await ensureHookReceiverRunning();

  if (!input.quiet) {
    console.log(`${surface.displayName} reporting enabled.`);
    console.log(`Config: ${getConfigPath()}`);
    console.log(`Collector: ${config.collectorId}`);
    console.log("Allowed source: cli_hook");
    console.log(`Allowed services: ${config.serviceIds.join(", ")}`);
    console.log(`Local hook receiver: ${receiverStatus}`);
    console.log("Token: saved locally; raw token is not printed.");
  }
}

function runDisable(input: { serviceId: string | undefined; quiet: boolean }) {
  const surface = getReportingSurface(input.serviceId);

  const config = readConfig();
  if (!config) {
    if (!input.quiet) console.log(`${surface.displayName} reporting is not configured.`);
    return;
  }

  if (config.source !== "cli_hook") {
    if (!input.quiet) {
      console.log(`${surface.displayName} reporting is not enabled for this config.`);
    }
    return;
  }

  if (!config.serviceIds.includes(surface.serviceId)) {
    if (!input.quiet) {
      console.log(`${surface.displayName} reporting is not enabled for this config.`);
    }
    return;
  }

  if (config.serviceIds.some((serviceId) => serviceId !== surface.serviceId)) {
    throw new Error(
      `Existing cli_hook config includes services outside ${surface.displayName}. Re-run manual registration for a ${surface.displayName}-only hook config.`,
    );
  }

  writeConfig({
    ...config,
    localHookSignalOptIn: false,
  });

  if (!input.quiet) {
    console.log(`${surface.displayName} reporting disabled.`);
    console.log("The local receiver may keep running, but it will not send hook signals.");
  }
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

  console.log(
    result.kind === "hook"
      ? "Normalized hook signal preview:"
      : "Metadata-only payload preview:",
  );
  console.log(JSON.stringify(result.payload, null, 2));
  return 0;
}

async function runHookReceiver(input: { port: string | undefined; send: boolean }) {
  const port = input.port === undefined ? undefined : Number(input.port);
  if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65535)) {
    throw new Error("hook-receiver --port must be an integer from 0 to 65535.");
  }

  const receiver = createLocalHookReceiver({
    port,
    sendSignals: input.send,
  });
  const address = await receiver.start();

  console.log(
    `Local hook receiver listening on http://${address.host}:${address.port}/hook`,
  );
  console.log(input.send ? "Signal sending: opt-in gated" : "Signal sending: disabled");

  await new Promise<void>((resolve) => {
    process.once("SIGINT", () => {
      void receiver.close().finally(resolve);
    });
    process.once("SIGTERM", () => {
      void receiver.close().finally(resolve);
    });
  });
}

async function ensureHookReceiverRunning() {
  if (await isHookReceiverRunning()) return "already running";

  const entrypoint = process.argv[1] ?? fileURLToPath(import.meta.url);
  const child = spawn(process.execPath, [realpathSync(entrypoint), "hook-receiver", "--send"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  return "started";
}

async function isHookReceiverRunning() {
  try {
    const response = await fetch("http://127.0.0.1:8765/health", {
      method: "GET",
      signal: AbortSignal.timeout(500),
    });
    const body = await response.json();
    return (
      response.ok &&
      body?.ok === LOCAL_HOOK_RECEIVER_HEALTH.ok &&
      body?.name === LOCAL_HOOK_RECEIVER_HEALTH.name
    );
  } catch {
    return false;
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
  njy setup [--source <source>] [--service <serviceId> ...] [--base-url <url>] [--enable-local-hooks]
  njy register [--source <source>] [--service <serviceId> ...] [--base-url <url>] [--enable-local-hooks]
  njy enable claude-code [--base-url <url>]
  njy enable cursor [--base-url <url>]
  njy disable claude-code
  njy disable cursor
  njy doctor [--base-url <url>]
  njy payload-preview --fixture <path>
  njy hook-receiver [--port <port>] [--send]

Examples:
  njy status
  njy setup
  njy enable claude-code
  njy enable cursor
  njy status openai-api --base-url http://localhost:3000
  njy status openai-api --watch
  njy payload-preview --fixture ./signal.json
  njy hook-receiver --port 8765`);
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
