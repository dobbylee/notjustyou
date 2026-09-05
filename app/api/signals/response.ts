import { NextResponse } from "next/server";
import type { SignalErrorReason } from "@/lib/signals/request";

export function signalError(
  reason: SignalErrorReason,
  detail?: { reason: SignalErrorReason; retryAfterSeconds?: number },
) {
  const status = reason === "redis_unavailable" || reason === "server_config_error"
    ? 503
    : reason === "internal_error" ? 500
    : reason === "missing_token" || reason === "invalid_token" ? 401
    : reason === "revoked_token" ? 403
    : reason === "rate_limited" ? 429
    : 400;
  const retryAfterSeconds = detail?.retryAfterSeconds;
  return NextResponse.json(
    { ok: false, reason, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) },
    { status },
  );
}
