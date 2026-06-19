import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const redis = await getRedis();
    await redis.ping();

    return NextResponse.json({
      ok: true,
      redis: "ok",
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        redis: "unavailable",
        updatedAt: new Date().toISOString(),
      },
      {
        status: 503,
      },
    );
  }
}

