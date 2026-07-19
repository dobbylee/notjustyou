/** @vitest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import PrivacyPage from "@/app/privacy/page";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("site pages", () => {
  it("renders the integrated home with dashboard and docs anchors", () => {
    vi.stubGlobal("fetch", createFetchMock());

    render(<Home />);

    const primaryNavigation = screen.getByRole("navigation", {
      name: "Primary navigation",
    });

    expect(within(primaryNavigation).getByRole("link", { name: "Dashboard" }))
      .toHaveAttribute("href", "/#dashboard");
    expect(within(primaryNavigation).getByRole("link", { name: "Docs" }))
      .toHaveAttribute("href", "/#docs");
    expect(screen.queryByText("Open Source AI service status")).not
      .toBeInTheDocument();
    expect(screen.getByText("is down.")).toBeInTheDocument();
    expect(screen.getByText("Is it just me?")).toBeInTheDocument();
    expect(screen.getByText(/Check official status, community reports/))
      .toBeInTheDocument();
    expect(screen.getByText(/"source": "api_middleware"/))
      .toBeInTheDocument();
    expect(screen.getByText(/"symptom": "network_error"/)).toBeInTheDocument();
    expect(screen.queryByText(/"kept":/)).not.toBeInTheDocument();
    expect(screen.queryByText(/"dropped":/)).not.toBeInTheDocument();
    const privacyHeading = screen.getByRole("heading", {
      name: "Privacy boundary by default",
    });
    const privacySection = privacyHeading.closest("section");

    expect(privacyHeading).toHaveClass("text-balance");
    expect(privacySection).not.toBeNull();
    expect(privacySection?.querySelectorAll("p > span.block")).toHaveLength(0);
    expect(privacySection?.querySelector("pre")).toHaveClass(
      "min-w-0",
      "max-w-full",
      "text-xs",
      "sm:text-sm",
    );
    expect(screen.getAllByText(/npm install -g @notjustyou\/cli/).length)
      .toBeGreaterThan(0);
    expect(screen.getAllByText(/plugin install notjustyou@notjustyou/).length)
      .toBeGreaterThan(0);
    expect(screen.getAllByText(/npm install @notjustyou\/sdk-js/).length)
      .toBeGreaterThan(0);
    expect(screen.getByText("anthropic-claude-code")).toBeInTheDocument();
    expect(screen.getByText("openai-api")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Read docs/ })).not
      .toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Browse docs/ })).not
      .toBeInTheDocument();

    const heroGitHubLink = screen.getByRole("link", {
      name: "View on GitHub",
    });
    expect(heroGitHubLink).toHaveAttribute(
      "href",
      "https://github.com/dobbylee/notjustyou",
    );
    expect(heroGitHubLink.querySelector("svg[aria-hidden='true']")).not
      .toBeNull();

    const headerGitHubLink = screen.getByRole("link", { name: "GitHub" });
    expect(headerGitHubLink.querySelector(".lucide-star")).not.toBeNull();
  });

  it("renders privacy inside the shared site navigation", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { name: "Privacy" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Dashboard/ })[0])
      .toHaveAttribute("href", "/#dashboard");
    expect(screen.getByText("Source separation")).toBeInTheDocument();
  });
});

function createFetchMock() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url === "/api/summary") {
      return jsonResponse({
        windowMinutes: 10,
        updatedAt: "2026-05-09T00:00:00.000Z",
        services: [],
      });
    }

    if (url === "/api/official") {
      return jsonResponse({
        updatedAt: "2026-05-09T00:00:00.000Z",
        services: [],
      });
    }

    if (url === "/api/signals/summary") {
      return jsonResponse({
        windowMinutes: 10,
        updatedAt: "2026-05-09T00:00:00.000Z",
        services: [],
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

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}
