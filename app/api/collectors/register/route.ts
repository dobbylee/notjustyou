import { NextResponse, type NextRequest } from "next/server";
import { classifySignalOperationalError } from "@/lib/signals/errors";
import { createCollectorRecord } from "@/lib/signals/collectors";
import { validateRegistrationRequest } from "../../signals/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const validation = await validateRegistrationRequest(request);

    if (!validation.ok) {
      return signalError(validation.reason, validation);
    }

    const collector = createCollectorRecord(validation.data);
    await validation.storage.registerCollector(collector, validation.secret);

    return NextResponse.json({
      collectorId: collector.collectorId,
      collectorToken: collector.collectorToken,
      expiresAt: null,
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
