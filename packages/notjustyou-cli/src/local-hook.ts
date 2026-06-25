import type { CliSignalPayload, PayloadPreviewResult, SignalSymptom } from "./types.js";

const RAW_HOOK_ADAPTERS = new Set(["antigravity", "cursor", "codex"]);
const VERSION_PATTERN = /^[0-9]+(?:\.[0-9]+){0,3}(?:[-+][0-9A-Za-z.-]+)?$/;
const ALLOWED_HOOK_FIELDS = new Set([
  "serviceId",
  "surface",
  "eventName",
  "symptom",
  "observedAt",
  "durationMs",
  "statusCode",
  "errorCode",
  "clientVersion",
]);

const SURFACE_SERVICE_IDS = {
  "claude-code": "anthropic-claude-code",
  "codex-cli": "openai-codex-cli",
  "codex-app": "openai-codex-app",
  "cursor-ide": "cursor-ide",
  "antigravity-cli": "google-antigravity-cli",
  antigravity: "google-antigravity",
  "antigravity-ide": "google-antigravity-ide",
} as const;

const ANTIGRAVITY_SERVICE_IDS = new Set([
  "google-antigravity-cli",
  "google-antigravity",
  "google-antigravity-ide",
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

const ISO_DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?Z$/;

export type LocalHookSurface = keyof typeof SURFACE_SERVICE_IDS;

export type LocalHookEventResult =
  | {
      ok: true;
      payload: CliSignalPayload;
    }
  | {
      ok: false;
      reason: string;
    };

export function previewLocalHookEvent(input: Record<string, unknown>): PayloadPreviewResult {
  const result = normalizeLocalHookEvent(input);
  if (!result.ok) return result;

  return {
    ok: true,
    kind: "hook",
    payload: result.payload,
  };
}

export function normalizeLocalHookEvent(input: unknown): LocalHookEventResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      reason: "Hook fixture must be a JSON object.",
    };
  }

  if (isRawVendorHookEnvelope(input)) {
    return normalizeRawVendorHookEnvelope(input);
  }

  const event = input as Record<string, unknown>;
  const unknownFields = Object.keys(event).filter(
    (field) => !ALLOWED_HOOK_FIELDS.has(field),
  );
  if (unknownFields.length > 0) {
    return {
      ok: false,
      reason: `Unknown field rejected: ${unknownFields[0]}`,
    };
  }

  const sensitiveValue = findSensitiveStringValue(event);
  if (sensitiveValue) {
    return {
      ok: false,
      reason: `Sensitive value rejected: ${sensitiveValue}`,
    };
  }

  if (!isLocalHookSurface(event.surface)) {
    return {
      ok: false,
      reason: "surface is unsupported.",
    };
  }

  if (event.serviceId !== SURFACE_SERVICE_IDS[event.surface]) {
    return {
      ok: false,
      reason: "serviceId does not match surface.",
    };
  }

  if (!isStringInRange(event.eventName, 1, 80)) {
    return {
      ok: false,
      reason: "eventName must be 1-80 characters.",
    };
  }

  if (typeof event.symptom !== "string" || !SIGNAL_SYMPTOMS.has(event.symptom)) {
    return {
      ok: false,
      reason: "symptom is unsupported.",
    };
  }

  if (
    event.observedAt !== undefined &&
    (typeof event.observedAt !== "string" || !isValidUtcDatetime(event.observedAt))
  ) {
    return {
      ok: false,
      reason: "observedAt must be an ISO timestamp.",
    };
  }

  if (
    event.durationMs !== undefined &&
    (!Number.isInteger(event.durationMs) ||
      Number(event.durationMs) < 0 ||
      Number(event.durationMs) > 600_000)
  ) {
    return {
      ok: false,
      reason: "durationMs must be an integer from 0 to 600000.",
    };
  }

  if (
    event.statusCode !== undefined &&
    (!Number.isInteger(event.statusCode) ||
      Number(event.statusCode) < 100 ||
      Number(event.statusCode) > 599)
  ) {
    return {
      ok: false,
      reason: "statusCode must be an integer from 100 to 599.",
    };
  }

  if (event.errorCode !== undefined && !isStringInRange(event.errorCode, 1, 120)) {
    return {
      ok: false,
      reason: "errorCode must be 1-120 characters.",
    };
  }

  if (
    event.clientVersion !== undefined &&
    !isStringInRange(event.clientVersion, 1, 80)
  ) {
    return {
      ok: false,
      reason: "clientVersion must be 1-80 characters.",
    };
  }

  const payload: CliSignalPayload = {
    serviceId: event.serviceId as string,
    source: "cli_hook",
    symptom: event.symptom as SignalSymptom,
    ...pickDefined({
      observedAt: event.observedAt,
      durationMs: event.durationMs,
      statusCode: event.statusCode,
      errorCode: event.errorCode,
      clientVersion: event.clientVersion,
    }),
  };

  return {
    ok: true,
    payload,
  };
}

export function isRawVendorHookEnvelope(input: unknown): input is {
  rawHook: string;
  payload: Record<string, unknown>;
} {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return false;
  }

  const envelope = input as Record<string, unknown>;
  const fields = Object.keys(envelope);
  return (
    fields.length === 2 &&
    typeof envelope.rawHook === "string" &&
    RAW_HOOK_ADAPTERS.has(envelope.rawHook) &&
    Boolean(envelope.payload) &&
    typeof envelope.payload === "object" &&
    !Array.isArray(envelope.payload)
  );
}

