import { describe, expect, it } from "vitest";
import { normalizeApiSignal } from "@/lib/signals/normalization";

describe("normalizeApiSignal", () => {
  it("maps common API metadata to conservative symptoms", () => {
    expect(normalizeApiSignal({ statusCode: 429 })).toBe("rate_limited");
    expect(normalizeApiSignal({ statusCode: 401 })).toBe("auth_error");
    expect(normalizeApiSignal({ timeout: true })).toBe("network_error");
    expect(normalizeApiSignal({ statusCode: 503 })).toBe("error");
    expect(normalizeApiSignal({ durationMs: 31_000 })).toBe("slow");
    expect(normalizeApiSignal({ statusCode: 200 })).toBe("unknown");
  });
});

