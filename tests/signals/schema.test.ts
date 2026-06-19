import { describe, expect, it } from "vitest";
import {
  collectorRegistrationSchema,
  problemSignalInputSchema,
} from "@/lib/signals/schema";
import { validateSignalTimestamp } from "@/lib/signals/timestamps";

describe("problemSignalInputSchema", () => {
  it("accepts metadata-only installed-client signals", () => {
    const parsed = problemSignalInputSchema.safeParse({
      serviceId: "openai-api",
      source: "api_middleware",
      symptom: "rate_limited",
      observedAt: "2026-06-19T01:00:00.000Z",
      durationMs: 1200,
      statusCode: 429,
      errorCode: "rate_limit_exceeded",
      installationId: "random-local-id",
      clientVersion: "0.1.0",
      regionHint: "us",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects unknown services, non-installed sources, and unknown fields", () => {
    expect(
      problemSignalInputSchema.safeParse({
        serviceId: "missing-service",
        source: "api_middleware",
        symptom: "error",
      }).success,
    ).toBe(false);
    expect(
      problemSignalInputSchema.safeParse({
        serviceId: "openai-api",
        source: "manual_report",
        symptom: "error",
      }).success,
    ).toBe(false);
    expect(
      problemSignalInputSchema.safeParse({
        serviceId: "openai-api",
        source: "api_middleware",
        symptom: "error",
        collectorId: "col_123",
      }).success,
    ).toBe(false);
  });

  it("rejects stale and future observedAt values", () => {
    const now = new Date("2026-06-19T01:00:00.000Z");

    expect(validateSignalTimestamp("2026-06-19T00:44:59.000Z", now)).toEqual({
      ok: false,
      reason: "observed_at_too_old",
    });
    expect(validateSignalTimestamp("2026-06-19T01:02:01.000Z", now)).toEqual({
      ok: false,
      reason: "observed_at_in_future",
    });
    expect(validateSignalTimestamp(undefined, now)).toEqual({
      ok: true,
      observedAt: "2026-06-19T01:00:00.000Z",
      receivedAt: "2026-06-19T01:00:00.000Z",
    });
  });
});

describe("collectorRegistrationSchema", () => {
  it("limits clientName to a package-style slug", () => {
    expect(
      collectorRegistrationSchema.safeParse({
        source: "api_middleware",
        serviceIds: ["openai-api"],
        clientName: "notjustyou-sdk-js",
        clientVersion: "0.1.0",
      }).success,
    ).toBe(true);
    expect(
      collectorRegistrationSchema.safeParse({
        source: "api_middleware",
        serviceIds: ["openai-api"],
        clientName: "alice@example.com",
        clientVersion: "0.1.0",
      }).success,
    ).toBe(false);
    expect(
      collectorRegistrationSchema.safeParse({
        source: "api_middleware",
        serviceIds: ["openai-api"],
        clientName: "Alice MacBook",
        clientVersion: "0.1.0",
      }).success,
    ).toBe(false);
  });
});
