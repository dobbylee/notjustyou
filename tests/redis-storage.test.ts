import { describe, expect, it, vi } from "vitest";
import { CATALOG, REPORT_STATUSES } from "@/lib/catalog";
import { getCountKey, getRecentMinuteBuckets } from "@/lib/aggregation";
import type { RedisClient } from "@/lib/redis";
import { RedisReportStorage } from "@/lib/storage/redis";

describe("RedisReportStorage", () => {
  it("reads summary counters with one MGET command", async () => {
    const now = new Date("2026-05-08T09:24:31.000Z");
    const buckets = getRecentMinuteBuckets(10, now);
    const values = new Map([
      [getCountKey("anthropic-claude-code", "slow", buckets[0]), "2"],
      [getCountKey("anthropic-claude-code", "slow", buckets[1]), "3"],
      [getCountKey("anthropic-claude-code", "error", buckets[0]), "1"],
    ]);
    const redis = {
      mGet: vi.fn(async (keys: string[]) =>
        keys.map((key) => values.get(key) ?? null),
      ),
    } as unknown as RedisClient;
    const storage = new RedisReportStorage(redis);

    const summary = await storage.getSummary({
      windowMinutes: 10,
      now,
    });

    const service = summary.services.find(
      (item) => item.serviceId === "anthropic-claude-code",
    );

    expect(redis.mGet).toHaveBeenCalledTimes(1);
    expect(redis.mGet).toHaveBeenCalledWith(expect.any(Array));
    expect(redis.mGet.mock.calls[0]?.[0]).toHaveLength(
      CATALOG.length * REPORT_STATUSES.length * buckets.length,
    );
    expect(service?.counts).toEqual({
      slow: 5,
      error: 1,
      down: 0,
    });
    expect(service?.total).toBe(6);
    expect(service?.communityState).toBe("reports_seen");
  });
});
