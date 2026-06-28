/** @vitest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatusDashboard } from "@/components/status-dashboard";
import type { SummaryResponse } from "@/lib/aggregation";
import { CATALOG, PROVIDERS } from "@/lib/catalog";
import type { OfficialServiceStatus } from "@/lib/official/types";
import type { SignalSummaryResponse } from "@/lib/signals/aggregation";

const summaryResponse: SummaryResponse = {
  windowMinutes: 10,
  updatedAt: "2026-05-09T00:00:00.000Z",
  services: [
    {
      serviceId: "anthropic-claude-code",
      counts: {
        slow: 2,
        error: 1,
        down: 0,
      },
      total: 3,
      communityState: "no_significant_reports",
    },
    {
      serviceId: "google-antigravity-ide",
      counts: {
        slow: 5,
        error: 2,
        down: 0,
      },
      total: 7,
      communityState: "reports_seen",
    },
  ],
};

const officialResponse = {
  updatedAt: "2026-05-09T00:00:00.000Z",
  services: [
    {
      serviceId: "anthropic-claude-code",
      overall: "operational",
      source: "official",
      updatedAt: "2026-05-09T00:00:00.000Z",
      matchedComponent: "Claude Code",
    },
  ],
} satisfies {
  updatedAt: string;
  services: OfficialServiceStatus[];
};

const signalSummaryResponse: SignalSummaryResponse = {
  windowMinutes: 10,
  updatedAt: "2026-05-09T00:00:00.000Z",
  services: [
    {
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
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("StatusDashboard", () => {
  it("loads status data, switches providers, and links to GitHub", async () => {
    const fetchMock = createFetchMock();
    const user = userEvent.setup();
    vi.stubGlobal("fetch", fetchMock);

    render(<StatusDashboard providers={PROVIDERS} services={CATALOG} />);

    expect(await screen.findByLabelText("7 recent problem signals"))
      .toBeInTheDocument();
    const claudeCodeCard = getServiceCard("Claude Code");
    expect(within(claudeCodeCard).getByText("Official status")).toBeInTheDocument();
    expect(within(claudeCodeCard).getByText("Operational")).toBeInTheDocument();
    expect(within(claudeCodeCard).getByText("Community reports")).toBeInTheDocument();
    expect(within(claudeCodeCard).getByText("Installed signals")).toBeInTheDocument();
    expect(within(claudeCodeCard).getByText("4")).toBeInTheDocument();
    expect(within(claudeCodeCard).queryByText(/installations/)).not
      .toBeInTheDocument();
    expect(within(claudeCodeCard).queryByText("Unique installations")).not
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GitHub" }))
      .toHaveAttribute("href", "https://github.com/dobbylee/notjustyou");
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
    expect(screen.queryByText(/updated/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Google" }));

    expect(screen.getByText("Antigravity IDE")).toBeInTheDocument();
    expect(screen.queryByText("Claude Code")).not.toBeInTheDocument();
  });

  it("submits reports and applies the optimistic count update", async () => {
    const fetchMock = createFetchMock();
    const user = userEvent.setup();
    vi.stubGlobal("fetch", fetchMock);

    render(<StatusDashboard providers={PROVIDERS} services={CATALOG} />);

    await screen.findByLabelText("7 recent problem signals");
    await user.click(
      within(getServiceCard("Claude Code")).getByText("Manual community report"),
    );

    await user.click(
      within(getServiceCard("Claude Code")).getByRole("button", {
        name: "Report Claude Code as slow. Current count 2.",
      }),
    );

    await screen.findByText("Thanks - counted.");
    expect(
      screen.getByRole("button", {
        name: "Report Claude Code as slow. Current count 3.",
      }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/report",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          serviceId: "anthropic-claude-code",
          status: "slow",
        }),
      }),
    );
  });

  it("keeps community reports visible when installed signal summary fails", async () => {
    const fetchMock = createFetchMock({
      failSignalSummary: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StatusDashboard providers={PROVIDERS} services={CATALOG} />);

    expect(await screen.findByLabelText("3 recent problem signals"))
      .toBeInTheDocument();
    const claudeCodeCard = getServiceCard("Claude Code");
    expect(within(claudeCodeCard).getByText("Community reports")).toBeInTheDocument();
    expect(within(claudeCodeCard).getByText("Installed signals")).toBeInTheDocument();
    expect(within(claudeCodeCard).getByText("Unavailable")).toBeInTheDocument();
    expect(within(claudeCodeCard).queryByText("Unique installations")).not
      .toBeInTheDocument();
    expect(screen.queryByText("Community reports unavailable.")).not
      .toBeInTheDocument();
  });

  it("marks installed signals unavailable when the community summary request fails", async () => {
    const fetchMock = createFetchMock({
      failCommunitySummary: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StatusDashboard providers={PROVIDERS} services={CATALOG} />);

    expect(await screen.findByText("Community reports unavailable."))
      .toBeInTheDocument();
    const claudeCodeCard = getServiceCard("Claude Code");
    expect(within(claudeCodeCard).getByText("Installed signals")).toBeInTheDocument();
    expect(within(claudeCodeCard).getByText("Unavailable")).toBeInTheDocument();
  });
});

function getServiceCard(serviceName: string) {
  const heading = screen.getByRole("heading", { name: serviceName });
  const card = heading.closest("article");

  if (!card) {
    throw new Error(`Missing service card for ${serviceName}`);
  }

  return card;
}

function createFetchMock(
  options: { failCommunitySummary?: boolean; failSignalSummary?: boolean } = {},
) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url === "/api/summary") {
      if (options.failCommunitySummary) {
        return new Response("Unavailable", {
          status: 503,
        });
      }

      return jsonResponse(summaryResponse);
    }

    if (url === "/api/official") {
      return jsonResponse(officialResponse);
    }

    if (url === "/api/signals/summary") {
      if (options.failSignalSummary) {
        return new Response("Unavailable", {
          status: 503,
        });
      }

      return jsonResponse(signalSummaryResponse);
    }

    if (url === "/api/report") {
      return jsonResponse({
        ok: true,
        counted: true,
      });
    }

    if (url === "/api/clicks") {
      return jsonResponse({
        ok: true,
      });
    }

    throw new Error(`Unhandled fetch: ${url}`);
  });
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
  });
}
