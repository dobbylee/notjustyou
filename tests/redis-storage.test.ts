import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CATALOG, REPORT_STATUSES } from "@/lib/catalog";
import { getCountKey, getRecentMinuteBuckets } from "@/lib/aggregation";
import {
  getClickCountKey,
  getClickMetricSpecs,
  getRecentClickHourBuckets,
} from "@/lib/clicks";
import type { RedisClient } from "@/lib/redis";
import {
  RECORD_REPORT_SCRIPT,
  RedisReportStorage,
} from "@/lib/storage/redis";
import { RECORD_SIGNAL_SCRIPT } from "@/lib/signals/storage";
import { getRequestFingerprint } from "@/lib/abuse";

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

  it("reads click summary counters with one MGET command", async () => {
    const now = new Date("2026-05-08T09:24:31.000Z");
    const buckets = getRecentClickHourBuckets(2, now);
    const metricId = "report_button:anthropic-claude-code:slow";
    const values = new Map([
      [getClickCountKey(metricId, buckets[0]), "2"],
      [getClickCountKey(metricId, buckets[1]), "1"],
    ]);
    const redis = {
      mGet: vi.fn(async (keys: string[]) =>
        keys.map((key) => values.get(key) ?? null),
      ),
    } as unknown as RedisClient;
    const storage = new RedisReportStorage(redis);

    const summary = await storage.getClickSummary({
      windowHours: 2,
      now,
    });

    const metric = summary.metrics.find((item) => item.id === metricId);

    expect(redis.mGet).toHaveBeenCalledTimes(1);
    expect(redis.mGet).toHaveBeenCalledWith(expect.any(Array));
    expect(redis.mGet.mock.calls[0]?.[0]).toHaveLength(
      getClickMetricSpecs().length * buckets.length,
    );
    expect(metric?.total).toBe(3);
  });

  it("claims cooldown and increments a report in one atomic operation", async () => {
    const redis = {
      eval: vi.fn().mockResolvedValueOnce([1, 180]).mockResolvedValueOnce([0, 42]),
    } as unknown as RedisClient;
    const storage = new RedisReportStorage(redis);
    const input = {
      fingerprint: "stable-client-hash",
      serviceId: "openai-api" as const,
      status: "error" as const,
      now: new Date("2026-05-08T09:24:31.000Z"),
    };

    await expect(storage.addReport(input)).resolves.toEqual({
      allowed: true,
      cooldownSeconds: 180,
    });
    await expect(storage.addReport(input)).resolves.toEqual({
      allowed: false,
      cooldownSeconds: 42,
    });
    expect(redis.eval).toHaveBeenCalledTimes(2);
    expect(redis.eval.mock.calls[0]?.[1].keys).toHaveLength(2);
  });

  it("validates the report counter before incrementing and claiming cooldown", () => {
    const cooldownClaim = scriptPosition(
      RECORD_REPORT_SCRIPT,
      'redis.call("SET", KEYS[1], "1"',
    );

    expect(scriptPosition(RECORD_REPORT_SCRIPT, 'redis.call("TYPE", KEYS[2])'))
      .toBeLessThan(scriptPosition(RECORD_REPORT_SCRIPT, 'redis.call("INCR", KEYS[2])'));
    expect(scriptPosition(RECORD_REPORT_SCRIPT, 'redis.call("GET", KEYS[2])'))
      .toBeLessThan(scriptPosition(RECORD_REPORT_SCRIPT, 'redis.call("INCR", KEYS[2])'));
    expect(scriptPosition(RECORD_REPORT_SCRIPT, 'redis.call("INCR", KEYS[2])'))
      .toBeLessThan(cooldownClaim);
    expect(scriptPosition(RECORD_REPORT_SCRIPT, 'redis.call("EXPIRE", KEYS[2]'))
      .toBeLessThan(cooldownClaim);
  });

  it("validates signal Redis values before counters and claims dedupe last", () => {
    const firstCounterWrite = scriptPosition(
      RECORD_SIGNAL_SCRIPT,
      'redis.call("HINCRBY", KEYS[2]',
    );
    const dedupeClaim = scriptPosition(
      RECORD_SIGNAL_SCRIPT,
      'redis.call("SET", KEYS[1], "1"',
    );

    expect(scriptPosition(RECORD_SIGNAL_SCRIPT, 'redis.call("TYPE", KEYS[2])'))
      .toBeLessThan(firstCounterWrite);
    expect(scriptPosition(RECORD_SIGNAL_SCRIPT, 'redis.call("HGET", KEYS[2]'))
      .toBeLessThan(firstCounterWrite);
    expect(scriptPosition(RECORD_SIGNAL_SCRIPT, 'redis.call("TYPE", KEYS[4])'))
      .toBeLessThan(firstCounterWrite);
    expect(scriptPosition(RECORD_SIGNAL_SCRIPT, 'redis.pcall("PFCOUNT", KEYS[3])'))
      .toBeLessThan(firstCounterWrite);
    expect(firstCounterWrite).toBeLessThan(dedupeClaim);
    expect(scriptPosition(RECORD_SIGNAL_SCRIPT, 'redis.call("PFADD", KEYS[3]'))
      .toBeLessThan(dedupeClaim);
    expect(scriptPosition(RECORD_SIGNAL_SCRIPT, 'redis.call("HSET", KEYS[4]'))
      .toBeLessThan(dedupeClaim);
    expect(scriptPosition(RECORD_SIGNAL_SCRIPT, 'redis.call("EXPIRE", KEYS[4]'))
      .toBeLessThan(dedupeClaim);
  });

  it("keeps report cooldown identity stable across user-agent rotation", async () => {
    const redis = {
      eval: vi.fn().mockResolvedValueOnce([1, 180]).mockResolvedValueOnce([0, 180]),
    } as unknown as RedisClient;
    const storage = new RedisReportStorage(redis);
    const firstFingerprint = getRequestFingerprint(
      requestWithHeaders({
        "x-forwarded-for": "198.51.100.2, 203.0.113.9",
        "user-agent": "client-a",
        "accept-language": "en-US",
      }),
    );
    const secondFingerprint = getRequestFingerprint(
      requestWithHeaders({
        "x-forwarded-for": "192.0.2.44, 203.0.113.9",
        "user-agent": "client-b",
        "accept-language": "ko-KR",
      }),
    );

    await storage.addReport({
      fingerprint: firstFingerprint,
      serviceId: "openai-api",
      status: "error",
    });
    await storage.addReport({
      fingerprint: secondFingerprint,
      serviceId: "openai-api",
      status: "error",
    });

    expect(firstFingerprint).toBe(secondFingerprint);
    expect(redis.eval.mock.calls[0]?.[1].keys[0]).toBe(
      redis.eval.mock.calls[1]?.[1].keys[0],
    );
  });
});

function requestWithHeaders(headers: Record<string, string>) {
  return new NextRequest("http://localhost/api/report", { headers });
}

function scriptPosition(script: string, fragment: string) {
  const position = script.indexOf(fragment);
  expect(position, `Missing Lua fragment: ${fragment}`).toBeGreaterThanOrEqual(0);
  return position;
}
