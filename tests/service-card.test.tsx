/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ServiceCard } from "@/components/service-card";
import type { ServiceSummary } from "@/lib/aggregation";
import { REPORT_STATUSES, type ServiceSurface } from "@/lib/catalog";
import type { OfficialServiceStatus } from "@/lib/official/types";

const service: ServiceSurface = {
  id: "anthropic-claude-code",
  providerId: "anthropic",
  name: "Claude Code",
  surfaceType: "code",
  officialStatusRef: {
    providerId: "anthropic",
    kind: "statuspage_component",
    componentName: "Claude Code",
  },
  reportOptions: REPORT_STATUSES,
};

const summary: ServiceSummary = {
  serviceId: "anthropic-claude-code",
  counts: {
    slow: 2,
    error: 1,
    down: 0,
  },
  total: 3,
  communityState: "no_significant_reports",
};

const officialStatus: OfficialServiceStatus = {
  serviceId: "anthropic-claude-code",
  overall: "operational",
  source: "official",
  updatedAt: "2026-05-09T00:00:00.000Z",
  matchedComponent: "Claude Code",
};

describe("ServiceCard", () => {
  it("keeps a long service name available in the card heading", () => {
    render(
      <ServiceCard
        service={{
          ...service,
          name: "Codex (ChatGPT Desktop)",
        }}
        summary={summary}
        communitySummaryStatus="available"
        signalSummary={undefined}
        signalSummaryStatus="available"
        officialStatus={officialStatus}
        pendingStatus={null}
        message={undefined}
        onReport={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Codex (ChatGPT Desktop)" }),
    ).toBeInTheDocument();
  });

  it("renders service status and sends report clicks with service and status", async () => {
    const onReport = vi.fn();
    const user = userEvent.setup();

    render(
      <ServiceCard
        service={service}
        summary={summary}
        communitySummaryStatus="available"
        signalSummary={undefined}
        signalSummaryStatus="available"
        officialStatus={officialStatus}
        pendingStatus={null}
        message="Thanks - counted."
        onReport={onReport}
      />,
    );

    expect(screen.getByRole("heading", { name: "Claude Code" })).toBeInTheDocument();
    expect(screen.getByLabelText("3 recent problem signals")).toBeInTheDocument();
    expect(screen.getByText("Official status")).toBeInTheDocument();
    expect(screen.getByText("Operational")).toBeInTheDocument();
    expect(screen.getByText("Community reports")).toBeInTheDocument();
    expect(screen.getByText("Installed signals")).toBeInTheDocument();
    expect(screen.queryByText(/No significant reports/)).not.toBeInTheDocument();
    expect(screen.getByText("Thanks - counted.")).toBeInTheDocument();

    await user.click(screen.getByText("Manual community report"));
    await user.click(
      screen.getByRole("button", {
        name: "Report Claude Code as error. Current count 1.",
      }),
    );

    expect(onReport).toHaveBeenCalledWith("anthropic-claude-code", "error");
  });

  it("disables fallback report buttons and labels the pending status while sending", async () => {
    const user = userEvent.setup();

    render(
      <ServiceCard
        service={service}
        summary={summary}
        communitySummaryStatus="available"
        signalSummary={undefined}
        signalSummaryStatus="available"
        officialStatus={officialStatus}
        pendingStatus="slow"
        message={undefined}
        onReport={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Manual community report"));
    const reportButtons = screen.getAllByRole("button", {
      name: /Report Claude Code as/,
    });

    expect(reportButtons).toHaveLength(3);
    reportButtons.forEach((button) => {
      expect(button).toBeDisabled();
    });
    expect(screen.getByText("Sending")).toBeInTheDocument();
  });

  it("omits the official badge when a service has no official status connection", () => {
    const serviceWithoutOfficial: ServiceSurface = {
      id: "google-antigravity",
      providerId: "google",
      name: "Antigravity 2.0",
      surfaceType: "app",
      reportOptions: REPORT_STATUSES,
    };

    render(
      <ServiceCard
        service={serviceWithoutOfficial}
        summary={{ ...summary, serviceId: "google-antigravity" }}
        communitySummaryStatus="available"
        signalSummary={undefined}
        signalSummaryStatus="available"
        officialStatus={undefined}
        pendingStatus={null}
        message={undefined}
        onReport={vi.fn()}
      />,
    );

    expect(screen.queryByText("Unknown")).not.toBeInTheDocument();
    expect(screen.getByText("Official status")).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
    expect(screen.queryByText(/No significant reports/)).not.toBeInTheDocument();
  });

  it("shows installed signal breakdown when installed signals exist", () => {
    render(
      <ServiceCard
        service={service}
        summary={summary}
        communitySummaryStatus="available"
        signalSummary={{
          serviceId: "anthropic-claude-code",
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
            error: 0,
            down: 0,
            rate_limited: 4,
            auth_error: 0,
            model_unavailable: 0,
            network_error: 0,
            tool_failure: 0,
            permission_blocked: 0,
            unknown: 0,
          },
          total: 4,
          uniqueInstallationsApprox: 2,
          lastSignal: {
            symptom: "rate_limited",
            source: "api_middleware",
            observedAt: "2026-05-09T00:00:00.000Z",
          },
        }}
        signalSummaryStatus="available"
        officialStatus={officialStatus}
        pendingStatus={null}
        message={undefined}
        onReport={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("7 recent problem signals")).toBeInTheDocument();
    expect(screen.getByText("Community reports")).toBeInTheDocument();
    expect(screen.getByText("Installed signals")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.queryByText(/installations/)).not.toBeInTheDocument();
    expect(screen.queryByText("Unique installations")).not.toBeInTheDocument();
    expect(screen.queryByText("Last installed signal: rate limited")).not
      .toBeInTheDocument();
  });

  it("distinguishes unavailable installed signals from zero installed signals", () => {
    render(
      <ServiceCard
        service={service}
        summary={summary}
        communitySummaryStatus="available"
        signalSummary={undefined}
        signalSummaryStatus="unavailable"
        officialStatus={officialStatus}
        pendingStatus={null}
        message={undefined}
        onReport={vi.fn()}
      />,
    );

    expect(screen.getByText("Installed signals")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Unique installations")).not.toBeInTheDocument();
  });

  it("does not fabricate community counts while the source is unavailable", async () => {
    const user = userEvent.setup();

    render(
      <ServiceCard
        service={service}
        summary={{
          ...summary,
          counts: { slow: 0, error: 0, down: 0 },
          total: 0,
        }}
        communitySummaryStatus="unavailable"
        signalSummary={undefined}
        signalSummaryStatus="available"
        officialStatus={officialStatus}
        pendingStatus={null}
        message={undefined}
        onReport={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Manual community report"));

    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(
      screen.getByRole("button", {
        name: "Report Claude Code as slow. Community count unavailable.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Current count 0/)).not.toBeInTheDocument();
  });

  it("hides installation wording when installed signals are zero", () => {
    render(
      <ServiceCard
        service={service}
        summary={summary}
        communitySummaryStatus="available"
        signalSummary={{
          serviceId: "anthropic-claude-code",
          countsBySource: {
            api_middleware: 0,
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
            rate_limited: 0,
            auth_error: 0,
            model_unavailable: 0,
            network_error: 0,
            tool_failure: 0,
            permission_blocked: 0,
            unknown: 0,
          },
          total: 0,
          uniqueInstallationsApprox: 0,
        }}
        signalSummaryStatus="available"
        officialStatus={officialStatus}
        pendingStatus={null}
        message={undefined}
        onReport={vi.fn()}
      />,
    );

    expect(screen.getByText("Installed signals")).toBeInTheDocument();
    expect(screen.getAllByText("0")).not.toHaveLength(0);
    expect(screen.queryByText(/installations/)).not.toBeInTheDocument();
  });
});
