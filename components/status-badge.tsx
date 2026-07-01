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
  green: "border-[var(--green-border)] bg-[var(--green-bg)] text-[var(--green)]",
  blue: "border-[var(--blue-border)] bg-[var(--blue-bg)] text-[var(--blue)]",
  amber: "border-[var(--amber-border)] bg-[var(--amber-bg)] text-[var(--amber)]",
  red: "border-[var(--red-border)] bg-[var(--red-bg)] text-[var(--red)]",
  gray: "border-[var(--gray-border)] bg-[var(--gray-bg)] text-[var(--gray)]",
};

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-semibold transition-all duration-200 shadow-sm",
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
