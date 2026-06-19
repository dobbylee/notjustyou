import type { NextRequest } from "next/server";

export function hasReadAccess(request: NextRequest) {
  const token = process.env.ANALYTICS_READ_TOKEN?.trim();

  if (!token) return false;

  return request.headers.get("authorization") === `Bearer ${token}`;
}

