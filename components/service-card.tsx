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
    button: "hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800",
    count: "text-amber-700",
  },
  error: {
    button: "hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800",
    count: "text-rose-700",
  },
  down: {
    button: "hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800",
    count: "text-blue-700",
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
    <article className="rounded-lg border border-slate-300 bg-white p-3 shadow-sm">
      <div className="flex min-h-12 items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold tracking-tight text-slate-900">
            {service.name}
          </h2>
        </div>

        <RecentProblemTotal total={recentProblemSignalTotal} />
      </div>

      <section
        role="group"
        className="mt-3"
        aria-label={`${recentProblemSignalTotal} recent problem signals`}
      >
        <div className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-slate-50/70 text-sm">
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

      <details className="group mt-3 border-t border-slate-200 pt-2.5">
        <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 rounded-md bg-slate-50 px-3 text-xs font-semibold text-slate-600 outline-none transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500/25">
          <span>Manual community report</span>
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-slate-400 group-open:text-slate-600">
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
                "flex min-h-10 items-center justify-between rounded-md border border-slate-200 bg-white px-2.5 text-left text-xs font-semibold text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50",
                reportButtonClassNames[status].button,
              )}
            >
              <span>{pendingStatus === status ? "Sending" : reportLabels[status]}</span>
              <span
                className={clsx(
                  "font-bold tabular-nums",
                  reportButtonClassNames[status].count,
                )}
              >
                {summary.counts[status]}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-2 min-h-4 text-xs text-slate-500" aria-live="polite">
          {message}
        </div>
      </details>
    </article>
  );
}

function RecentProblemTotal({ total }: { total: number }) {
  const hasSignals = total > 0;

  return (
    <div
      className={clsx(
        "shrink-0 rounded-md border px-2 py-1 text-center",
        hasSignals
          ? "border-rose-200 bg-rose-50 text-rose-800"
          : "border-slate-200 bg-slate-50 text-slate-500",
      )}
    >
      <div className="text-[10px] font-semibold uppercase leading-none">
        recent signals
      </div>
      <div className="mt-0.5 text-lg font-extrabold leading-none tabular-nums">
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
    <div className="flex min-h-8 items-center justify-between gap-3 px-3 py-1.5">
      <div className="shrink-0 text-xs font-semibold text-slate-500">{label}</div>
      <div
        className={clsx(
          "min-w-0 text-right text-xs font-bold tabular-nums",
          pill
            ? getRowPillClassName(tone)
            : muted
              ? "text-slate-500"
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
      return "text-slate-500";
    case "default":
      return "text-slate-900";
  }
}

function getRowPillClassName(tone: "default" | "good" | "warn" | "bad" | "muted") {
  switch (tone) {
    case "good":
      return "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700";
    case "warn":
      return "rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700";
    case "bad":
      return "rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700";
    case "muted":
      return "rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-500";
    case "default":
      return "rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-900";
  }
}
