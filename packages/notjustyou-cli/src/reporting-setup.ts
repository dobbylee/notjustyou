import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SERVICE_IDS, SIGNAL_SOURCES } from "./reporting-contract.js";
import { registerCollector } from "./api.js";
import { readConfig, writeConfig } from "./config.js";
import { LOCAL_HOOK_RECEIVER_HEALTH } from "./receiver.js";
import type { SignalSource } from "./types.js";

export const DEFAULT_BASE_URL = "https://notjustyou.dev";
export const CLIENT_NAME = "notjustyou-cli";
export const CLIENT_VERSION = "0.3.7";
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
const ANTIGRAVITY_REPORTING_SERVICES = new Set([
  ANTIGRAVITY_CLI_REPORTING_SERVICE,
  ANTIGRAVITY_REPORTING_SERVICE,
  ANTIGRAVITY_IDE_REPORTING_SERVICE,
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
    displayName: "Antigravity 2.0",
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

  if (config?.source === "cli_hook" && config.localHookSignalOptIn === true) {
    assertOnlySupportedLocalHookServices(config.serviceIds);
  }

  const needsAntigravityNormalization =
    config?.source === "cli_hook" &&
    config.localHookSignalOptIn === true &&
    ANTIGRAVITY_REPORTING_SERVICES.has(surface.serviceId) &&
    countAntigravityServiceIds(config.serviceIds) > 1;

  if (
    !config ||
    config.source !== "cli_hook" ||
    !config.serviceIds.includes(surface.serviceId) ||
    config.localHookSignalOptIn !== true ||
    !config.localReceiverToken ||
    needsAntigravityNormalization
  ) {
    if (config && config.source !== "cli_hook") {
      throw new Error(
        `Existing config uses a different collector source. Automatic ${surface.displayName} reporting needs a cli_hook config.`,
      );
    }
    const activeServiceIds = getActiveLocalHookServiceIds(config);
    const nextServiceIds = mergeReportingServiceIds(
      activeServiceIds,
      surface.serviceId,
    );
    config = await registerAndWriteConfig({
      baseUrl: activeServiceIds.length > 0 && config ? config.baseUrl : baseUrl,
      source: "cli_hook",
      serviceIds: nextServiceIds,
      enableLocalHooks: true,
      localReceiverToken: config?.localReceiverToken,
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

export async function disableReporting(input: { surface: ReportingSurfaceId }) {
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

  if (
    config.source !== "cli_hook" ||
    config.localHookSignalOptIn !== true ||
    !config.serviceIds.includes(surface.serviceId)
  ) {
    return {
      surface: input.surface,
      displayName: surface.displayName,
      serviceId: surface.serviceId,
      changed: false,
      enabled: false,
      reason: "not_enabled_for_surface",
    };
  }

  assertOnlySupportedLocalHookServices(config.serviceIds);

  const remainingServiceIds = config.serviceIds.filter(
    (serviceId) => serviceId !== surface.serviceId,
  );

  if (remainingServiceIds.length > 0) {
    await registerAndWriteConfig({
      baseUrl: config.baseUrl,
      source: "cli_hook",
      serviceIds: remainingServiceIds,
      enableLocalHooks: true,
      localReceiverToken: config.localReceiverToken,
    });
  } else {
    writeConfig({
      ...config,
      serviceIds: [surface.serviceId],
      localHookSignalOptIn: false,
    });
  }

  return {
    surface: input.surface,
    displayName: surface.displayName,
    serviceId: surface.serviceId,
    changed: config.localHookSignalOptIn === true,
    enabled: false,
    reason: "disabled",
    serviceIds: remainingServiceIds.length > 0 ? remainingServiceIds : [surface.serviceId],
    localHookSignalOptIn: remainingServiceIds.length > 0,
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
      config.localHookSignalOptIn === true &&
      !(
        ANTIGRAVITY_REPORTING_SERVICES.has(surface.serviceId) &&
        countAntigravityServiceIds(config.serviceIds) > 1
      ),
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
  localReceiverToken?: string;
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
  if (
    input.enableLocalHooks &&
    serviceIds.filter((serviceId) => ANTIGRAVITY_REPORTING_SERVICES.has(serviceId))
      .length > 1
  ) {
    throw new Error(
      "--enable-local-hooks supports only one Antigravity service at a time.",
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
    ...(input.enableLocalHooks
      ? { localReceiverToken: input.localReceiverToken ?? randomUUID() }
      : {}),
  });
}

function getActiveLocalHookServiceIds(
  config: ReturnType<typeof readConfig>,
) {
  if (
    !config ||
    config.source !== "cli_hook" ||
    config.localHookSignalOptIn !== true
  ) {
    return [];
  }

  assertOnlySupportedLocalHookServices(config.serviceIds);

  return config.serviceIds;
}

function mergeReportingServiceIds(
  activeServiceIds: string[],
  nextServiceId: string,
) {
  const serviceIds = ANTIGRAVITY_REPORTING_SERVICES.has(nextServiceId)
    ? activeServiceIds.filter(
      (serviceId) => !ANTIGRAVITY_REPORTING_SERVICES.has(serviceId),
    )
    : activeServiceIds;

  return [...serviceIds, nextServiceId];
}

function countAntigravityServiceIds(serviceIds: string[]) {
  return serviceIds.filter((serviceId) =>
    ANTIGRAVITY_REPORTING_SERVICES.has(serviceId),
  ).length;
}

function assertOnlySupportedLocalHookServices(serviceIds: string[]) {
  const unsupportedService = serviceIds.find(
    (serviceId) => !LOCAL_HOOK_REPORTING_SERVICES.has(serviceId),
  );

  if (unsupportedService) {
    throw new Error(
      `Existing cli_hook config includes unsupported local hook service ${unsupportedService}. Re-run manual registration with supported hook services only.`,
    );
  }
}

async function ensureHookReceiverRunning() {
  const config = readConfig();
  const receiverToken = config?.localReceiverToken;
  if (!receiverToken) throw new Error("Local receiver token is missing.");

  const mode = await getHookReceiverMode(receiverToken);
  if (mode === "send") return "already running";
  if (mode === "preview") {
    throw new Error("Local hook receiver is running in preview mode. Stop it before enabling reporting.");
  }

  const child = spawn(process.execPath, [getCliEntrypoint(), "hook-receiver", "--send"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if ((await getHookReceiverMode(receiverToken)) === "send") return "started";
  }

  throw new Error("Local hook receiver did not become ready in send mode.");
}

async function getHookReceiverMode(receiverToken: string) {
  try {
    const response = await fetch("http://127.0.0.1:8765/health", {
      method: "GET",
      headers: {
        "x-notjustyou-receiver-token": receiverToken,
      },
      signal: AbortSignal.timeout(500),
    });
    const body = await response.json();
    return response.ok &&
      body?.ok === LOCAL_HOOK_RECEIVER_HEALTH.ok &&
      body?.name === LOCAL_HOOK_RECEIVER_HEALTH.name
      ? body.mode === "send" || body.mode === "preview"
        ? body.mode
        : null
      : null;
  } catch {
    return null;
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