function normalizeRawVendorHookEnvelope(input: {
  rawHook: string;
  payload: Record<string, unknown>;
}): LocalHookEventResult {
  if (input.rawHook === "cursor") {
    return normalizeCursorRawHook(input.payload);
  }

  if (input.rawHook === "antigravity") {
    return normalizeAntigravityRawHook(input.payload);
  }

  if (input.rawHook === "codex") {
    return normalizeCodexRawHook(input.payload);
  }

  return {
    ok: false,
    reason: "Raw hook adapter is unsupported.",
  };
}

function normalizeCursorRawHook(payload: Record<string, unknown>): LocalHookEventResult {
  const eventName = normalizeEventName(payload.hook_event_name);
  if (!eventName) {
    return {
      ok: false,
      reason: "Cursor raw hook is missing hook_event_name.",
    };
  }

  if (eventName === "stop") {
    if (payload.status !== "error") {
      return {
        ok: false,
        reason: "Cursor stop hook did not report an error status.",
      };
    }

    return {
      ok: true,
      payload: {
        serviceId: "cursor-ide",
        source: "cli_hook",
        symptom: "error",
        errorCode: "cursor_agent_error",
        ...pickDefined({
          clientVersion: normalizeOptionalString(payload.cursor_version, 1, 80),
        }),
      },
    };
  }

  if (eventName === "sessionend") {
    if (payload.reason !== "error") {
      return {
        ok: false,
        reason: "Cursor sessionEnd hook did not report an error reason.",
      };
    }

    return {
      ok: true,
      payload: {
        serviceId: "cursor-ide",
        source: "cli_hook",
        symptom: "error",
        errorCode: "cursor_session_error",
        ...pickDefined({
          durationMs: normalizeDuration(payload.duration_ms),
          clientVersion: normalizeOptionalString(payload.cursor_version, 1, 80),
        }),
      },
    };
  }

  return {
    ok: false,
    reason: "Cursor raw hook event is not a supported failure-only signal.",
  };
}

function normalizeAntigravityRawHook(
  payload: Record<string, unknown>,
): LocalHookEventResult {
  const eventName = normalizeEventName(payload.hook_event_name);
  if (!eventName) {
    return {
      ok: false,
      reason: "Antigravity raw hook is missing hook_event_name.",
    };
  }

  const serviceId = normalizeAntigravityServiceId(payload.service_id);
  if (!serviceId) {
    return {
      ok: false,
      reason: "Antigravity raw hook service_id is unsupported.",
    };
  }

  if (eventName !== "stop") {
    return {
      ok: false,
      reason: "Antigravity raw hook event is not a supported failure-only signal.",
    };
  }

  if (payload.fully_idle !== true) {
    return {
      ok: false,
      reason: "Antigravity stop hook is not fully idle.",
    };
  }

  if (
    payload.termination_reason !== undefined &&
    payload.termination_reason !== "error"
  ) {
    return {
      ok: false,
      reason: "Antigravity stop hook termination reason is unsupported.",
    };
  }

  if (payload.termination_reason !== "error" && payload.has_error !== true) {
    return {
      ok: false,
      reason: "Antigravity stop hook did not report an error.",
    };
  }

  return {
    ok: true,
    payload: {
      serviceId,
      source: "cli_hook",
      symptom: "error",
      errorCode: "antigravity_agent_error",
      ...pickDefined({
        clientVersion: normalizeOptionalString(payload.client_version, 1, 80),
      }),
    },
  };
}

function normalizeCodexRawHook(payload: Record<string, unknown>): LocalHookEventResult {
  const eventName = normalizeEventName(payload.hook_event_name);
  if (!eventName) {
    return {
      ok: false,
      reason: "Codex raw hook is missing hook_event_name.",
    };
  }

  return {
    ok: false,
    reason:
      "Codex raw hooks are not classified as service failure signals yet.",
  };
}

function normalizeAntigravityServiceId(value: unknown) {
  return typeof value === "string" && ANTIGRAVITY_SERVICE_IDS.has(value)
    ? value
    : null;
}

function isLocalHookSurface(value: unknown): value is LocalHookSurface {
  return typeof value === "string" && value in SURFACE_SERVICE_IDS;
}

function isStringInRange(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.length >= min && value.length <= max;
}

function normalizeEventName(value: unknown) {
  return typeof value === "string" ? value.toLowerCase() : null;
}

function normalizeOptionalString(value: unknown, min: number, max: number) {
  if (!isStringInRange(value, min, max)) {
    return undefined;
  }

  if (!VERSION_PATTERN.test(value)) {
    return undefined;
  }

  if (
    containsEmailLikeValue(value) ||
    containsSecretLikeValue(value) ||
    containsPathLikeValue(value)
  ) {
    return undefined;
  }

  return value;
}

function normalizeDuration(value: unknown) {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 600_000) {
    return undefined;
  }

  return value;
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

function findSensitiveStringValue(input: Record<string, unknown>) {
  for (const [field, value] of Object.entries(input)) {
    if (typeof value !== "string") continue;

    if (
      containsEmailLikeValue(value) ||
      containsSecretLikeValue(value) ||
      containsPathLikeValue(value)
    ) {
      return field;
    }
  }

  return null;
}

function containsEmailLikeValue(value: string) {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value);
}

function containsSecretLikeValue(value: string) {
  return /\b(?:Bearer\s+\S+|sk-[A-Za-z0-9_-]{8,}|njy_[A-Za-z0-9_-]+|api[_-]?key\s*[:=]|token\s*[:=]|cookie\s*[:=])/i.test(
    value,
  );
}

function containsPathLikeValue(value: string) {
  return /(?:^|[\s'"])(?:\/Users\/|\/home\/|~\/|[A-Za-z]:\\Users\\)/.test(value);
}

function pickDefined(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}
