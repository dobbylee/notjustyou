import type { PayloadPreviewResult } from "./types.js";
import { previewLocalHookEvent } from "./local-hook.js";

const SENSITIVE_KEYS = new Set([
  "prompt",
  "message",
  "args",
  "commandargs",
  "shelloutput",
  "toolinput",
  "toolresult",
  "toolresultbody",
  "filepath",
  "body",
  "request",
  "response",
  "headers",
  "authorization",
  "cookie",
  "apikey",
  "token",
  "accountemail",
  "email",
  "machinename",
  "username",
  "user",
  "diff",
  "filecontent",
  "code",
]);

const ALLOWED_SIGNAL_FIELDS = new Set([
  "serviceId",
  "source",
  "symptom",
  "observedAt",
  "durationMs",
  "statusCode",
  "errorCode",
  "installationId",
  "clientVersion",
  "regionHint",
]);

const SIGNAL_SOURCES = new Set([
  "api_middleware",
  "cli_hook",
  "ide_extension",
  "browser_extension",
  "mcp_monitor",
  "local_probe",
]);

const SIGNAL_SYMPTOMS = new Set([
  "slow",
  "error",
  "down",
  "rate_limited",
  "auth_error",
  "model_unavailable",
  "network_error",
  "tool_failure",
  "permission_blocked",
  "unknown",
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
const ISO_DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?Z$/;

export function previewPayload(input: unknown): PayloadPreviewResult {
  const sensitiveScan = scanForSensitiveKeys(input);
  if (!sensitiveScan.ok) {
    return {
      ok: false,
      reason: `Sensitive field rejected: ${sensitiveScan.key}`,
    };
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      reason: "Fixture must be a JSON object.",
    };
  }

  const payload = input as Record<string, unknown>;
  const unknownFields = Object.keys(payload).filter(
    (field) => !ALLOWED_SIGNAL_FIELDS.has(field),
  );
  if (unknownFields.length > 0 && looksLikeLocalHookEvent(payload)) {
    return previewLocalHookEvent(payload);
  }

  if (unknownFields.length > 0) {
    return {
      ok: false,
      reason: `Unknown field rejected: ${unknownFields[0]}`,
    };
  }

  const signal = payload;
  const validation = validateMetadataSignal(signal);
  if (!validation.ok) return validation;

  return {
    ok: true,
    kind: "signal",
    payload: pickDefined({
      serviceId: signal.serviceId,
      source: signal.source,
      symptom: signal.symptom,
      observedAt: signal.observedAt,
      durationMs: signal.durationMs,
      statusCode: signal.statusCode,
      errorCode: signal.errorCode,
      installationId: signal.installationId,
      clientVersion: signal.clientVersion,
      regionHint: signal.regionHint,
    }),
  };
}

export function scanForSensitiveKeys(input: unknown):
  | {
      ok: true;
    }
  | {
      ok: false;
      key: string;
    } {
  if (!input || typeof input !== "object") {
    return { ok: true };
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      const result = scanForSensitiveKeys(item);
      if (!result.ok) return result;
    }

    return { ok: true };
  }

  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      return {
        ok: false,
        key,
      };
    }

    const result = scanForSensitiveKeys(value);
    if (!result.ok) return result;
  }

  return { ok: true };
}

function validateMetadataSignal(signal: Record<string, unknown>): PayloadPreviewResult {
  if (!isStringInRange(signal.serviceId, 1, 80)) {
    return { ok: false, reason: "serviceId must be 1-80 characters." };
  }

  if (!SERVICE_IDS.has(signal.serviceId)) {
    return { ok: false, reason: "serviceId is unknown." };
  }

  if (typeof signal.source !== "string" || !SIGNAL_SOURCES.has(signal.source)) {
    return { ok: false, reason: "source is unsupported." };
  }

  if (typeof signal.symptom !== "string" || !SIGNAL_SYMPTOMS.has(signal.symptom)) {
    return { ok: false, reason: "symptom is unsupported." };
  }

  if (
    signal.observedAt !== undefined &&
    (typeof signal.observedAt !== "string" || !isValidUtcDatetime(signal.observedAt))
  ) {
    return { ok: false, reason: "observedAt must be an ISO timestamp." };
  }

  if (
    signal.durationMs !== undefined &&
    (!Number.isInteger(signal.durationMs) ||
      Number(signal.durationMs) < 0 ||
      Number(signal.durationMs) > 600_000)
  ) {
    return { ok: false, reason: "durationMs must be an integer from 0 to 600000." };
  }

  if (
    signal.statusCode !== undefined &&
    (!Number.isInteger(signal.statusCode) ||
      Number(signal.statusCode) < 100 ||
      Number(signal.statusCode) > 599)
  ) {
    return { ok: false, reason: "statusCode must be an integer from 100 to 599." };
  }

  if (signal.errorCode !== undefined && !isStringInRange(signal.errorCode, 1, 120)) {
    return { ok: false, reason: "errorCode must be 1-120 characters." };
  }

  if (
    signal.installationId !== undefined &&
    !isStringInRange(signal.installationId, 1, 120)
  ) {
    return { ok: false, reason: "installationId must be 1-120 characters." };
  }

  if (
    signal.clientVersion !== undefined &&
    !isStringInRange(signal.clientVersion, 1, 80)
  ) {
    return { ok: false, reason: "clientVersion must be 1-80 characters." };
  }

  if (signal.regionHint !== undefined && !isStringInRange(signal.regionHint, 1, 40)) {
    return { ok: false, reason: "regionHint must be 1-40 characters." };
  }

  return { ok: true, kind: "signal", payload: {} };
}

function looksLikeLocalHookEvent(input: Record<string, unknown>) {
  return "surface" in input || "eventName" in input;
}

function isStringInRange(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.length >= min && value.length <= max;
}

function isValidUtcDatetime(value: string) {
  const match = ISO_DATETIME_PATTERN.exec(value);
  if (!match) return false;

  const [, year, month, day, hour, minute] = match.map(Number);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  const date = new Date(Date.parse(value));
  if (Number.isNaN(date.getTime())) return false;

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  );
}

function pickDefined(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}
