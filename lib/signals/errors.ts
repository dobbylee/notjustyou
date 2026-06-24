import { isSignalServerConfigError } from "./collectors";

export type SignalOperationalErrorReason =
  | "internal_error"
  | "redis_unavailable"
  | "server_config_error";

export function classifySignalOperationalError(
  error: unknown,
): SignalOperationalErrorReason {
  if (isSignalServerConfigError(error)) {
    return "server_config_error";
  }

  if (isRedisUnavailableError(error)) {
    return "redis_unavailable";
  }

  return "internal_error";
}

function isRedisUnavailableError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const code = "code" in error ? String(error.code) : "";
  if (["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND"].includes(code)) {
    return true;
  }

  const message = error.message.toLowerCase();
  return [
    "redis",
    "socket closed",
    "connection timeout",
    "connect timeout",
    "connection closed",
  ].some((pattern) => message.includes(pattern));
}
