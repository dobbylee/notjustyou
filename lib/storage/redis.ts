import { CATALOG, REPORT_STATUSES } from "../catalog";
import {
  emptyCountsByStatus,
  getCountKey,
  getMinuteBucket,
  getRecentMinuteBuckets,
  summarizeCounts,
} from "../aggregation";
import { COUNTER_TTL_SECONDS, DEDUPE_TTL_SECONDS } from "../report";
import type { RedisClient } from "../redis";
import type { AddReportInput, DedupeInput, DedupeResult, ReportStorage, SummaryQuery } from "./types";

export class RedisReportStorage implements ReportStorage {
  constructor(private readonly redis: RedisClient) {}

  async addReport(input: AddReportInput) {
    const now = input.now ?? new Date();
    const key = getCountKey(input.serviceId, input.status, getMinuteBucket(now));

    await this.redis.incr(key);
    await this.redis.expire(key, COUNTER_TTL_SECONDS);
  }

  async claimDedupe(input: DedupeInput): Promise<DedupeResult> {
    const key = this.getDedupeKey(input);
    const result = await this.redis.set(key, "1", {
      expiration: {
        type: "EX",
        value: DEDUPE_TTL_SECONDS,
      },
      condition: "NX",
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
    const keySpecs = CATALOG.flatMap((service) =>
      REPORT_STATUSES.flatMap((status) =>
        buckets.map((bucket) => ({
          serviceId: service.id,
          status,
          key: getCountKey(service.id, status, bucket),
        })),
      ),
    );
    const values = await this.redis.mGet(keySpecs.map((spec) => spec.key));
    const countsByServiceId = new Map(
      CATALOG.map((service) => [service.id, emptyCountsByStatus()]),
    );

    keySpecs.forEach((spec, index) => {
      const counts = countsByServiceId.get(spec.serviceId);
      if (!counts) return;

      counts[spec.status] += Number(values[index] ?? 0);
    });

    return {
      windowMinutes: input.windowMinutes,
      updatedAt: now.toISOString(),
      services: CATALOG.map((service) => ({
        serviceId: service.id,
        ...summarizeCounts(countsByServiceId.get(service.id) ?? emptyCountsByStatus()),
      })),
    };
  }

  private getDedupeKey(input: DedupeInput) {
    return `dedupe:v1:${input.fingerprint}:${input.serviceId}`;
  }
}
