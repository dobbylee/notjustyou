import { describe, expect, it } from "vitest";
import { getCountKey, getMinuteBucket, getRecentMinuteBuckets } from "@/lib/aggregation";

describe("aggregation helpers", () => {
  it("formats UTC minute buckets", () => {
    expect(getMinuteBucket(new Date("2026-05-08T09:24:31.000Z"))).toBe(
      "202605080924",
    );
  });

  it("returns recent buckets including the current minute", () => {
    expect(getRecentMinuteBuckets(3, new Date("2026-05-08T09:24:31.000Z"))).toEqual([
      "202605080924",
      "202605080923",
      "202605080922",
    ]);
  });

  it("builds count keys", () => {
    expect(getCountKey("anthropic-claude-code", "slow", "202605080924")).toBe(
      "count:v1:anthropic-claude-code:slow:202605080924",
    );
  });
});
