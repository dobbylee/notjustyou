import { describe, expect, it } from "vitest";
import { isBodyWithinSignalLimit, scanForSensitiveKeys } from "@/lib/signals/privacy";

describe("signal privacy scanner", () => {
  it("allows statusCode and errorCode metadata", () => {
    expect(
      scanForSensitiveKeys({
        serviceId: "openai-api",
        statusCode: 429,
        errorCode: "rate_limit_exceeded",
      }),
    ).toEqual({ ok: true });
  });

  it("rejects sensitive keys recursively", () => {
    for (const key of ["prompt", "headers", "body", "apiKey", "diff", "code"]) {
      expect(scanForSensitiveKeys({ nested: { [key]: "secret" } })).toEqual({
        ok: false,
        key,
      });
    }
  });

  it("enforces the 8 KB body limit", () => {
    expect(isBodyWithinSignalLimit("x".repeat(8 * 1024))).toBe(true);
    expect(isBodyWithinSignalLimit("x".repeat(8 * 1024 + 1))).toBe(false);
  });
});

