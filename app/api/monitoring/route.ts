import { NextResponse, type NextRequest } from "next/server";
import { REPORT_WINDOW_MINUTES } from "@/lib/report";
import { CLICK_WINDOW_HOURS } from "@/lib/clicks";
import { SIGNAL_WINDOW_MINUTES } from "@/lib/signals/aggregation";
import { summarizeMonitoring } from "@/lib/monitoring";
import { hasReadAccess } from "@/lib/read-access";
import { getReportStorage, getSignalStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!hasReadAccess(request)) {
    return NextResponse.json(
      {
        error: "unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const [reportStorage, signalStorage] = await Promise.all([
      getReportStorage(),
      getSignalStorage(),
    ]);
    const [community, clicks, installedSignals] = await Promise.all([
      reportStorage.getSummary({
        windowMinutes: REPORT_WINDOW_MINUTES,
      }),
      reportStorage.getClickSummary({
        windowHours: CLICK_WINDOW_HOURS,
      }),
      signalStorage.getSignalSummary({
        windowMinutes: SIGNAL_WINDOW_MINUTES,
      }),
    ]);

    return NextResponse.json(
      summarizeMonitoring({
        community,
        clicks,
        installedSignals,
      }),
    );
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

