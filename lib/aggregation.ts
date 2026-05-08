import { REPORT_STATUSES, type ReportStatus } from "./catalog";
import { createEmptyCounts, getCommunityState, getTotalReports, type ReportCounts } from "./scoring";

const MINUTE_MS = 60_000;

export interface ServiceSummary {
  serviceId: string;
  counts: ReportCounts;
  total: number;
  communityState: ReturnType<typeof getCommunityState>;
}

export interface SummaryResponse {
  windowMinutes: number;
  updatedAt: string;
  services: ServiceSummary[];
}

export function getMinuteBucket(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");

  return `${year}${month}${day}${hour}${minute}`;
}

export function getRecentMinuteBuckets(windowMinutes: number, now = new Date()) {
  return Array.from({ length: windowMinutes }, (_, index) => {
    const date = new Date(now.getTime() - index * MINUTE_MS);
    return getMinuteBucket(date);
  });
}

export function getCountKey(serviceId: string, status: ReportStatus, bucket: string) {
  return `count:v1:${serviceId}:${status}:${bucket}`;
}

export function summarizeCounts(counts: ReportCounts): Omit<ServiceSummary, "serviceId"> {
  return {
    counts,
    total: getTotalReports(counts),
    communityState: getCommunityState(counts),
  };
}

export function addCounts(target: ReportCounts, status: ReportStatus, value: number) {
  target[status] += value;
}

export function emptyCountsByStatus() {
  return REPORT_STATUSES.reduce((counts, status) => {
    counts[status] = 0;
    return counts;
  }, createEmptyCounts());
}
