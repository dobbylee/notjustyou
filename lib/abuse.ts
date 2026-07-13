import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

export function getRequestFingerprint(request: NextRequest) {
  const address = getTrustedClientAddress(request);

  return createHash("sha256").update(address).digest("hex");
}

export function getTrustedClientAddress(request: NextRequest) {
  if (process.env.VERCEL === "1") {
    const vercelForwardedFor = request.headers
      .get("x-vercel-forwarded-for")
      ?.trim();
    if (vercelForwardedFor) return vercelForwardedFor;
  }

  // NextRequest does not expose the direct socket address. Outside the
  // deployment proxy we therefore use one shared, conservative abuse bucket
  // instead of trusting client-controlled forwarding headers.
  return "unknown";
}
