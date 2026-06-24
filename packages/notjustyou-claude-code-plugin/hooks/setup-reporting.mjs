#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONSENT_VALUE = process.argv[2];
const SERVICE_ID = "anthropic-claude-code";
const CLI_PACKAGE = "@notjustyou/cli@0.3.0";
const RECEIVER_URL = "http://127.0.0.1:8765/hook";
const RECEIVER_HEALTH = {
  ok: true,
  name: "notjustyou-hook-receiver",
};

async function main() {
  if (CONSENT_VALUE !== "true") return;
  if (isReportingConfigured() && (await isReceiverRunning())) return;

  const args = ["-y", CLI_PACKAGE, "enable", "claude-code", "--quiet"];
  const child = spawn(getNpxCommand(), args, {
    detached: true,
    stdio: "ignore",
    env: getSafeEnv(),
  });
  child.unref();
}

function isReportingConfigured() {
  const configPath = getConfigPath();
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

function getConfigPath() {
  return join(homedir(), ".config", "notjustyou", "config.json");
}

async function isReceiverRunning() {
  try {
    const healthUrl = new URL("/health", RECEIVER_URL);
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

function getNpxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function getSafeEnv() {
  const safe = {
    NOTJUSTYOU_ONBOARDING_SOURCE: "claude-code-plugin",
  };
  for (const key of [
    "PATH",
    "HOME",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "TMPDIR",
    "TEMP",
    "TMP",
    "SystemRoot",
    "ComSpec",
  ]) {
    if (process.env[key]) safe[key] = process.env[key];
  }
  return safe;
}

main().catch(() => {
  // Claude Code startup should not fail if onboarding cannot run.
});
