import { beforeEach, describe, expect, it } from "vitest";
import {
  checkRemoteMcpRateLimit,
  REMOTE_MCP_RATE_LIMITS,
  resetRemoteMcpRateLimitForTests,
} from "@/lib/mcp/rate-limit";

beforeEach(() => {
  resetRemoteMcpRateLimitForTests();
});

describe("remote MCP rate limit", () => {
  it("bounds one client within a fixed minute window", () => {
    const now = Date.parse("2026-08-21T00:00:00.000Z");

    for (let index = 0; index < REMOTE_MCP_RATE_LIMITS.clientPerMinute; index += 1) {
      expect(checkRemoteMcpRateLimit("client-a", now).allowed).toBe(true);
    }

    expect(checkRemoteMcpRateLimit("client-a", now)).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
  });

  it("keeps client buckets separate", () => {
    const now = Date.parse("2026-08-21T00:00:00.000Z");

    for (let index = 0; index < REMOTE_MCP_RATE_LIMITS.clientPerMinute; index += 1) {
      checkRemoteMcpRateLimit("client-a", now);
    }

    expect(checkRemoteMcpRateLimit("client-b", now).allowed).toBe(true);
  });

  it("resets the budget after the window", () => {
    const now = Date.parse("2026-08-21T00:00:00.000Z");

    for (let index = 0; index <= REMOTE_MCP_RATE_LIMITS.clientPerMinute; index += 1) {
      checkRemoteMcpRateLimit("client-a", now);
    }

    expect(checkRemoteMcpRateLimit("client-a", now + 60_000).allowed).toBe(true);
  });
});
