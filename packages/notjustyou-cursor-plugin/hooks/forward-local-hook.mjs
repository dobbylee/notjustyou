#!/usr/bin/env node

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SERVICE_ID = "cursor-ide";
const RECEIVER_URL =
  process.env.NOTJUSTYOU_HOOK_RECEIVER_URL ?? "http://127.0.0.1:8765/hook";
const RECEIVER_HEALTH = {
  ok: true,
  name: "notjustyou-hook-receiver",
};

async function main() {
  if (!isCursorReportingConfigured()) return;

  const input = await readStdinJson();
  const event = toRawCursorHookEnvelope(input, process.argv[2]);
  if (!event) return;

  if (!isLocalReceiverUrl(RECEIVER_URL)) return;
  if (!(await isNotJustYouReceiver(RECEIVER_URL))) return;

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
    // Local collection is best-effort and must not block Cursor.
  }
}

export function isCursorReportingConfigured(env = process.env) {
  const configPath = getConfigPath(env);
  if (!existsSync(configPath)) return false;

  try {
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    return (
      config?.source === "cli_hook" &&
      config?.localHookSignalOptIn === true &&
      Array.isArray(config?.serviceIds) &&
      config.serviceIds.includes(SERVICE_ID)
    );
  } catch {
    return false;
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

export function toRawCursorHookEnvelope(input, hookEventName = undefined) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const eventName = hookEventName ?? input.hook_event_name;
  if (eventName !== "stop" && eventName !== "sessionEnd") return null;

  return {
    rawHook: "cursor",
    payload: {
      hook_event_name: eventName,
      ...pickAllowed(input, [
        "status",
        "reason",
        "duration_ms",
        "cursor_version",
      ]),
    },
  };
}

function pickAllowed(input, allowedFields) {
  return Object.fromEntries(
    allowedFields
      .filter((field) => input[field] !== undefined)
      .map((field) => [field, input[field]]),
  );
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
