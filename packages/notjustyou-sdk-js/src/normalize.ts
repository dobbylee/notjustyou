import type { SignalSymptom } from "./types.js";

export interface NormalizedErrorSignal {
  symptom: SignalSymptom;
  statusCode?: number;
  errorCode?: string;
}

export function normalizeOpenAiError(error: unknown): NormalizedErrorSignal {
  const statusCode = readStatusCode(error);
  const errorCode = readErrorCode(error);

  if (statusCode === 429) {
    return { symptom: "rate_limited", statusCode, ...(errorCode ? { errorCode } : {}) };
  }

  if (statusCode === 401 || statusCode === 403) {
    return { symptom: "auth_error", statusCode, ...(errorCode ? { errorCode } : {}) };
  }

  if (statusCode && statusCode >= 500) {
    return { symptom: "error", statusCode, ...(errorCode ? { errorCode } : {}) };
  }

  if (isNetworkOrTimeoutError(error)) {
    return { symptom: "network_error", ...(errorCode ? { errorCode } : {}) };
  }

  return {
    symptom: statusCode ? "error" : "unknown",
    ...(statusCode ? { statusCode } : {}),
    ...(errorCode ? { errorCode } : {}),
  };
}

function readStatusCode(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const record = error as Record<string, unknown>;
  const value = record.statusCode ?? record.status;

  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : undefined;
}

function readErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const record = error as Record<string, unknown>;
  const value = record.code ?? record.type ?? record.name;

  if (typeof value !== "string") return undefined;

  const sanitized = value.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 120);
  return sanitized || undefined;
}

function isNetworkOrTimeoutError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  const code = typeof record.code === "string" ? record.code : "";
  const name = typeof record.name === "string" ? record.name : "";

  return (
    name === "AbortError" ||
    name === "TimeoutError" ||
    name === "APIConnectionError" ||
    name === "APIConnectionTimeoutError" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN"
  );
}
