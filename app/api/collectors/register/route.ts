import { signalError } from "@/app/api/signals/response";
import { NextResponse, type NextRequest } from "next/server";
import { classifySignalOperationalError } from "@/lib/signals/errors";
import { createCollectorRecord } from "@/lib/signals/collectors";
import { validateRegistrationRequest } from "@/lib/signals/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const validation = await validateRegistrationRequest(request);

    if (!validation.ok) {
      return signalError(validation.reason, validation);
    }

    const collector = createCollectorRecord(validation.data);
    await validation.storage.registerCollector(collector, validation.secret);

    return NextResponse.json({
      collectorId: collector.collectorId,
      collectorToken: collector.collectorToken,
      expiresAt: null,
    });
  } catch (error) {
    return signalError(classifySignalOperationalError(error));
  }
}
