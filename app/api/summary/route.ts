import { NextResponse } from "next/server";
import { REPORT_WINDOW_MINUTES } from "@/lib/report";
import { getReportStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const storage = await getReportStorage();
    const summary = await storage.getSummary({
      windowMinutes: REPORT_WINDOW_MINUTES,
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
