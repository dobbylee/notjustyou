import { NextResponse } from "next/server";
import { getOfficialSummary } from "@/lib/official";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const summary = await getOfficialSummary();

  return NextResponse.json(summary);
}
