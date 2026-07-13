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
  ReportStorage,
  SummaryQuery,
} from "./types";

export class RedisReportStorage implements ReportStorage {
  constructor(private readonly redis: RedisClient) {}

  async addReport(input: AddReportInput) {
    const now = input.now ?? new Date();
    const countKey = getCountKey(input.serviceId, input.status, getMinuteBucket(now));
    const dedupeKey = this.getDedupeKey(input);
    const result = (await this.redis.eval(RECORD_REPORT_SCRIPT, {
      keys: [dedupeKey, countKey],
      arguments: [String(DEDUPE_TTL_SECONDS), String(COUNTER_TTL_SECONDS)],
    })) as [number, number];

    return result[0] === 1
      ? {
          allowed: true as const,
          cooldownSeconds: result[1],
        }
      : {
          allowed: false as const,
          cooldownSeconds: Math.max(result[1], 1),
        };
  }

  async addClick(input: AddClickInput) {
    const now = input.now ?? new Date();
    const key = getClickCountKey(input.metricId, getClickHourBucket(now));

    await this.redis.incr(key);
    await this.redis.expire(key, CLICK_COUNTER_TTL_SECONDS);
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

  private getDedupeKey(input: AddReportInput) {
    return `dedupe:v1:${input.fingerprint}:${input.serviceId}`;
  }
}

export const RECORD_REPORT_SCRIPT = `
local countType = redis.call("TYPE", KEYS[2]).ok
if countType ~= "none" and countType ~= "string" then
  return redis.error_reply("report counter has an invalid Redis type")
end
local countValue = redis.call("GET", KEYS[2])
if countValue then
  local negative = string.match(countValue, "^%-[1-9]%d*$") ~= nil
  local positive = countValue == "0" or string.match(countValue, "^[1-9]%d*$") ~= nil
  if not negative and not positive then
    return redis.error_reply("report counter is not an integer")
  end
  local digits = negative and string.sub(countValue, 2) or countValue
  local normalized = string.gsub(digits, "^0+", "")
  if normalized == "" then normalized = "0" end
  local outOfRange = string.len(normalized) > 19
    or (string.len(normalized) == 19 and negative and normalized > "9223372036854775808")
    or (string.len(normalized) == 19 and not negative and normalized >= "9223372036854775807")
  if outOfRange then
    return redis.error_reply("report counter cannot be incremented")
  end
end
local existing = redis.call("EXISTS", KEYS[1])
if existing == 1 then
  return {0, redis.call("TTL", KEYS[1])}
end
redis.call("INCR", KEYS[2])
redis.call("EXPIRE", KEYS[2], ARGV[2])
redis.call("SET", KEYS[1], "1", "EX", ARGV[1])
return {1, tonumber(ARGV[1])}
`;
