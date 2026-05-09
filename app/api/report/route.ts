import { NextResponse, type NextRequest } from "next/server";
import { getRequestFingerprint } from "@/lib/abuse";
import { DEDUPE_TTL_SECONDS, validateReportRequest } from "@/lib/report";
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
        counted: false,
        reason: "invalid_json",
      },
      {
        status: 400,
      },
    );
  }

  const validation = validateReportRequest(body);

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
    const dedupe = await storage.claimDedupe({
      fingerprint,
      serviceId: validation.service.id,
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

    await storage.addReport({
      serviceId: validation.service.id,
      status: validation.status,
    });

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
