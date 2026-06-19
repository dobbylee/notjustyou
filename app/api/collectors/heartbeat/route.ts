import { NextResponse, type NextRequest } from "next/server";
import { validateHeartbeatRequest } from "../../signals/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const validation = await validateHeartbeatRequest(request);

    if (!validation.ok) {
      return signalError(validation.reason, validation);
    }

    await validation.storage.recordHeartbeat({
      collectorId: validation.collector.collectorId,
      installationId: validation.data.installationId,
      clientVersion: validation.data.clientVersion,
      secret: validation.secret,
    });

    return NextResponse.json({
      ok: true,
    });
  } catch {
    return signalError("redis_unavailable");
  }
}

function signalError(reason: string, detail?: unknown) {
  const status =
    reason === "redis_unavailable"
      ? 503
      : reason === "rate_limited"
        ? 429
        : reason === "missing_token" || reason === "invalid_token"
          ? 401
          : reason === "revoked_token"
            ? 403
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
