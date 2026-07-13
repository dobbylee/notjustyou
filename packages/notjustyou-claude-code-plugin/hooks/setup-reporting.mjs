#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const CONSENT_VALUE = process.argv[2];
const SERVICE_ID = "anthropic-claude-code";
const CLI_PACKAGE = "@notjustyou/cli@0.3.6";
const RECEIVER_URL = "http://127.0.0.1:8765/hook";
const RECEIVER_HEALTH = {
  ok: true,
  name: "notjustyou-hook-receiver",
};

async function main() {
  const reportingConfigured = readReportingConfig();
  const managedMarker = getManagedMarkerPath();

  if (CONSENT_VALUE !== "true") {
    if (!managedMarker || !existsSync(managedMarker)) return;
    if (reportingConfigured?.enabled) {
      spawnCli(["-y", CLI_PACKAGE, "disable", "claude-code", "--quiet"]);
    } else {
      unlinkSync(managedMarker);
    }
    return;
  }

  if (managedMarker) {
    mkdirSync(dirname(managedMarker), { recursive: true, mode: 0o700 });
    writeFileSync(managedMarker, "plugin-option\n", { mode: 0o600 });
  }

  if (
    reportingConfigured?.enabled &&
    reportingConfigured.localReceiverToken &&
    (await isReceiverRunning(reportingConfigured.localReceiverToken))
  ) {
    return;
  }

  spawnCli(["-y", CLI_PACKAGE, "enable", "claude-code", "--quiet"]);
}

function spawnCli(args) {
  const child = spawn(getNpxCommand(), args, {
    detached: true,
    stdio: "ignore",
    env: getSafeEnv(),
  });
  child.unref();
}

function readReportingConfig() {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return null;

  try {
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    const enabled =
      config?.source === "cli_hook" &&
      config?.localHookSignalOptIn === true &&
      Array.isArray(config?.serviceIds) &&
      config.serviceIds.includes(SERVICE_ID);
    return enabled
      ? {
          enabled: true,
          ...(typeof config.localReceiverToken === "string"
            ? { localReceiverToken: config.localReceiverToken }
            : {}),
        }
      : null;
  } catch {
    return null;
  }
}

function getConfigPath() {
  if (process.env.NOTJUSTYOU_CONFIG_PATH) return process.env.NOTJUSTYOU_CONFIG_PATH;
  const configHome = process.env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config");
  return join(configHome, "notjustyou", "config.json");
}

function getManagedMarkerPath() {
  return process.env.CLAUDE_PLUGIN_DATA
    ? join(process.env.CLAUDE_PLUGIN_DATA, "notjustyou-reporting-managed")
    : join(dirname(getConfigPath()), "claude-plugin-reporting-managed");
}

async function isReceiverRunning(receiverToken) {
  try {
    const healthUrl = new URL("/health", RECEIVER_URL);
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
    "XDG_CONFIG_HOME",
    "NOTJUSTYOU_CONFIG_PATH",
    "CLAUDE_PLUGIN_DATA",
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
