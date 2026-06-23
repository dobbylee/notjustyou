import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { SdkConfig } from "./types.js";

const CONFIG_VERSION = 1;
const SUPPORTED_SERVICE_IDS = new Set([
  "anthropic-claude-api",
  "google-gemini-api",
  "openai-api",
]);

export function getConfigPath(env = process.env) {
  if (env.NOTJUSTYOU_CONFIG_PATH) return env.NOTJUSTYOU_CONFIG_PATH;

  const configHome =
    env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME.trim()
      ? env.XDG_CONFIG_HOME
      : join(homedir(), ".config");

  return join(configHome, "notjustyou", "config.json");
}

export function readSdkConfig(path = getConfigPath()): SdkConfig | null {
  let raw: string;

  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "ENOENT") return null;
    }

    throw error;
  }

  const parsed = parseSdkConfig(JSON.parse(raw));
  if (!parsed) return null;

  if (parsed.installationId) {
    return parsed as SdkConfig;
  }

  const withInstallationId: SdkConfig = {
    ...parsed,
    installationId: randomUUID(),
  };

  writeSdkConfig({ raw: JSON.parse(raw), config: withInstallationId, path });
  return withInstallationId;
}

function parseSdkConfig(input: unknown): (Omit<SdkConfig, "installationId"> & {
  installationId?: string;
}) | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const config = input as Record<string, unknown>;
  if (config.configVersion !== CONFIG_VERSION) return null;
  if (config.source !== "api_middleware") return null;

  const baseUrl = config.baseUrl;
  const collectorToken = config.collectorToken;
  const clientVersion = config.clientVersion;

  if (typeof baseUrl !== "string" || baseUrl.length === 0) return null;
  if (typeof collectorToken !== "string" || collectorToken.length === 0) return null;
  if (typeof clientVersion !== "string" || clientVersion.length === 0) return null;

  if (
    !Array.isArray(config.serviceIds) ||
    !config.serviceIds.every((serviceId) => typeof serviceId === "string")
  ) {
    return null;
  }

  if (!config.serviceIds.some((serviceId) => SUPPORTED_SERVICE_IDS.has(serviceId))) return null;

  if (
    config.installationId !== undefined &&
    (typeof config.installationId !== "string" || config.installationId.length === 0)
  ) {
    return null;
  }

  return {
    configVersion: CONFIG_VERSION,
    baseUrl,
    collectorToken,
    source: "api_middleware",
    serviceIds: config.serviceIds,
    clientVersion,
    ...(config.installationId ? { installationId: config.installationId } : {}),
  };
}

function writeSdkConfig(input: {
  raw: Record<string, unknown>;
  config: SdkConfig;
  path: string;
}) {
  const nextConfig = {
    ...input.raw,
    installationId: input.config.installationId,
  };

  mkdirSync(dirname(input.path), {
    recursive: true,
    mode: 0o700,
  });
  writeFileSync(input.path, `${JSON.stringify(nextConfig, null, 2)}\n`, {
    mode: 0o600,
  });
  chmodSync(input.path, 0o600);
}
