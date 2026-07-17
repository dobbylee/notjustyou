/** @vitest-environment jsdom */

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatusDashboard } from "@/components/status-dashboard";
import type { SummaryResponse } from "@/lib/aggregation";
import { CATALOG, PROVIDERS } from "@/lib/catalog";
import type {
  OfficialProviderAdvisory,
  OfficialServiceStatus,
} from "@/lib/official/types";
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
  providerAdvisories: [],
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
  providerAdvisories: OfficialProviderAdvisory[];
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
  vi.useRealTimers();
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
    expect(screen.getByText("Antigravity 2.0")).toBeInTheDocument();
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

  it("shows componentless incidents once at provider scope", async () => {
    const fetchMock = createFetchMock({
      official: {
        ...officialResponse,
        providerAdvisories: [
          {
            providerId: "openai",
            id: "provider-advisory",
            name: "Enterprise access advisory",
            status: "identified",
            impact: "none",
            updatedAt: "2026-07-18T00:00:00.000Z",
          },
        ],
      },
    });
    const user = userEvent.setup();
    vi.stubGlobal("fetch", fetchMock);

    render(<StatusDashboard providers={PROVIDERS} services={CATALOG} />);

    expect(await screen.findByLabelText("7 recent problem signals"))
      .toBeInTheDocument();
    expect(screen.queryByText("Enterprise access advisory")).not
      .toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "OpenAI" }));

    const advisory = screen.getByRole("status", {
      name: "OpenAI official provider advisories",
    });
    expect(within(advisory).getByText("Enterprise access advisory"))
      .toBeInTheDocument();
    expect(screen.queryByText("Operational · Advisory")).not.toBeInTheDocument();
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

  it("keeps installed signals available when the community summary request fails", async () => {
    const fetchMock = createFetchMock({
      failCommunitySummary: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StatusDashboard providers={PROVIDERS} services={CATALOG} />);

    expect(await screen.findByText("Community reports unavailable."))
      .toBeInTheDocument();
    const claudeCodeCard = getServiceCard("Claude Code");
    expect(within(claudeCodeCard).getByText("Community reports")).toBeInTheDocument();
    expect(within(claudeCodeCard).getByText("Unavailable")).toBeInTheDocument();
    expect(within(claudeCodeCard).getByText("Installed signals")).toBeInTheDocument();
    expect(within(claudeCodeCard).getAllByText("4")).toHaveLength(2);
    expect(within(claudeCodeCard).getByLabelText("4 recent problem signals"))
      .toBeInTheDocument();
  });

  it("keeps last successful source values visible through a transient failure", async () => {
    const baseFetchMock = createFetchMock();
    let failRefresh = false;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (
        failRefresh &&
        (url === "/api/summary" ||
          url === "/api/signals/summary" ||
          url === "/api/official")
      ) {
        return Promise.resolve(new Response("Unavailable", { status: 503 }));
      }
      return baseFetchMock(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StatusDashboard providers={PROVIDERS} services={CATALOG} />);

    expect(await screen.findByLabelText("7 recent problem signals"))
      .toBeInTheDocument();
    failRefresh = true;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(await screen.findByText("Community reports unavailable."))
      .toBeInTheDocument();
    const card = getServiceCard("Claude Code");
    expect(within(card).getByText("3 (stale)")).toBeInTheDocument();
    expect(within(card).getByText("4 (stale)")).toBeInTheDocument();
    expect(within(card).getByText("Operational")).toBeInTheDocument();
    expect(within(card).getByLabelText("7 recent problem signals"))
      .toBeInTheDocument();

    failRefresh = false;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => {
      expect(within(card).queryByText(/\(stale\)/)).not.toBeInTheDocument();
    });
  });

  it("coalesces slow polls instead of starving their successful response", async () => {
    vi.useFakeTimers();
    const slowSummary = deferred<Response>();
    const baseFetchMock = createFetchMock();
    let communitySummaryCalls = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/summary") {
        communitySummaryCalls += 1;
        if (communitySummaryCalls === 1) return slowSummary.promise;
      }
      return baseFetchMock(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StatusDashboard providers={PROVIDERS} services={CATALOG} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(communitySummaryCalls).toBe(1);

    slowSummary.resolve(jsonResponse(summaryResponse));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByLabelText("7 recent problem signals")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(communitySummaryCalls).toBe(2);
  });

  it("refreshes official status on its own interval and when the page becomes visible", async () => {
    vi.useFakeTimers();
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<StatusDashboard providers={PROVIDERS} services={CATALOG} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(countFetches(fetchMock, "/api/official")).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_999);
    });
    expect(countFetches(fetchMock, "/api/official")).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(countFetches(fetchMock, "/api/official")).toBe(2);

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });
    expect(countFetches(fetchMock, "/api/official")).toBe(3);
  });

  it("does not let a stale poll overwrite an accepted optimistic report", async () => {
    const staleSummary = deferred<Response>();
    const baseFetchMock = createFetchMock();
    let communitySummaryCalls = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/summary") {
        communitySummaryCalls += 1;
        if (communitySummaryCalls === 2) {
          return staleSummary.promise;
        }
      }

      return baseFetchMock(input, init);
    });
    const user = userEvent.setup();
    vi.stubGlobal("fetch", fetchMock);

    render(<StatusDashboard providers={PROVIDERS} services={CATALOG} />);

    expect(await screen.findByLabelText("7 recent problem signals"))
      .toBeInTheDocument();

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(communitySummaryCalls).toBe(2);

    await user.click(
      within(getServiceCard("Claude Code")).getByText("Manual community report"),
    );
    await user.click(
      within(getServiceCard("Claude Code")).getByRole("button", {
        name: "Report Claude Code as slow. Current count 2.",
      }),
    );
    expect(screen.getByText("Thanks - counted.")).toBeInTheDocument();

    staleSummary.resolve(jsonResponse(summaryResponse));
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByRole("button", {
        name: "Report Claude Code as slow. Current count 3.",
      }),
    ).toBeInTheDocument();
  });

  it("runs an authoritative refresh after a rejected report", async () => {
    const reportResponse = deferred<Response>();
    const baseFetchMock = createFetchMock();
    let communitySummaryCalls = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/summary") communitySummaryCalls += 1;
      if (url === "/api/report") return reportResponse.promise;
      return baseFetchMock(input, init);
    });
    const user = userEvent.setup();
    vi.stubGlobal("fetch", fetchMock);

    render(<StatusDashboard providers={PROVIDERS} services={CATALOG} />);
    expect(await screen.findByLabelText("7 recent problem signals"))
      .toBeInTheDocument();
    await user.click(
      within(getServiceCard("Claude Code")).getByText("Manual community report"),
    );
    await user.click(
      within(getServiceCard("Claude Code")).getByRole("button", {
        name: "Report Claude Code as slow. Current count 2.",
      }),
    );

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(communitySummaryCalls).toBe(1);

    reportResponse.resolve(
      jsonResponse({
        ok: false,
        counted: false,
        reason: "cooldown",
        cooldownSeconds: 120,
      }),
    );

    expect(await screen.findByText("Already counted. Try again in 120s."))
      .toBeInTheDocument();
    expect(communitySummaryCalls).toBe(2);
    expect(
      screen.getByRole("button", {
        name: "Report Claude Code as slow. Current count 2.",
      }),
    ).toBeInTheDocument();
  });

  it("rolls back an optimistic report even when its recovery fetch fails", async () => {
    const baseFetchMock = createFetchMock();
    let communitySummaryCalls = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/summary") {
        communitySummaryCalls += 1;
        if (communitySummaryCalls > 1) {
          return Promise.resolve(new Response("Unavailable", { status: 503 }));
        }
      }
      if (url === "/api/report") {
        return Promise.resolve(
          jsonResponse({
            ok: false,
            counted: false,
            reason: "cooldown",
            cooldownSeconds: 120,
          }),
        );
      }
      return baseFetchMock(input, init);
    });
    const user = userEvent.setup();
    vi.stubGlobal("fetch", fetchMock);

    render(<StatusDashboard providers={PROVIDERS} services={CATALOG} />);
    expect(await screen.findByLabelText("7 recent problem signals"))
      .toBeInTheDocument();
    await user.click(
      within(getServiceCard("Claude Code")).getByText("Manual community report"),
    );
    await user.click(
      within(getServiceCard("Claude Code")).getByRole("button", {
        name: "Report Claude Code as slow. Current count 2.",
      }),
    );

    expect(await screen.findByText("Community reports unavailable."))
      .toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Report Claude Code as slow. Last known count 2.",
      }),
    ).toBeInTheDocument();
    expect(within(getServiceCard("Claude Code")).getByText("3 (stale)"))
      .toBeInTheDocument();
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
  options: {
    failCommunitySummary?: boolean;
    failSignalSummary?: boolean;
    official?: typeof officialResponse;
  } = {},
) {
  return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
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
      return jsonResponse(options.official ?? officialResponse);
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

function countFetches(fetchMock: ReturnType<typeof vi.fn>, url: string) {
  return fetchMock.mock.calls.filter(([input]) => String(input) === url).length;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
  });
}
