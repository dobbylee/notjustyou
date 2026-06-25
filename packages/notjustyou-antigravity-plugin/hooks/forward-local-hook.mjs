#!/usr/bin/env node

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ANTIGRAVITY_SERVICE_IDS = new Set([
  "google-antigravity-cli",
  "google-antigravity",
  "google-antigravity-ide",
]);
const RECEIVER_URL =
  process.env.NOTJUSTYOU_HOOK_RECEIVER_URL ?? "http://127.0.0.1:8765/hook";
const RECEIVER_HEALTH = {
  ok: true,
  name: "notjustyou-hook-receiver",
};

async function main() {
  const hookEventName = process.argv[2] ?? "Stop";
  const serviceId = getConfiguredAntigravityServiceId();
  if (!serviceId) return writeHookResponse(hookEventName);

  const input = await readStdinJson();
  const event = toRawAntigravityHookEnvelope(input, hookEventName, serviceId);
  if (!event) return writeHookResponse(hookEventName);

  if (!isLocalReceiverUrl(RECEIVER_URL)) return writeHookResponse(hookEventName);
  if (!(await isNotJustYouReceiver(RECEIVER_URL))) {
    return writeHookResponse(hookEventName);
  }

  try {
    await fetch(RECEIVER_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(1000),
    });
  } catch {
    // Local collection is best-effort and must not block Antigravity.
  }

  writeHookResponse(hookEventName);
}

export function getConfiguredAntigravityServiceId(env = process.env) {
  const configPath = getConfigPath(env);
  if (!existsSync(configPath)) return null;

  try {
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    const configuredServices = Array.isArray(config?.serviceIds)
      ? config.serviceIds.filter((serviceId) => ANTIGRAVITY_SERVICE_IDS.has(serviceId))
      : [];

    if (configuredServices.length !== 1) return null;

    return config?.source === "cli_hook" && config?.localHookSignalOptIn === true
      ? configuredServices[0]
      : null;
  } catch {
    return null;
  }
}

function getConfigPath(env) {
  if (env.NOTJUSTYOU_CONFIG_PATH) return env.NOTJUSTYOU_CONFIG_PATH;

  const configHome =
    env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME.trim()
      ? env.XDG_CONFIG_HOME
      : join(homedir(), ".config");

  return join(configHome, "notjustyou", "config.json");
}

export function toRawAntigravityHookEnvelope(input, hookEventName, serviceId) {
  if (!ANTIGRAVITY_SERVICE_IDS.has(serviceId)) return null;
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const eventName = normalizeEventName(hookEventName);
  if (eventName !== "stop") return null;

  if (input.fullyIdle !== true) return null;

  const terminationReason =
    input.terminationReason === "error" ? "error" : undefined;
  const hasError = typeof input.error === "string" && input.error.length > 0;
  if (terminationReason !== "error" && !hasError) return null;

  return {
    rawHook: "antigravity",
    payload: {
      hook_event_name: "Stop",
      service_id: serviceId,
      termination_reason: terminationReason,
      has_error: hasError,
      fully_idle: true,
      client_version: normalizeOptionalVersion(
        process.env.NOTJUSTYOU_ANTIGRAVITY_VERSION,
      ),
    },
  };
}

async function readStdinJson() {
  let body = "";
  for await (const chunk of process.stdin) {
    body += String(chunk);
    if (Buffer.byteLength(body, "utf8") > 8192) return null;
  }

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export function isLocalReceiverUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      url.pathname === "/hook" &&
      (url.hostname === "127.0.0.1" ||
        url.hostname === "localhost" ||
        url.hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

async function isNotJustYouReceiver(value) {
  try {
    const healthUrl = new URL("/health", value);
    const response = await fetch(healthUrl, {
      method: "GET",
      signal: AbortSignal.timeout(500),
    });
    const body = await response.json();
    return (
      response.ok &&
      body?.ok === RECEIVER_HEALTH.ok &&
      body?.name === RECEIVER_HEALTH.name
    );
  } catch {
    return false;
  }
}

function writeHookResponse(hookEventName) {
  if (normalizeEventName(hookEventName) === "stop") {
    process.stdout.write(`${JSON.stringify({ decision: "" })}\n`);
    return;
  }

  process.stdout.write("{}\n");
}

function normalizeEventName(value) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function normalizeOptionalVersion(value) {
  if (typeof value !== "string") return undefined;
  if (value.length < 1 || value.length > 80) return undefined;
  return /^[0-9]+(?:\.[0-9]+){0,3}(?:[-+][0-9A-Za-z.-]+)?$/.test(value)
    ? value
    : undefined;
}

function isDirectRun(metaUrl, argvPath = process.argv[1]) {
  if (!argvPath) return false;

  try {
    return realpathSync(argvPath) === realpathSync(fileURLToPath(metaUrl));
  } catch {
    return false;
  }
}

if (isDirectRun(import.meta.url)) {
  void main();
}
