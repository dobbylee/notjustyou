import { CATALOG, REPORT_STATUSES } from "../catalog";
import {
  CLICK_COUNTER_TTL_SECONDS,
  getClickCountKey,
  getClickMetricSpecs,
  getClickHourBucket,
  getRecentClickHourBuckets,
} from "../clicks";
import {
  emptyCountsByStatus,
  getCountKey,
  getMinuteBucket,
  getRecentMinuteBuckets,
  summarizeCounts,
} from "../aggregation";
import { COUNTER_TTL_SECONDS, DEDUPE_TTL_SECONDS } from "../report";
import type { RedisClient } from "../redis";
import type {
  AddClickInput,
  AddReportInput,
  ClickSummaryQuery,
  DedupeInput,
  DedupeResult,
  ReportStorage,
  SummaryQuery,
} from "./types";

export class RedisReportStorage implements ReportStorage {
  constructor(private readonly redis: RedisClient) {}

  async addReport(input: AddReportInput) {
    const now = input.now ?? new Date();
    const key = getCountKey(input.serviceId, input.status, getMinuteBucket(now));

    await this.redis.incr(key);
    await this.redis.expire(key, COUNTER_TTL_SECONDS);
  }

  async addClick(input: AddClickInput) {
    const now = input.now ?? new Date();
    const key = getClickCountKey(input.metricId, getClickHourBucket(now));

    await this.redis.incr(key);
    await this.redis.expire(key, CLICK_COUNTER_TTL_SECONDS);
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

  async getClickSummary(input: ClickSummaryQuery) {
    const now = input.now ?? new Date();
    const buckets = getRecentClickHourBuckets(input.windowHours, now);
    const specs = getClickMetricSpecs();
    const keySpecs = specs.flatMap((spec) =>
      buckets.map((bucket) => ({
        metricId: spec.id,
        key: getClickCountKey(spec.id, bucket),
      })),
    );
    const values = await this.redis.mGet(keySpecs.map((spec) => spec.key));
    const totalsByMetricId = new Map(specs.map((spec) => [spec.id, 0]));

    keySpecs.forEach((spec, index) => {
      totalsByMetricId.set(
        spec.metricId,
        (totalsByMetricId.get(spec.metricId) ?? 0) + Number(values[index] ?? 0),
      );
    });

    return {
      windowHours: input.windowHours,
      updatedAt: now.toISOString(),
      metrics: specs.map((spec) => ({
        ...spec,
        total: totalsByMetricId.get(spec.id) ?? 0,
      })),
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
