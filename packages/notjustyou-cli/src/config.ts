import { chmodSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { CliConfig } from "./types.js";

const CONFIG_VERSION = 1;
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

export function getConfigPath(env = process.env) {
  if (env.NOTJUSTYOU_CONFIG_PATH) return env.NOTJUSTYOU_CONFIG_PATH;

  const configHome =
    env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME.trim()
      ? env.XDG_CONFIG_HOME
      : join(homedir(), ".config");

  return join(configHome, "notjustyou", "config.json");
}

export function readConfig(path = getConfigPath()): CliConfig | null {
  try {
    return parseConfig(JSON.parse(readFileSync(path, "utf8")));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "ENOENT") return null;
    }

    throw error;
  }
}

export function getConfigMode(path = getConfigPath()) {
  return statSync(path).mode & 0o777;
}

export function writeConfig(config: Omit<CliConfig, "configVersion">, path = getConfigPath()) {
  const nextConfig: CliConfig = {
    configVersion: CONFIG_VERSION,
    ...config,
  };

  mkdirSync(dirname(path), {
    recursive: true,
    mode: 0o700,
  });
  writeFileSync(path, `${JSON.stringify(nextConfig, null, 2)}\n`, {
    mode: 0o600,
  });
  chmodSync(path, 0o600);

  return nextConfig;
}

function parseConfig(input: unknown): CliConfig {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Config must be a JSON object.");
  }

  const config = input as Record<string, unknown>;
  const serviceIds = config.serviceIds;

  if (config.configVersion !== CONFIG_VERSION) {
    throw new Error("Unsupported config version.");
  }

  for (const field of [
    "baseUrl",
    "collectorId",
    "collectorToken",
    "source",
    "clientName",
    "clientVersion",
  ]) {
    if (typeof config[field] !== "string" || config[field].length === 0) {
      throw new Error(`Config field ${field} must be a non-empty string.`);
    }
  }

  if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
    throw new Error("Config field serviceIds must be a non-empty array.");
  }

  if (!serviceIds.every((serviceId) => typeof serviceId === "string" && serviceId)) {
    throw new Error("Config field serviceIds must contain only non-empty strings.");
  }

  if (!SIGNAL_SOURCES.has(config.source as string)) {
    throw new Error("Config field source is unsupported.");
  }

  if (!serviceIds.every((serviceId) => SERVICE_IDS.has(serviceId))) {
    throw new Error("Config field serviceIds contains an unknown service.");
  }

  if (
    config.localHookSignalOptIn !== undefined &&
    typeof config.localHookSignalOptIn !== "boolean"
  ) {
    throw new Error("Config field localHookSignalOptIn must be a boolean.");
  }

  if (
    config.localReceiverToken !== undefined &&
    (typeof config.localReceiverToken !== "string" ||
      config.localReceiverToken.length < 16 ||
      config.localReceiverToken.length > 120)
  ) {
    throw new Error("Config field localReceiverToken must be a 16-120 character string.");
  }

  return config as unknown as CliConfig;
}
