import { NextResponse, type NextRequest } from "next/server";
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
  } catch {
    return signalError("redis_unavailable");
  }
}

function signalError(reason: string, detail?: unknown) {
  const status =
    reason === "redis_unavailable" ? 503 : reason === "rate_limited" ? 429 : 400;
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
