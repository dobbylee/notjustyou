import { NextResponse, type NextRequest } from "next/server";
import { getService } from "@/lib/catalog";
import { SIGNAL_WINDOW_MINUTES } from "@/lib/signals/aggregation";
import { getSignalStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const windowMinutes = parseWindowMinutes(searchParams.get("windowMinutes"));
  const serviceId = searchParams.get("serviceId") ?? undefined;

  if (serviceId && !getService(serviceId)) {
    return NextResponse.json(
      {
        ok: false,
        reason: "invalid_service",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const storage = await getSignalStorage();
    const summary = await storage.getSignalSummary({
      windowMinutes,
      serviceId,
    });

    return NextResponse.json(summary);
  } catch {
    return NextResponse.json(
      {
        error: "redis_unavailable",
      },
      {
        status: 503,
      },
    );
  }
}

function parseWindowMinutes(value: string | null) {
  if (!value) return SIGNAL_WINDOW_MINUTES;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 60) {
    return SIGNAL_WINDOW_MINUTES;
  }

  return parsed;
}

