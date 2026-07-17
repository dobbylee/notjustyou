#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const RECEIVER_URL =
  process.env.NOTJUSTYOU_HOOK_RECEIVER_URL ?? "http://127.0.0.1:8765/hook";
const CLIENT_VERSION = "0.3.6";
const RECEIVER_HEALTH = {
  ok: true,
  name: "notjustyou-hook-receiver",
};

const STOP_FAILURE_SYMPTOMS = new Map([
  ["rate_limit", "rate_limited"],
  ["overloaded", "error"],
  ["authentication_failed", "auth_error"],
  ["oauth_org_not_allowed", "auth_error"],
  ["billing_error", "auth_error"],
  ["invalid_request", "error"],
  ["model_not_found", "model_unavailable"],
  ["server_error", "error"],
  ["max_output_tokens", "error"],
  ["unknown", "unknown"],
]);

async function main() {
  const input = await readStdinJson();
  const event = toLocalHookEvent(input);
  if (!event) return;

  if (process.env.NOTJUSTYOU_HOOK_DRY_RUN === "1") {
    process.stdout.write(`${JSON.stringify(event)}\n`);
    return;
  }

  const receiverToken = readReceiverToken();
  if (!receiverToken) return;

  if (!isLocalReceiverUrl(RECEIVER_URL)) return;
  if (!(await isNotJustYouReceiver(RECEIVER_URL, receiverToken))) return;

  try {
    await fetch(RECEIVER_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-notjustyou-receiver-token": receiverToken,
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(1000),
    });
  } catch {
    // Local collection is best-effort and must not block Claude Code.
  }
}

function toLocalHookEvent(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const eventName = input.hook_event_name;
  if (eventName === "StopFailure") {
    const error = typeof input.error === "string" ? input.error : "unknown";
    const symptom = STOP_FAILURE_SYMPTOMS.get(error);
    if (!symptom) return null;

    return {
      serviceId: "anthropic-claude-code",
      surface: "claude-code",
      eventName,
      symptom,
      errorCode: `claude_${error}`,
      clientVersion: CLIENT_VERSION,
    };
  }

  return null;
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

function isLocalReceiverUrl(value) {
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

async function isNotJustYouReceiver(value, receiverToken) {
  try {
    const healthUrl = new URL("/health", value);
    const response = await fetch(healthUrl, {
      method: "GET",
      headers: {
        "x-notjustyou-receiver-token": receiverToken,
      },
      signal: AbortSignal.timeout(500),
    });
    const body = await response.json();
    return (
      response.ok &&
      body?.ok === RECEIVER_HEALTH.ok &&
      body?.name === RECEIVER_HEALTH.name &&
      body?.mode === "send"
    );
  } catch {
    return false;
  }
}

function readReceiverToken(env = process.env) {
  const configPath = env.NOTJUSTYOU_CONFIG_PATH ?? join(
    env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config"),
    "notjustyou",
    "config.json",
  );
  if (!existsSync(configPath)) return null;
  try {
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    return config?.source === "cli_hook" &&
      config?.localHookSignalOptIn === true &&
      config?.serviceIds?.includes("anthropic-claude-code") &&
      typeof config.localReceiverToken === "string"
      ? config.localReceiverToken
      : null;
  } catch {
    return null;
  }
}

void main();
