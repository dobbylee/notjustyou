import type { Redis } from "@upstash/redis";
import { CATALOG, REPORT_STATUSES } from "../catalog";
import {
  emptyCountsByStatus,
  getCountKey,
  getMinuteBucket,
  getRecentMinuteBuckets,
  summarizeCounts,
} from "../aggregation";
import { COUNTER_TTL_SECONDS, DEDUPE_TTL_SECONDS } from "../report";
import type { AddReportInput, DedupeInput, DedupeResult, ReportStorage, SummaryQuery } from "./types";

export class RedisReportStorage implements ReportStorage {
  constructor(private readonly redis: Redis) {}

  async addReport(input: AddReportInput) {
    const now = input.now ?? new Date();
    const key = getCountKey(input.serviceId, input.status, getMinuteBucket(now));

    await this.redis.incr(key);
    await this.redis.expire(key, COUNTER_TTL_SECONDS);
  }

  async claimDedupe(input: DedupeInput): Promise<DedupeResult> {
    const key = this.getDedupeKey(input);
    const result = await this.redis.set(key, "1", {
      ex: DEDUPE_TTL_SECONDS,
      nx: true,
    });

    if (result === "OK") {
      return {
        allowed: true,
        cooldownSeconds: DEDUPE_TTL_SECONDS,
      };
    }

    const ttl = await this.redis.ttl(key);

    return {
      allowed: false,
      cooldownSeconds: Math.max(ttl, 1),
    };
  }

  async getSummary(input: SummaryQuery) {
    const now = input.now ?? new Date();
    const buckets = getRecentMinuteBuckets(input.windowMinutes, now);

    return {
      windowMinutes: input.windowMinutes,
      updatedAt: now.toISOString(),
      services: await Promise.all(
        CATALOG.map(async (service) => {
          const counts = emptyCountsByStatus();

          await Promise.all(
            REPORT_STATUSES.flatMap((status) =>
              buckets.map(async (bucket) => {
                const key = getCountKey(service.id, status, bucket);
                const value = await this.redis.get<number>(key);
                counts[status] += value ?? 0;
              }),
            ),
          );

          return {
            serviceId: service.id,
            ...summarizeCounts(counts),
          };
        }),
      ),
    };
  }

  private getDedupeKey(input: DedupeInput) {
    return `dedupe:v1:${input.fingerprint}:${input.serviceId}`;
  }
}
