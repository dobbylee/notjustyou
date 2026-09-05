import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "redis";
import { RedisReportStorage } from "@/lib/storage/redis";
import { RedisSignalStorage } from "@/lib/signals/storage";
import { getCountKey } from "@/lib/aggregation";
import { getSignalBucketKey, getSignalInstallationsV2Key } from "@/lib/signals/aggregation";

const run = promisify(execFile);
const containerName = `njy-redis-test-${randomUUID()}`;
let redis: ReturnType<typeof createClient>;
let started = false;
const now = new Date("2026-09-05T00:00:00.000Z");

beforeAll(async () => {
  await run("docker", [
    "run", "--rm", "--detach", "--name", containerName,
    "--publish", "127.0.0.1::6379", "--tmpfs", "/data",
    "redis:8.2.5-alpine", "redis-server", "--save", "", "--appendonly", "no",
  ], { timeout: 90_000 });
  started = true;
  const { stdout } = await run("docker", ["port", containerName, "6379/tcp"]);
  const address = stdout.trim();
  if (!/^127\.0\.0\.1:\d+$/.test(address)) throw new Error("Expected an isolated loopback Redis port");
  redis = createClient({
    url: `redis://${address}`,
    socket: { connectTimeout: 3000, reconnectStrategy: (n) => n < 10 ? 50 : false },
  });
  redis.on("error", () => { /* connect rejects after the bounded retry budget */ });
  await redis.connect();
});

afterAll(async () => {
  if (redis?.isOpen) redis.destroy();
  if (started) await run("docker", ["rm", "--force", containerName], { timeout: 10_000 });
});

describe("Redis Lua execution", () => {
  it("counts concurrent reports once and gives the cooldown and counter TTLs", async () => {
    const storage = new RedisReportStorage(redis);
    const input = { fingerprint: "integration-client", serviceId: "openai-api" as const, status: "error" as const, now };
    const results = await Promise.all(Array.from({ length: 20 }, () => storage.addReport(input)));
    expect(results.filter((result) => result.allowed)).toHaveLength(1);
    const key = getCountKey(input.serviceId, input.status, "202609050000");
    expect(await redis.get(key)).toBe("1");
    expect(await redis.ttl(key)).toBeGreaterThan(0);
    expect(await redis.ttl("dedupe:v1:integration-client:openai-api")).toBeGreaterThan(0);
  });

  it("does not claim report cooldown when a corrupt counter rejects a write", async () => {
    const storage = new RedisReportStorage(redis);
    const key = getCountKey("openai-api", "down", "202609050000");
    await redis.set(key, "invalid");
    await expect(storage.addReport({ fingerprint: "invalid-counter-client", serviceId: "openai-api", status: "down", now })).rejects.toThrow();
    expect(await redis.get(key)).toBe("invalid");
    expect(await redis.exists("dedupe:v1:invalid-counter-client:openai-api")).toBe(0);
  });

  it("deduplicates concurrent signals while retaining source counters and installation estimates", async () => {
    const storage = new RedisSignalStorage(redis);
    const input = signalInput("sig_integration_concurrent");
    const results = await Promise.all(Array.from({ length: 20 }, () => storage.recordSignal(input)));
    expect(results.filter((result) => result.counted)).toHaveLength(1);
    const key = getSignalBucketKey("202609050000");
    expect(await redis.hGetAll(key)).toEqual({
      "total:openai-api": "1", "source:openai-api:api_middleware": "1", "symptom:openai-api:error": "1",
    });
    expect(await redis.ttl(key)).toBeGreaterThan(0);
    expect(await redis.pfCount(getSignalInstallationsV2Key("openai-api", "202609050000"))).toBe(1);
    const summary = await storage.getSignalSummary({ serviceId: "openai-api", windowMinutes: 1, now });
    expect(summary.services[0]).toMatchObject({ total: 1, uniqueInstallationsApprox: 1 });
  });

  it("leaves counters and dedupe untouched when the installation structure is corrupt", async () => {
    const storage = new RedisSignalStorage(redis);
    const input = signalInput("sig_integration_retry_after_repair", "2026-09-05T00:01:00.000Z");
    const installations = getSignalInstallationsV2Key("openai-api", "202609050001");
    await redis.set(installations, "invalid-hll");
    await expect(storage.recordSignal(input)).rejects.toThrow();
    expect(await redis.exists(getSignalBucketKey("202609050001"))).toBe(0);
    await redis.del(installations);
    await expect(storage.recordSignal(input)).resolves.toEqual({ counted: true });
    await expect(storage.recordSignal(input)).resolves.toEqual({ counted: false });
  });
});

function signalInput(signalId: string, receivedAt = now.toISOString()) {
  return {
    token: "synthetic-token", secret: "synthetic-secret",
    signal: {
      serviceId: "openai-api", collectorId: "col_integration", source: "api_middleware" as const,
      symptom: "error" as const, observedAt: receivedAt, receivedAt, installationId: "synthetic-installation", signalId,
    },
  };
}
