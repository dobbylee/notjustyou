import { describe, expect, it, vi } from "vitest";
import type { RedisClient } from "@/lib/redis";
import { CATALOG } from "@/lib/catalog";
import { createCollectorRecord } from "@/lib/signals/collectors";
import {
  getSignalBucketKey,
  getSignalCountKey,
  getSignalInstallationsKey,
  getSignalInstallationsV2Key,
} from "@/lib/signals/aggregation";
import { RedisSignalStorage } from "@/lib/signals/storage";

describe("RedisSignalStorage", () => {
  it("stores collector metadata by HMAC token lookup without raw token", async () => {
    const redis = createRedisMock();
    const storage = new RedisSignalStorage(redis as unknown as RedisClient);
    const collector = createCollectorRecord({
      source: "api_middleware",
      serviceIds: ["openai-api"],
      clientName: "notjustyou-sdk-js",
      clientVersion: "0.1.0",
    });

    await storage.registerCollector(collector, "secret");

    expect(redis.hSet).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(redis.hSet.mock.calls)).not.toContain(collector.collectorToken);
  });

  it("writes sparse counters, installation hashes, last signal, and TTLs atomically", async () => {
    const redis = createRedisMock({ eval: vi.fn(async () => 1) });
    const storage = new RedisSignalStorage(redis as unknown as RedisClient);

    await storage.recordSignal({
      token: "njy_token",
      secret: "secret",
      signal: {
        collectorId: "col_123",
        serviceId: "openai-api",
        source: "api_middleware",
        symptom: "rate_limited",
        observedAt: "2026-06-19T01:00:00.000Z",
        receivedAt: "2026-06-19T01:00:02.000Z",
        installationId: "raw-installation",
        signalId: "sig_0123456789abcdef",
      },
    });

    expect(redis.eval).toHaveBeenCalledTimes(1);
    const options = redis.eval.mock.calls[0]?.[1];
    expect(options.keys).toEqual(
      expect.arrayContaining([
        getSignalBucketKey("202606190100"),
        getSignalInstallationsV2Key("openai-api", "202606190100"),
        "signal:v1:last:openai-api",
      ]),
    );
    expect(JSON.stringify(options.arguments)).not.toContain("raw-installation");
  });

  it("counts a retried signalId exactly once per collector", async () => {
    const redis = createRedisMock({
      eval: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
    });
    const storage = new RedisSignalStorage(redis as unknown as RedisClient);
    const input = {
      token: "njy_token",
      secret: "secret",
      signal: {
        collectorId: "col_123",
        serviceId: "openai-api" as const,
        source: "api_middleware" as const,
        symptom: "error" as const,
        observedAt: "2026-06-19T01:00:00.000Z",
        receivedAt: "2026-06-19T01:00:02.000Z",
        signalId: "sig_0123456789abcdef",
      },
    };

    await expect(storage.recordSignal(input)).resolves.toEqual({ counted: true });
    await expect(storage.recordSignal(input)).resolves.toEqual({ counted: false });
    expect(redis.eval.mock.calls[0]?.[1].keys[0]).toBe(
      redis.eval.mock.calls[1]?.[1].keys[0],
    );
    expect(redis.eval.mock.calls[0]?.[1].keys[0]).not.toContain(
      "sig_0123456789abcdef",
    );
  });

  it("reads installed signal summaries without manual report counters", async () => {
    const now = new Date("2026-06-19T01:04:30.000Z");
    const redis = createRedisMock({
      pfCount: vi.fn(async () => 2),
      hGetAll: vi.fn(async (key: string) =>
        key === getSignalBucketKey("202606190104")
          ? {
              "total:openai-api": "3",
              "source:openai-api:api_middleware": "3",
              "symptom:openai-api:rate_limited": "3",
            }
          : key === "signal:v1:last:openai-api"
          ? {
              symptom: "rate_limited",
              source: "api_middleware",
              observedAt: "2026-06-19T01:04:00.000Z",
            }
          : {},
      ),
    });
    const storage = new RedisSignalStorage(redis as unknown as RedisClient);

    const summary = await storage.getSignalSummary({
      windowMinutes: 10,
      now,
      serviceId: "openai-api",
    });

    expect(summary.services).toHaveLength(1);
    expect(summary.services[0]?.total).toBe(3);
    expect(summary.services[0]?.countsBySource.api_middleware).toBe(3);
    expect(summary.services[0]?.countsBySymptom.rate_limited).toBe(3);
    expect(summary.services[0]?.uniqueInstallationsApprox).toBe(2);
    expect(summary.services[0]?.lastSignal).toEqual({
      symptom: "rate_limited",
      source: "api_middleware",
      observedAt: "2026-06-19T01:04:00.000Z",
    });
    expect(redis.hGetAll).toHaveBeenCalledTimes(11);
    expect(redis.pfCount).toHaveBeenCalledTimes(1);
    expect(redis.sMembers).not.toHaveBeenCalled();
  });

  it("includes v1 counters written just after cutover during rolling deployment", async () => {
    const now = new Date("2026-06-19T01:04:30.000Z");
    const legacyCountKey = getSignalCountKey(
      "openai-api",
      "api_middleware",
      "rate_limited",
      "202606190103",
    );
    const legacyInstallationsKey = getSignalInstallationsKey(
      "openai-api",
      "202606190103",
    );
    const redis = createRedisMock({
      eval: vi.fn(async () => "202606190102"),
      hGetAll: vi.fn(async (key: string) =>
        key === getSignalBucketKey("202606190103")
          ? {
              "total:openai-api": "3",
              "source:openai-api:api_middleware": "3",
              "symptom:openai-api:rate_limited": "3",
            }
          : {},
      ),
      mGet: vi.fn(async (keys: string[]) =>
        keys.map((key) => (key === legacyCountKey ? "2" : null)),
      ),
      sMembers: vi.fn(async (key: string) =>
        key === legacyInstallationsKey ? ["legacy-installation"] : [],
      ),
      pfCount: vi.fn(async () => 2),
    });
    const storage = new RedisSignalStorage(redis as unknown as RedisClient);

    const summary = await storage.getSignalSummary({
      windowMinutes: 10,
      now,
      serviceId: "openai-api",
    });

    expect(summary.services[0]).toMatchObject({
      total: 5,
      uniqueInstallationsApprox: 3,
      countsBySource: { api_middleware: 5 },
      countsBySymptom: { rate_limited: 5 },
    });
    expect(redis.mGet).toHaveBeenCalledWith(
      expect.arrayContaining([legacyCountKey]),
    );
    expect(redis.sMembers).toHaveBeenCalledWith(legacyInstallationsKey);
  });

  it("keeps compact all-service summary bounded without installation reads", async () => {
    const redis = createRedisMock({
      eval: vi.fn(async () => "202606180000"),
    });
    const storage = new RedisSignalStorage(redis as unknown as RedisClient);

    await storage.getSignalSummary({
      windowMinutes: 60,
      now: new Date("2026-06-19T01:04:30.000Z"),
    });

    expect(redis.hGetAll).toHaveBeenCalledTimes(60 + CATALOG.length);
    expect(redis.pfCount).not.toHaveBeenCalled();
    expect(redis.mGet).not.toHaveBeenCalled();
    expect(redis.sMembers).not.toHaveBeenCalled();
  });

  it("hard-limits collector volume but only soft-flags service volume", async () => {
    const redis = createRedisMock({
      incr: vi
        .fn()
        .mockResolvedValueOnce(61)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(301),
    });
    const storage = new RedisSignalStorage(redis as unknown as RedisClient);

    await expect(
      storage.checkSignalRateLimits({
        collectorId: "col_123",
        serviceId: "openai-api",
        secret: "secret",
      }),
    ).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });

    await expect(
      storage.checkSignalRateLimits({
        collectorId: "col_123",
        serviceId: "openai-api",
        secret: "secret",
      }),
    ).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 60,
      serviceSoftLimited: true,
    });
  });

  it("rate-limits heartbeats by collector and installation", async () => {
    const redis = createRedisMock({
      incr: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(21),
    });
    const storage = new RedisSignalStorage(redis as unknown as RedisClient);

    await expect(
      storage.checkHeartbeatRateLimits({
        collectorId: "col_123",
        installationId: "raw-installation",
        secret: "secret",
      }),
    ).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });

    expect(redis.incr).toHaveBeenCalledTimes(2);
  });

  it("uses one stable minute guard key for repeated collector registration", async () => {
    const redis = createRedisMock({
      incr: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(21),
    });
    const storage = new RedisSignalStorage(redis as unknown as RedisClient);
    const now = new Date("2026-06-19T01:00:02.000Z");

    await expect(storage.checkRegistrationRateLimit("stable-client", now)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 60,
    });
    await expect(storage.checkRegistrationRateLimit("stable-client", now)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    expect(redis.incr.mock.calls[0]?.[0]).toBe(redis.incr.mock.calls[1]?.[0]);
  });
});

function createRedisMock(overrides: Record<string, unknown> = {}) {
  return {
    hSet: vi.fn(async () => 1),
    hGetAll: vi.fn(async () => ({})),
    incr: vi.fn<(key: string) => Promise<number>>(async () => 1),
    expire: vi.fn(async () => true),
    sAdd: vi.fn(async () => 1),
    sMembers: vi.fn(async () => []),
    mGet: vi.fn(async (keys: string[]) => keys.map(() => null)),
    pfCount: vi.fn(async () => 0),
    eval: vi.fn<(script: string, options: { keys: string[]; arguments: string[] }) => Promise<number>>(async () => 1),
    ...overrides,
  };
}
