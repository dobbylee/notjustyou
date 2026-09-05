import { readJsonBody } from "@/lib/http/read-json-body";
import { NextResponse, type NextRequest } from "next/server";
import { getRequestFingerprint } from "@/lib/abuse";
import { DEDUPE_TTL_SECONDS, validateReportRequest } from "@/lib/report";
import { getReportStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request, 8 * 1024);
  if (!body.ok) {
    return NextResponse.json(
      { ok: false, counted: false, reason: body.reason },
      { status: body.reason === "body_too_large" ? 413 : 400 },
    );
  }

  const validation = validateReportRequest(body.json);

  if (!validation.ok) {
    return NextResponse.json(
      {
        ok: false,
        counted: false,
        reason: validation.reason,
      },
      {
        status: 400,
      },
    );
  }

  try {
    const storage = await getReportStorage();
    const fingerprint = getRequestFingerprint(request);
    const dedupe = await storage.addReport({
      fingerprint,
      serviceId: validation.service.id,
      status: validation.status,
    });

    if (!dedupe.allowed) {
      return NextResponse.json(
        {
          ok: false,
          counted: false,
          reason: "cooldown",
          cooldownSeconds: dedupe.cooldownSeconds,
        },
        {
          status: 429,
        },
      );
    }

    return NextResponse.json({
      ok: true,
      counted: true,
      cooldownSeconds: DEDUPE_TTL_SECONDS,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        counted: false,
        reason: "redis_unavailable",
      },
      {
        status: 503,
      },
    );
  }
}
