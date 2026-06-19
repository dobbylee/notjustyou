import { describe, expect, it, vi } from "vitest";
import type { RedisClient } from "@/lib/redis";
import { createCollectorRecord } from "@/lib/signals/collectors";
import { getSignalCountKey, getSignalInstallationsKey } from "@/lib/signals/aggregation";
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

  it("writes signal counters, installation hashes, last signal, and TTLs", async () => {
    const redis = createRedisMock();
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
      },
    });

    expect(redis.incr).toHaveBeenCalledWith(
      getSignalCountKey("openai-api", "api_middleware", "rate_limited", "202606190100"),
    );
    expect(redis.sAdd.mock.calls[0]?.[0]).toBe(
      getSignalInstallationsKey("openai-api", "202606190100"),
    );
    expect(redis.sAdd.mock.calls[0]?.[1]).not.toBe("raw-installation");
    expect(redis.hSet).toHaveBeenCalledWith("signal:v1:last:openai-api", {
      symptom: "rate_limited",
      source: "api_middleware",
      observedAt: "2026-06-19T01:00:00.000Z",
    });
    expect(redis.expire).toHaveBeenCalled();
  });

  it("reads installed signal summaries without manual report counters", async () => {
    const now = new Date("2026-06-19T01:04:30.000Z");
    const countKey = getSignalCountKey(
      "openai-api",
      "api_middleware",
      "rate_limited",
      "202606190104",
    );
    const values = new Map([[countKey, "3"]]);
    const redis = createRedisMock({
      mGet: vi.fn(async (keys: string[]) => keys.map((key) => values.get(key) ?? null)),
      sMembers: vi.fn(async (key: string) => {
        if (key === getSignalInstallationsKey("openai-api", "202606190104")) {
          return ["install_hash_1", "install_hash_2"];
        }
        if (key === getSignalInstallationsKey("openai-api", "202606190103")) {
          return ["install_hash_1"];
        }

        return [];
      }),
      hGetAll: vi.fn(async (key: string) =>
        key === "signal:v1:last:openai-api"
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
});

function createRedisMock(overrides: Record<string, unknown> = {}) {
  return {
    hSet: vi.fn(async () => 1),
    hGetAll: vi.fn(async () => ({})),
    incr: vi.fn(async () => 1),
    expire: vi.fn(async () => true),
    sAdd: vi.fn(async () => 1),
    sMembers: vi.fn(async () => []),
    mGet: vi.fn(async (keys: string[]) => keys.map(() => null)),
    ...overrides,
  };
}
