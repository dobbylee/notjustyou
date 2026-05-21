"use client";

import { clsx } from "clsx";
import type { ReportStatus, ServiceSurface } from "@/lib/catalog";
import type { ServiceSummary } from "@/lib/aggregation";
import type { OfficialServiceStatus } from "@/lib/official/types";
import { CommunityStatusBadge, OfficialStatusBadge } from "./status-badge";

interface ServiceCardProps {
  service: ServiceSurface;
  summary: ServiceSummary;
  officialStatus: OfficialServiceStatus | undefined;
  pendingStatus: ReportStatus | null;
  message: string | undefined;
  onReport: (serviceId: string, status: ReportStatus) => void;
}

const reportLabels: Record<ReportStatus, string> = {
  slow: "Slow",
  error: "Error",
  down: "Down",
};

const reportButtonClassNames: Record<
  ReportStatus,
  { container: string; label: string; count: string }
> = {
  slow: {
    container: "border-[var(--slow-button-border)] bg-[var(--slow-button-bg)] hover:bg-[var(--slow-button-bg)]/80 hover:border-[var(--slow-button-text)]/40",
    label: "text-[var(--slow-button-text)] border-[var(--slow-button-border)] bg-white/95",
    count: "text-[var(--slow-button-text)]",
  },
  error: {
    container: "border-[var(--error-button-border)] bg-[var(--error-button-bg)] hover:bg-[var(--error-button-bg)]/80 hover:border-[var(--error-button-text)]/40",
    label: "text-[var(--error-button-text)] border-[var(--error-button-border)] bg-white/95",
    count: "text-[var(--error-button-text)]",
  },
  down: {
    container: "border-[var(--down-button-border)] bg-[var(--down-button-bg)] hover:bg-[var(--down-button-bg)]/90 hover:border-[var(--down-button-label-text)]/40",
    label: "text-[var(--down-button-label-text)] border-[var(--down-button-border)] bg-white/95",
    count: "text-[var(--down-button-text)]",
  },
};

export function ServiceCard({
  service,
  summary,
  officialStatus,
  pendingStatus,
  message,
  onReport,
}: ServiceCardProps) {
  return (
    <article className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 pb-1">
        <h2 className="min-w-0 truncate text-lg font-bold tracking-tight text-slate-900">
          {service.name}
        </h2>

        <div
          className="inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-slate-200/50 bg-slate-50/50 px-2.5 text-[10px] font-semibold text-slate-400"
          aria-label={`Last 10 minutes: ${summary.total} reports`}
        >
          <span>Last 10 min</span>
          <span className="font-bold tabular-nums text-slate-600">
            {summary.total}
          </span>
          <span>reports</span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 overflow-hidden pb-1">
        <OfficialStatusBadge
          status={officialStatus?.overall ?? "unknown"}
          source={officialStatus?.source ?? getFallbackOfficialSource(service)}
        />
        <CommunityStatusBadge state={summary.communityState} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {service.reportOptions.map((status) => (
          <button
            key={status}
            type="button"
            disabled={pendingStatus !== null}
            onClick={() => onReport(service.id, status)}
            aria-label={`Report ${service.name} as ${reportLabels[status].toLowerCase()}. Current count ${summary.counts[status]}.`}
            className={clsx(
              "relative flex flex-col justify-center items-center overflow-visible rounded-xl border text-center pt-3 pb-2 min-h-[64px] shadow-xs transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]",
              reportButtonClassNames[status].container,
            )}
          >
            <span className={clsx("absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider leading-none border shadow-2xs backdrop-blur-xs", reportButtonClassNames[status].label)}>
              {pendingStatus === status ? "Sending" : reportLabels[status]}
            </span>
            <span className={clsx("text-xl font-extrabold tabular-nums leading-none mt-1", reportButtonClassNames[status].count)}>
              {summary.counts[status]}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-2 text-xs text-slate-500" aria-live="polite">
        {message}
      </div>
    </article>
  );
}

function getFallbackOfficialSource(service: ServiceSurface) {
  return service.officialStatusRef ? "official" : "not_connected";
}
