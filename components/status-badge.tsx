import { clsx } from "clsx";
import type { CommunityState } from "@/lib/scoring";
import { COMMUNITY_STATE_LABELS } from "@/lib/scoring";
import type { OfficialOverallStatus } from "@/lib/official/types";

type BadgeTone = "green" | "blue" | "amber" | "red" | "gray";

interface StatusBadgeProps {
  label: string;
  tone: BadgeTone;
}

const toneClassNames: Record<BadgeTone, string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  blue: "border-blue-200 bg-blue-50 text-blue-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  red: "border-red-200 bg-red-50 text-red-800",
  gray: "border-slate-200 bg-slate-50 text-slate-700",
};

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium shadow-[0_1px_1px_rgba(15,23,42,0.02)]",
        toneClassNames[tone],
      )}
    >
      {label}
    </span>
  );
}

export function CommunityStatusBadge({ state }: { state: CommunityState }) {
  return (
    <StatusBadge
      label={COMMUNITY_STATE_LABELS[state]}
      tone={getCommunityTone(state)}
    />
  );
}

export function OfficialStatusBadge({
  status,
  source,
}: {
  status: OfficialOverallStatus;
  source: "official" | "not_connected";
}) {
  if (source === "not_connected") {
    return null;
  }

  return <StatusBadge label={getOfficialLabel(status)} tone={getOfficialTone(status)} />;
}

function getCommunityTone(state: CommunityState): BadgeTone {
  switch (state) {
    case "no_significant_reports":
      return "green";
    case "reports_seen":
      return "blue";
    case "slow_reports":
      return "amber";
    case "degraded":
    case "likely_down":
      return "red";
  }
}

function getOfficialTone(status: OfficialOverallStatus): BadgeTone {
  switch (status) {
    case "operational":
      return "green";
    case "service_information":
      return "blue";
    case "degraded":
      return "amber";
    case "partial_outage":
    case "major_outage":
      return "red";
    case "maintenance":
      return "blue";
    case "unknown":
      return "gray";
  }
}

function getOfficialLabel(status: OfficialOverallStatus) {
  switch (status) {
    case "operational":
      return "Operational";
    case "service_information":
      return "Service information";
    case "degraded":
      return "Degraded";
    case "partial_outage":
      return "Partial outage";
    case "major_outage":
      return "Major outage";
    case "maintenance":
      return "Maintenance";
    case "unknown":
      return "Unknown";
  }
}
