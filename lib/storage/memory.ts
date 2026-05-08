import { CATALOG, REPORT_STATUSES } from "../catalog";
import {
  emptyCountsByStatus,
  getCountKey,
  getMinuteBucket,
  getRecentMinuteBuckets,
  summarizeCounts,
} from "../aggregation";
import { COUNTER_TTL_SECONDS, DEDUPE_TTL_SECONDS } from "../report";
import type { ReportStorage, AddReportInput, DedupeInput, DedupeResult, SummaryQuery } from "./types";

interface ExpiringValue {
  value: number;
  expiresAt: number;
}

export class MemoryReportStorage implements ReportStorage {
  private counters = new Map<string, ExpiringValue>();
  private dedupe = new Map<string, number>();

  async addReport(input: AddReportInput) {
    const now = input.now ?? new Date();
    const key = getCountKey(input.serviceId, input.status, getMinuteBucket(now));
    const current = this.counters.get(key);

    this.counters.set(key, {
      value: (current?.value ?? 0) + 1,
      expiresAt: now.getTime() + COUNTER_TTL_SECONDS * 1000,
    });
  }

  async claimDedupe(input: DedupeInput): Promise<DedupeResult> {
    const key = this.getDedupeKey(input);
    const now = Date.now();
    const expiresAt = this.dedupe.get(key);

    if (expiresAt && expiresAt > now) {
      return {
        allowed: false,
        cooldownSeconds: Math.ceil((expiresAt - now) / 1000),
      };
    }

    this.dedupe.set(key, now + DEDUPE_TTL_SECONDS * 1000);

    return {
      allowed: true,
      cooldownSeconds: DEDUPE_TTL_SECONDS,
    };
  }

  async getSummary(input: SummaryQuery) {
    const now = input.now ?? new Date();
    const buckets = getRecentMinuteBuckets(input.windowMinutes, now);

    this.prune(now.getTime());

    return {
      windowMinutes: input.windowMinutes,
      updatedAt: now.toISOString(),
      services: CATALOG.map((service) => {
        const counts = emptyCountsByStatus();

        for (const status of REPORT_STATUSES) {
          for (const bucket of buckets) {
            const key = getCountKey(service.id, status, bucket);
            counts[status] += this.counters.get(key)?.value ?? 0;
          }
        }

        return {
          serviceId: service.id,
          ...summarizeCounts(counts),
        };
      }),
    };
  }

  private getDedupeKey(input: DedupeInput) {
    return `dedupe:v1:${input.fingerprint}:${input.serviceId}`;
  }

  private prune(now: number) {
    for (const [key, counter] of this.counters.entries()) {
      if (counter.expiresAt <= now) {
        this.counters.delete(key);
      }
    }

    for (const [key, expiresAt] of this.dedupe.entries()) {
      if (expiresAt <= now) {
        this.dedupe.delete(key);
      }
    }
  }
}
