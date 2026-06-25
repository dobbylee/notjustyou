import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { registerCollector } from "./api.js";
import { readConfig, writeConfig } from "./config.js";
import { LOCAL_HOOK_RECEIVER_HEALTH } from "./receiver.js";
import type { SignalSource } from "./types.js";

export const DEFAULT_BASE_URL = "https://notjustyou.dev";
export const CLIENT_NAME = "notjustyou-cli";
export const CLIENT_VERSION = "0.3.2";
export const CLAUDE_CODE_REPORTING_SERVICE = "anthropic-claude-code";
export const CURSOR_REPORTING_SERVICE = "cursor-ide";
export const ANTIGRAVITY_CLI_REPORTING_SERVICE = "google-antigravity-cli";
export const ANTIGRAVITY_REPORTING_SERVICE = "google-antigravity";
export const ANTIGRAVITY_IDE_REPORTING_SERVICE = "google-antigravity-ide";

const LOCAL_HOOK_REPORTING_SERVICES = new Set([
  CLAUDE_CODE_REPORTING_SERVICE,
  CURSOR_REPORTING_SERVICE,
  ANTIGRAVITY_CLI_REPORTING_SERVICE,
  ANTIGRAVITY_REPORTING_SERVICE,
  ANTIGRAVITY_IDE_REPORTING_SERVICE,
]);
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

export const REPORTING_SURFACES = {
  "claude-code": {
    serviceId: CLAUDE_CODE_REPORTING_SERVICE,
    displayName: "Claude Code",
  },
  cursor: {
    serviceId: CURSOR_REPORTING_SERVICE,
    displayName: "Cursor",
  },
  "antigravity-cli": {
    serviceId: ANTIGRAVITY_CLI_REPORTING_SERVICE,
    displayName: "Antigravity CLI",
  },
  antigravity: {
    serviceId: ANTIGRAVITY_REPORTING_SERVICE,
    displayName: "Antigravity",
  },
  "antigravity-ide": {
    serviceId: ANTIGRAVITY_IDE_REPORTING_SERVICE,
    displayName: "Antigravity IDE",
  },
} as const;

export type ReportingSurfaceId = keyof typeof REPORTING_SURFACES;

export interface ReportingSetupState {
  surface: ReportingSurfaceId;
  displayName: string;
  serviceId: string;
  configured: boolean;
  enabled: boolean;
  source: string | null;
  serviceIds: string[];
  localHookSignalOptIn: boolean;
}

export async function enableReporting(input: {
  surface: ReportingSurfaceId;
  baseUrl?: string;
  startReceiver?: boolean;
}) {
  const surface = getReportingSurface(input.surface);
  const baseUrl = input.baseUrl ?? DEFAULT_BASE_URL;
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
      baseUrl,
      source: "cli_hook",
      serviceIds: [surface.serviceId],
      enableLocalHooks: true,
    });
  }

  const receiverStatus =
    input.startReceiver === false ? "skipped" : await ensureHookReceiverRunning();

  return {
    surface: input.surface,
    displayName: surface.displayName,
    serviceId: surface.serviceId,
    enabled: true,
    receiverStatus,
    source: config.source,
    serviceIds: config.serviceIds,
    localHookSignalOptIn: config.localHookSignalOptIn === true,
  };
}

export function disableReporting(input: { surface: ReportingSurfaceId }) {
  const surface = getReportingSurface(input.surface);
  const config = readConfig();

  if (!config) {
    return {
      surface: input.surface,
      displayName: surface.displayName,
      serviceId: surface.serviceId,
      changed: false,
      enabled: false,
      reason: "not_configured",
    };
  }

  if (config.source !== "cli_hook" || !config.serviceIds.includes(surface.serviceId)) {
    return {
      surface: input.surface,
      displayName: surface.displayName,
      serviceId: surface.serviceId,
      changed: false,
      enabled: false,
      reason: "not_enabled_for_surface",
    };
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

  return {
    surface: input.surface,
    displayName: surface.displayName,
    serviceId: surface.serviceId,
    changed: config.localHookSignalOptIn === true,
    enabled: false,
    reason: "disabled",
  };
}

export function getReportingSetupState(
  surfaceId: ReportingSurfaceId,
): ReportingSetupState {
  const surface = getReportingSurface(surfaceId);
  const config = readConfig();

  return {
    surface: surfaceId,
    displayName: surface.displayName,
    serviceId: surface.serviceId,
    configured: Boolean(config),
    enabled:
      config?.source === "cli_hook" &&
      config.serviceIds.includes(surface.serviceId) &&
      config.localHookSignalOptIn === true,
    source: config?.source ?? null,
    serviceIds: config?.serviceIds ?? [],
    localHookSignalOptIn: config?.localHookSignalOptIn === true,
  };
}

export function getReportingSurface(surface: string | undefined) {
  if (surface !== undefined && surface in REPORTING_SURFACES) {
    return REPORTING_SURFACES[surface as ReportingSurfaceId];
  }

  throw new Error(
    "Supported reporting surfaces: claude-code, cursor, antigravity-cli, antigravity, antigravity-ide.",
  );
}

export async function registerAndWriteConfig(input: {
  baseUrl: string;
  source: string;
  serviceIds: string[];
  enableLocalHooks: boolean;
}) {
  assertSupportedSource(input.source);
  const serviceIds = [...new Set(input.serviceIds)];
  serviceIds.forEach(assertSupportedService);
  if (input.enableLocalHooks && input.source !== "cli_hook") {
    throw new Error("--enable-local-hooks requires --source cli_hook.");
  }
  if (
    input.enableLocalHooks &&
    serviceIds.some((serviceId) => !LOCAL_HOOK_REPORTING_SERVICES.has(serviceId))
  ) {
    throw new Error(
      "--enable-local-hooks currently supports anthropic-claude-code, cursor-ide, google-antigravity-cli, google-antigravity, and google-antigravity-ide only.",
    );
  }

  const source = input.source as SignalSource;
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
    ...(input.enableLocalHooks ? { localHookSignalOptIn: true } : {}),
  });
}

async function ensureHookReceiverRunning() {
  if (await isHookReceiverRunning()) return "already running";

  const child = spawn(process.execPath, [getCliEntrypoint(), "hook-receiver", "--send"], {
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

function getCliEntrypoint() {
  return realpathSync(join(dirname(fileURLToPath(import.meta.url)), "index.js"));
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
