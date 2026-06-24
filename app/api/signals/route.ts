import { NextResponse, type NextRequest } from "next/server";
import { classifySignalOperationalError } from "@/lib/signals/errors";
import { validateSignalRequest } from "./request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const validation = await validateSignalRequest(request);

    if (!validation.ok) {
      return signalError(validation.reason, validation);
    }

    await validation.storage.recordSignal({
      signal: validation.signal,
      token: validation.token,
      secret: validation.secret,
    });

    return NextResponse.json({
      ok: true,
      receivedAt: validation.signal.receivedAt,
    });
  } catch (error) {
    return signalError(classifySignalOperationalError(error));
  }
}

function signalError(reason: string, detail?: unknown) {
  const status =
    reason === "redis_unavailable" || reason === "server_config_error"
      ? 503
      : reason === "internal_error"
        ? 500
      : reason === "missing_token" || reason === "invalid_token"
      ? 401
      : reason === "revoked_token"
        ? 403
        : reason === "rate_limited"
          ? 429
          : 400;
  const retryAfterSeconds =
    detail &&
    typeof detail === "object" &&
    "retryAfterSeconds" in detail &&
    typeof detail.retryAfterSeconds === "number"
      ? detail.retryAfterSeconds
      : undefined;

  return NextResponse.json(
    {
      ok: false,
      reason,
      ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
    },
    {
      status,
    },
  );
}
