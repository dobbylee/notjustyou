"use client";

import { clsx } from "clsx";
import type { ReportStatus, ServiceSurface } from "@/lib/catalog";
import type { ServiceSummary } from "@/lib/aggregation";
import type { OfficialServiceStatus } from "@/lib/official/types";
import type { SignalServiceSummary } from "@/lib/signals/aggregation";

interface ServiceCardProps {
  service: ServiceSurface;
  summary: ServiceSummary;
  signalSummary?: SignalServiceSummary;
  signalSummaryStatus: "loading" | "available" | "unavailable";
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
  { button: string; count: string }
> = {
  slow: {
    button: "hover:border-amber-400 hover:bg-amber-50/50 hover:text-amber-700",
    count: "text-amber-600",
  },
  error: {
    button: "hover:border-rose-400 hover:bg-rose-50/50 hover:text-rose-700",
    count: "text-rose-600",
  },
  down: {
    button: "hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-700",
    count: "text-blue-600",
  },
};

export function ServiceCard({
  service,
  summary,
  signalSummary,
  signalSummaryStatus,
  officialStatus,
  pendingStatus,
  message,
  onReport,
}: ServiceCardProps) {
  const canUseInstalledSignalSummary = signalSummaryStatus === "available";
  const installedSignalTotal = canUseInstalledSignalSummary
    ? signalSummary?.total ?? 0
    : 0;
  const recentProblemSignalTotal = summary.total + installedSignalTotal;

  return (
    <article className="rounded-xl border border-slate-200/80 bg-white/50 backdrop-blur-md p-6 transition-all duration-300 hover:border-slate-300 hover:bg-white/85 hover:shadow-md hover:shadow-slate-100">
      <div className="flex min-h-12 items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold tracking-tight text-slate-800">
            {service.name}
          </h2>
        </div>

        <RecentProblemTotal total={recentProblemSignalTotal} />
      </div>

      <section
        role="group"
        className="mt-4"
        aria-label={`${recentProblemSignalTotal} recent problem signals`}
      >
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200/60 bg-white/30 text-sm overflow-hidden">
          <SignalBreakdownRow
            label="Official status"
            value={formatOfficialStatusValue(service, officialStatus)}
            tone={getOfficialRowTone(service, officialStatus)}
            pill
          />
          <SignalBreakdownRow
            label="Community reports"
            value={summary.total}
          />
          <SignalBreakdownRow
            label="Installed signals"
            value={formatInstalledSignalValue(
              signalSummaryStatus,
              installedSignalTotal,
            )}
            muted={signalSummaryStatus !== "available"}
          />
        </div>
      </section>

      <details className="group mt-4 border-t border-slate-250/20 pt-3">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-lg bg-slate-50/10 border border-slate-200/60 px-3.5 py-2 text-sm font-bold text-slate-500 outline-none transition-all hover:bg-slate-100/70 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500/25">
          <span>Manual community report</span>
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold text-slate-400 group-open:text-slate-550">
            Fallback
          </span>
        </summary>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {service.reportOptions.map((status) => (
            <button
              key={status}
              type="button"
              disabled={pendingStatus !== null}
              onClick={() => onReport(service.id, status)}
              aria-label={`Report ${service.name} as ${reportLabels[status].toLowerCase()}. Current count ${summary.counts[status]}.`}
              className={clsx(
                "flex min-h-11 items-center justify-between rounded-lg border border-slate-200 bg-white/80 px-3 text-left text-sm font-semibold text-slate-600 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50 hover:shadow-sm",
                reportButtonClassNames[status].button,
              )}
            >
              <span>{pendingStatus === status ? "Sending" : reportLabels[status]}</span>
              <span
                className={clsx(
                  "font-extrabold font-mono",
                  reportButtonClassNames[status].count,
                )}
              >
                {summary.counts[status]}
              </span>
            </button>
          ))}
        </div>
        {message && (
          <div className="mt-2 min-h-4 text-sm text-slate-400 font-medium" aria-live="polite">
            {message}
          </div>
        )}
      </details>
    </article>
  );
}

function RecentProblemTotal({ total }: { total: number }) {
  const hasSignals = total > 0;

  return (
    <div
      className={clsx(
        "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-center transition-all",
        hasSignals
          ? "border-rose-250 bg-rose-50/70 text-rose-600 glow-rose"
          : "border-slate-200 bg-slate-50 text-slate-450",
      )}
    >
      <div className="text-xs font-bold leading-none whitespace-nowrap">
        recent signals
      </div>
      <div className="text-lg font-extrabold font-mono leading-none tabular-nums text-slate-700">
        {total}
      </div>
    </div>
  );
}

function SignalBreakdownRow({
  label,
  value,
  muted = false,
  tone = "default",
  pill = false,
}: {
  label: string;
  value: number | string;
  muted?: boolean;
  tone?: "default" | "good" | "warn" | "bad" | "muted";
  pill?: boolean;
}) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 px-3.5 py-2">
      <div className="shrink-0 text-sm font-medium text-slate-500">{label}</div>
      <div
        className={clsx(
          "min-w-0 text-right font-semibold font-mono tabular-nums",
          pill ? "text-xs" : "text-sm",
          pill
            ? getRowPillClassName(tone)
            : muted
              ? "text-slate-400"
              : getRowToneClassName(tone),
        )}
      >
        {value}
      </div>
    </div>
  );
}

function formatOfficialStatusValue(
  service: ServiceSurface,
  officialStatus: OfficialServiceStatus | undefined,
) {
  if (!service.officialStatusRef) return "Not connected";

  return officialStatus?.overall
    ? formatStatusValue(officialStatus.overall)
    : "Unknown";
}

function getOfficialRowTone(
  service: ServiceSurface,
  officialStatus: OfficialServiceStatus | undefined,
): "good" | "warn" | "bad" | "muted" {
  if (!service.officialStatusRef || !officialStatus) return "muted";

  switch (officialStatus.overall) {
    case "operational":
      return "good";
    case "degraded":
    case "maintenance":
    case "service_information":
      return "warn";
    case "partial_outage":
    case "major_outage":
      return "bad";
    case "unknown":
      return "muted";
  }
}

function formatInstalledSignalValue(
  signalSummaryStatus: ServiceCardProps["signalSummaryStatus"],
  installedSignalTotal: number,
) {
  if (signalSummaryStatus === "loading") return "Loading";
  if (signalSummaryStatus === "unavailable") return "Unavailable";

  return installedSignalTotal;
}

function formatStatusValue(status: OfficialServiceStatus["overall"]) {
  return status
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function getRowToneClassName(tone: "default" | "good" | "warn" | "bad" | "muted") {
  switch (tone) {
    case "good":
      return "text-emerald-700";
    case "warn":
      return "text-amber-700";
    case "bad":
      return "text-rose-700";
    case "muted":
      return "text-slate-400";
    case "default":
      return "text-slate-800";
  }
}

function getRowPillClassName(tone: "default" | "good" | "warn" | "bad" | "muted") {
  switch (tone) {
    case "good":
      return "rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-700 font-semibold";
    case "warn":
      return "rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-amber-700 font-semibold";
    case "bad":
      return "rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-rose-700 font-semibold";
    case "muted":
      return "rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-500 font-semibold";
    case "default":
      return "rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-700 font-semibold";
  }
}
