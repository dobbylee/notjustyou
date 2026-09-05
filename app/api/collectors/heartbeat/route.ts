import { signalError } from "@/app/api/signals/response";
import { NextResponse, type NextRequest } from "next/server";
import { classifySignalOperationalError } from "@/lib/signals/errors";
import { validateHeartbeatRequest } from "@/lib/signals/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const validation = await validateHeartbeatRequest(request);

    if (!validation.ok) {
      return signalError(validation.reason, validation);
    }

    await validation.storage.recordHeartbeat({
      collectorId: validation.collector.collectorId,
      installationId: validation.data.installationId,
      clientVersion: validation.data.clientVersion,
      secret: validation.secret,
    });

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    return signalError(classifySignalOperationalError(error));
  }
}
