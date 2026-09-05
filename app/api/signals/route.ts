import { signalError } from "@/app/api/signals/response";
import { NextResponse, type NextRequest } from "next/server";
import { classifySignalOperationalError } from "@/lib/signals/errors";
import { validateSignalRequest } from "@/lib/signals/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const validation = await validateSignalRequest(request);

    if (!validation.ok) {
      return signalError(validation.reason, validation);
    }

    await validation.storage.recordSignal({
      signal: validation.signal,
      token: validation.token,
      secret: validation.secret,
    });

    return NextResponse.json({
      ok: true,
      receivedAt: validation.signal.receivedAt,
    });
  } catch (error) {
    return signalError(classifySignalOperationalError(error));
  }
}
