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
  it("renders service status and sends report clicks with service and status", async () => {
    const onReport = vi.fn();
    const user = userEvent.setup();

    render(
      <ServiceCard
        service={service}
        summary={summary}
        officialStatus={officialStatus}
        pendingStatus={null}
        message="Thanks - counted."
        onReport={onReport}
      />,
    );

    expect(screen.getByRole("heading", { name: "Claude Code" })).toBeInTheDocument();
    expect(screen.getByLabelText("Last 10 minutes: 3 reports")).toBeInTheDocument();
    expect(screen.getByText("Operational")).toBeInTheDocument();
    expect(screen.getByText("No significant reports")).toBeInTheDocument();
    expect(screen.getByText("Thanks - counted.")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Report Claude Code as error. Current count 1.",
      }),
    );

    expect(onReport).toHaveBeenCalledWith("anthropic-claude-code", "error");
  });

  it("disables report buttons and labels the pending status while sending", () => {
    render(
      <ServiceCard
        service={service}
        summary={summary}
        officialStatus={officialStatus}
        pendingStatus="slow"
        message={undefined}
        onReport={vi.fn()}
      />,
    );

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
      name: "Antigravity",
      surfaceType: "app",
      reportOptions: REPORT_STATUSES,
    };

    render(
      <ServiceCard
        service={serviceWithoutOfficial}
        summary={{ ...summary, serviceId: "google-antigravity" }}
        officialStatus={undefined}
        pendingStatus={null}
        message={undefined}
        onReport={vi.fn()}
      />,
    );

    expect(screen.queryByText("Unknown")).not.toBeInTheDocument();
    expect(screen.getByText("No significant reports")).toBeInTheDocument();
  });
});
