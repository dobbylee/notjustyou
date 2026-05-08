import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

export function getRequestFingerprint(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const realIp = request.headers.get("x-real-ip") ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";
  const acceptLanguage = request.headers.get("accept-language") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || realIp || "unknown";

  return createHash("sha256")
    .update([ip, userAgent, acceptLanguage].join("\n"))
    .digest("hex");
}
