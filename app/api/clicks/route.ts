import { readJsonBody } from "@/lib/http/read-json-body";
import { NextResponse, type NextRequest } from "next/server";
import { CLICK_WINDOW_HOURS, validateClickEvent } from "@/lib/clicks";
import { hasReadAccess } from "@/lib/read-access";
import { getReportStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request, 8 * 1024);
  if (!body.ok) {
    return NextResponse.json(
      { ok: false, reason: body.reason },
      { status: body.reason === "body_too_large" ? 413 : 400 },
    );
  }

  const validation = validateClickEvent(body.json);

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
