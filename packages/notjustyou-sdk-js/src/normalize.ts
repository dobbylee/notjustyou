import type { SignalSymptom } from "./types.js";
import type { SupportedServiceId } from "./types.js";

export interface NormalizedErrorSignal {
  symptom: SignalSymptom;
  statusCode?: number;
  errorCode?: string;
}

export function normalizeOpenAiError(error: unknown): NormalizedErrorSignal {
  return normalizeByProvider("openai-api", error);
}

export function normalizeProviderError(
  serviceId: SupportedServiceId,
  error: unknown,
): NormalizedErrorSignal {
  return normalizeByProvider(serviceId, error);
}

function normalizeByProvider(
  serviceId: SupportedServiceId,
  error: unknown,
): NormalizedErrorSignal {
  const statusCode = readStatusCode(error);
  const errorCode = readErrorCode(error, serviceId);

  if (isNetworkOrTimeoutError(error)) {
    return { symptom: "network_error", ...(errorCode ? { errorCode } : {}) };
  }

  if (serviceId === "google-gemini-api" && isGeminiModelUnavailable(statusCode, errorCode)) {
    return {
      symptom: "model_unavailable",
      ...(statusCode ? { statusCode } : {}),
      ...(errorCode ? { errorCode } : {}),
    };
  }

  if (statusCode === 429 || isRateLimitedCode(errorCode)) {
    return {
      symptom: "rate_limited",
      ...(statusCode ? { statusCode } : {}),
      ...(errorCode ? { errorCode } : {}),
    };
  }

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    (serviceId === "anthropic-claude-api" && isAnthropicAuthOrBillingCode(errorCode))
  ) {
    return {
      symptom: "auth_error",
      ...(statusCode ? { statusCode } : {}),
      ...(errorCode ? { errorCode } : {}),
    };
  }

  if (statusCode && statusCode >= 500) {
    return { symptom: "error", statusCode, ...(errorCode ? { errorCode } : {}) };
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
  const value = record.statusCode ?? record.status ?? readNestedNumber(record.error, "code");

  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : undefined;
}

function readErrorCode(error: unknown, serviceId: SupportedServiceId) {
  if (!error || typeof error !== "object") return undefined;
  const record = error as Record<string, unknown>;

  if (serviceId === "google-gemini-api") {
    const geminiValue =
      readNestedString(record.error, "status") ??
      readNestedString(record.error, "type") ??
      readNestedString(record.error, "code") ??
      readString(record.code) ??
      readString(record.type) ??
      readString(record.status);

    if (geminiValue) {
      return normalizeErrorCodeValue(geminiValue);
    }

    return undefined;
  }

  const value =
    readString(record.code) ??
    readString(record.type) ??
    readNestedString(record.error, "status") ??
    readNestedString(record.error, "type") ??
    readNestedString(record.error, "code") ??
    readString(record.name);

  if (!value) return undefined;
  return normalizeErrorCodeValue(value);
}

function normalizeErrorCodeValue(value: string) {
  if (!/^[a-zA-Z][a-zA-Z0-9_.:-]{0,119}$/.test(value)) return undefined;

  return (
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value) ||
    /(?:^|[\s'"])(?:\/Users\/|\/home\/|~\/|[A-Za-z]:\\Users\\)/.test(value) ||
    /\b(?:Bearer\s+\S+|sk-[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{20,}|njy_[A-Za-z0-9_-]+|api[_-]?key\s*[:=]|token\s*[:=]|cookie\s*[:=])/i.test(value)
  )
    ? undefined
    : value;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function readNestedString(input: unknown, key: string) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  return readString((input as Record<string, unknown>)[key]);
}

function readNestedNumber(input: unknown, key: string) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "number" ? value : undefined;
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

function isRateLimitedCode(errorCode: string | undefined) {
  if (!errorCode) return false;
  const normalized = errorCode.toLowerCase();
  return (
    normalized.includes("rate_limit") ||
    normalized.includes("ratelimit") ||
    normalized.includes("quota") ||
    normalized === "resource_exhausted"
  );
}

function isAnthropicAuthOrBillingCode(errorCode: string | undefined) {
  if (!errorCode) return false;
  const normalized = errorCode.toLowerCase();
  return (
    normalized.includes("auth") ||
    normalized.includes("permission") ||
    normalized.includes("billing") ||
    normalized.includes("credit")
  );
}

function isGeminiModelUnavailable(statusCode: number | undefined, errorCode: string | undefined) {
  if (statusCode === 404 && !errorCode) return true;
  if (!errorCode) return false;
  const normalized = errorCode.toLowerCase();

  return (
    normalized.includes("model_unavailable") ||
    normalized.includes("model_not_found") ||
    (statusCode === 404 && normalized.includes("not_found"))
  );
}
