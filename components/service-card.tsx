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
  { container: string; top: string; bottom: string }
> = {
  slow: {
    container: "border-[var(--slow-button-border)] bg-white/30 backdrop-blur-xs hover:border-[var(--slow-button-text)]/50 hover:bg-white/50",
    top: "bg-[var(--slow-button-bg)] text-[var(--slow-button-text)]",
    bottom: "text-slate-900 bg-white/40",
  },
  error: {
    container: "border-[var(--error-button-border)] bg-white/30 backdrop-blur-xs hover:border-[var(--error-button-text)]/50 hover:bg-white/50",
    top: "bg-[var(--error-button-bg)] text-[var(--error-button-text)]",
    bottom: "text-slate-900 bg-white/40",
  },
  down: {
    container: "border-[var(--down-button-border)] bg-white/30 backdrop-blur-xs hover:border-[var(--down-button-text)]/50 hover:bg-white/50",
    top: "bg-[var(--down-button-bg)] text-[var(--down-button-text)]",
    bottom: "text-slate-900 bg-white/40",
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

      <div className="mt-4 grid grid-cols-3 gap-2">
        {service.reportOptions.map((status) => (
          <button
            key={status}
            type="button"
            disabled={pendingStatus !== null}
            onClick={() => onReport(service.id, status)}
            aria-label={`Report ${service.name} as ${reportLabels[status].toLowerCase()}. Current count ${summary.counts[status]}.`}
            className={clsx(
              "flex flex-col overflow-hidden rounded-xl border text-center shadow-xs transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]",
              reportButtonClassNames[status].container,
            )}
          >
            <span className={clsx("w-full py-1 text-[10px] font-bold uppercase tracking-wider border-b border-inherit", reportButtonClassNames[status].top)}>
              {pendingStatus === status ? "Sending" : reportLabels[status]}
            </span>
            <span className={clsx("w-full py-1.5 text-lg font-bold tabular-nums leading-none flex items-center justify-center grow", reportButtonClassNames[status].bottom)}>
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
