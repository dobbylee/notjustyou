import { NextResponse, type NextRequest } from "next/server";
import { CLICK_WINDOW_HOURS, validateClickEvent } from "@/lib/clicks";
import { hasReadAccess } from "@/lib/read-access";
import { getReportStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        reason: "invalid_json",
      },
      {
        status: 400,
      },
    );
  }

  const validation = validateClickEvent(body);

  if (!validation.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: validation.reason,
      },
      {
        status: 400,
      },
    );
  }

  try {
    const storage = await getReportStorage();
    await storage.addClick({
      metricId: validation.metricId,
    });

    return NextResponse.json({
      ok: true,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        reason: "redis_unavailable",
      },
      {
        status: 503,
      },
    );
  }
}

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
    const storage = await getReportStorage();
    const summary = await storage.getClickSummary({
      windowHours: CLICK_WINDOW_HOURS,
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
