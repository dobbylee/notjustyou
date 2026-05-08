import { NextResponse } from "next/server";
import { REPORT_WINDOW_MINUTES } from "@/lib/report";
import { getReportStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const storage = getReportStorage();
  const summary = await storage.getSummary({
    windowMinutes: REPORT_WINDOW_MINUTES,
  });

  return NextResponse.json(summary);
}
