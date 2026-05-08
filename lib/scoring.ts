import type { ReportStatus } from "./catalog";

export type CommunityState =
  | "no_significant_reports"
  | "reports_seen"
  | "slow_reports"
  | "degraded"
  | "likely_down";

export type ReportCounts = Record<ReportStatus, number>;

export const COMMUNITY_STATE_LABELS: Record<CommunityState, string> = {
  no_significant_reports: "No significant reports",
  reports_seen: "Reports seen",
  slow_reports: "Slow reports",
  degraded: "Degraded",
  likely_down: "Likely down",
};

export function getCommunityState(summary: Partial<ReportCounts>): CommunityState {
  const slow = summary.slow ?? 0;
  const error = summary.error ?? 0;
  const down = summary.down ?? 0;

  const total = slow + error + down;
  const severe = error + down;

  if (total < 5) return "no_significant_reports";
  if (total >= 5 && total < 15) return "reports_seen";
  if (total >= 15 && severe < total * 0.5) return "slow_reports";
  if (total >= 50 && down >= total * 0.5) return "likely_down";

  return "degraded";
}

export function getTotalReports(counts: Partial<ReportCounts>) {
  return (counts.slow ?? 0) + (counts.error ?? 0) + (counts.down ?? 0);
}

export function createEmptyCounts(): ReportCounts {
  return {
    slow: 0,
    error: 0,
    down: 0,
  };
}
