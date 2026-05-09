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

const reportButtonClassNames: Record<ReportStatus, string> = {
  slow: "border-amber-200 bg-amber-50/60 text-amber-800 hover:border-amber-300 hover:bg-amber-50",
  error: "border-red-200 bg-red-50/60 text-red-700 hover:border-red-300 hover:bg-red-50",
  down: "border-slate-300 bg-slate-100 text-slate-900 hover:border-slate-400 hover:bg-slate-200",
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
    <article className="rounded-lg border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300">
      <div>
        <h2 className="truncate text-base font-semibold text-slate-950">
          {service.name}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <OfficialStatusBadge
            status={officialStatus?.overall ?? "unknown"}
            source={officialStatus?.source ?? getFallbackOfficialSource(service)}
          />
          <CommunityStatusBadge state={summary.communityState} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Last 10 min" value={summary.total} />
        <Metric label="Slow" value={summary.counts.slow} />
        <Metric label="Error" value={summary.counts.error} />
        <Metric label="Down" value={summary.counts.down} />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2">
        {service.reportOptions.map((status) => (
          <button
            key={status}
            type="button"
            disabled={pendingStatus !== null}
            onClick={() => onReport(service.id, status)}
            className={clsx(
              "h-10 rounded-md border px-3 text-sm font-semibold shadow-[0_1px_1px_rgba(15,23,42,0.03)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50",
              reportButtonClassNames[status],
            )}
          >
            {pendingStatus === status ? "Sending" : reportLabels[status]}
          </button>
        ))}
      </div>

      <div className="mt-2 text-sm text-slate-600" aria-live="polite">
        {message}
      </div>
    </article>
  );
}

function getFallbackOfficialSource(service: ServiceSurface) {
  return service.officialStatusRef ? "official" : "not_connected";
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950">
        {value}
      </div>
    </div>
  );
}
