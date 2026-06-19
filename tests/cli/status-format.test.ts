import { describe, expect, it } from "vitest";
import { formatStatus } from "@/packages/notjustyou-cli/src/format";
import type { StatusData } from "@/packages/notjustyou-cli/src/types";

const statusData: StatusData = {
  community: {
    windowMinutes: 10,
    updatedAt: "2026-06-19T01:00:00.000Z",
    services: [
      {
        serviceId: "openai-api",
        total: 0,
        counts: {
          slow: 0,
          error: 0,
          down: 0,
        },
        communityState: "no_significant_reports",
      },
      {
        serviceId: "anthropic-claude-api",
        total: 2,
        counts: {
          slow: 1,
          error: 1,
          down: 0,
        },
        communityState: "reports_seen",
      },
    ],
  },
  installedSignals: {
    windowMinutes: 10,
    updatedAt: "2026-06-19T01:00:00.000Z",
    services: [
      {
        serviceId: "openai-api",
        total: 3,
        uniqueInstallationsApprox: 1,
        countsBySource: {
          api_middleware: 3,
          cli_hook: 0,
          ide_extension: 0,
          browser_extension: 0,
          mcp_monitor: 0,
          local_probe: 0,
        },
        countsBySymptom: {
          slow: 0,
          error: 0,
          down: 0,
          rate_limited: 3,
          auth_error: 0,
          model_unavailable: 0,
          network_error: 0,
          tool_failure: 0,
          permission_blocked: 0,
          unknown: 0,
        },
        lastSignal: {
          symptom: "rate_limited",
          source: "api_middleware",
          observedAt: "2026-06-19T01:00:00.000Z",
        },
      },
    ],
  },
  official: {
    updatedAt: "2026-06-19T01:00:00.000Z",
    services: [
      {
        serviceId: "openai-api",
        overall: "operational",
        source: "official",
        updatedAt: "2026-06-19T01:00:00.000Z",
      },
    ],
  },
};

describe("formatStatus", () => {
  it("keeps community, installed, and official status separate", () => {
    expect(formatStatus(statusData, "openai-api")).toBe(
      [
        "openai-api",
        "Community reports: 0",
        "Installed signals: 3",
        "Unique installations: 1",
        "Official: operational (official)",
        "Last installed signal: rate limited",
      ].join("\n"),
    );
  });

  it("returns a clear message for unknown services", () => {
    expect(formatStatus(statusData, "missing-service")).toBe(
      "No status found for missing-service.",
    );
  });

  it("keeps community status visible when installed signal summary is unavailable", () => {
    expect(formatStatus({ ...statusData, installedSignals: null }, "openai-api")).toBe(
      [
        "openai-api",
        "Community reports: 0",
        "Installed signals: unavailable",
        "Unique installations: unavailable",
        "Official: operational (official)",
      ].join("\n"),
    );
  });
});
