import type { SignalSymptom } from "./schema";

export interface NormalizeApiSignalInput {
  durationMs?: number;
  slowThresholdMs?: number;
  statusCode?: number;
  errorCode?: string;
  networkError?: boolean;
  timeout?: boolean;
}

export function normalizeApiSignal(input: NormalizeApiSignalInput): SignalSymptom {
  const errorCode = input.errorCode?.toLowerCase() ?? "";

  if (input.statusCode === 429 || errorCode.includes("rate")) {
    return "rate_limited";
  }

  if (input.statusCode === 401 || input.statusCode === 403) {
    return "auth_error";
  }

  if (errorCode.includes("model") && errorCode.includes("unavailable")) {
    return "model_unavailable";
  }

  if (input.timeout || input.networkError) {
    return "network_error";
  }

  if (input.statusCode && input.statusCode >= 500) {
    return "error";
  }

  if (
    input.durationMs !== undefined &&
    input.durationMs > (input.slowThresholdMs ?? 30_000)
  ) {
    return "slow";
  }

  return "unknown";
}

