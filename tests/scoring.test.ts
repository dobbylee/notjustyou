import { describe, expect, it } from "vitest";
import { getCommunityState } from "@/lib/scoring";

describe("getCommunityState", () => {
  it("returns no significant reports below five total reports", () => {
    expect(getCommunityState({ slow: 4, error: 0, down: 0 })).toBe(
      "no_significant_reports",
    );
  });

  it("returns reports seen from five to fourteen total reports", () => {
    expect(getCommunityState({ slow: 3, error: 2, down: 0 })).toBe(
      "reports_seen",
    );
  });

  it("returns slow reports when reports are mostly slow", () => {
    expect(getCommunityState({ slow: 12, error: 2, down: 1 })).toBe(
      "slow_reports",
    );
  });

  it("returns degraded when severe reports are at least half", () => {
    expect(getCommunityState({ slow: 7, error: 6, down: 2 })).toBe("degraded");
  });

  it("returns likely down when at least half of fifty reports are down", () => {
    expect(getCommunityState({ slow: 10, error: 10, down: 30 })).toBe(
      "likely_down",
    );
  });
});
