import { describe, expect, it } from "vitest";
import { summarizeMonitoring } from "@/lib/monitoring";

describe("summarizeMonitoring", () => {
  it("summarizes community, installed signal, and click totals", () => {
    const summary = summarizeMonitoring({
      now: new Date("2026-06-19T01:00:00.000Z"),
      community: {
        windowMinutes: 10,
        updatedAt: "2026-06-19T01:00:00.000Z",
        services: [
          {
            serviceId: "openai-api",
            counts: {
              slow: 1,
              error: 2,
              down: 0,
            },
            total: 3,
            communityState: "reports_seen",
          },
          {
            serviceId: "anthropic-claude-api",
            counts: {
              slow: 0,
              error: 0,
              down: 0,
            },
            total: 0,
            communityState: "no_significant_reports",
          },
        ],
      },
      installedSignals: {
        windowMinutes: 10,
        updatedAt: "2026-06-19T01:00:00.000Z",
        services: [
          {
            serviceId: "openai-api",
            countsBySource: {
              api_middleware: 4,
              cli_hook: 0,
              ide_extension: 0,
              browser_extension: 0,
              mcp_monitor: 0,
              local_probe: 0,
            },
            countsBySymptom: {
              slow: 0,
              error: 1,
              down: 0,
              rate_limited: 3,
              auth_error: 0,
              model_unavailable: 0,
              network_error: 0,
              tool_failure: 0,
              permission_blocked: 0,
              unknown: 0,
            },
            total: 4,
            uniqueInstallationsApprox: 2,
            lastSignal: null,
          },
        ],
      },
      clicks: {
        windowHours: 168,
        updatedAt: "2026-06-19T01:00:00.000Z",
        metrics: [
          {
            id: "refresh_button",
            event: "refresh_button",
            label: "Refresh button",
            total: 2,
          },
          {
            id: "copy_link",
            event: "copy_link",
            label: "Copy link",
            total: 0,
          },
        ],
      },
    });

    expect(summary).toMatchObject({
      updatedAt: "2026-06-19T01:00:00.000Z",
      windows: {
        communityMinutes: 10,
        installedSignalMinutes: 10,
        clickHours: 168,
      },
      community: {
        totalReports: 3,
        activeServices: 1,
      },
      installedSignals: {
        totalSignals: 4,
        activeServices: 1,
        installationServiceObservations: 2,
      },
      clicks: {
        totalClicks: 2,
        activeMetrics: 1,
      },
    });
    expect(summary.installedSignals.countsBySource.api_middleware).toBe(4);
    expect(summary.installedSignals.countsBySymptom.rate_limited).toBe(3);
  });
});

