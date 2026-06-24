import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { callTool, TOOLS } from "@/packages/notjustyou-mcp/src/tools";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("MCP tools", () => {
  it("exposes status tools plus narrow local reporting setup tools", () => {
    expect(TOOLS.map((tool) => tool.name)).toEqual([
      "list_surfaces",
      "get_surface_status",
      "get_recent_signals",
      "explain_privacy",
      "get_reporting_setup_state",
      "enable_reporting",
      "disable_reporting",
    ]);
    expect(TOOLS.map((tool) => tool.annotations.readOnlyHint)).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(TOOLS.map((tool) => tool.name)).not.toContain("submit_signal");
  });

  it("lists status surfaces from public read APIs without collector credentials", async () => {
    const fetchMock = stubStatusFetch();

    const result = await callTool(
      "list_surfaces",
      {
        provider: "openai",
      },
      "http://localhost:3000/",
    );

    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({
      surfaces: [
        {
          serviceId: "openai-api",
          providerId: "openai",
          community: {
            total: 0,
          },
          installedSignals: {
            total: 3,
          },
          official: {
            overall: "operational",
          },
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/summary",
      expect.objectContaining({
        cache: "no-store",
      }),
    );
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("authorization");
  });

  it("reads recent installed signals with service and window filters", async () => {
    const fetchMock = stubStatusFetch();

    const result = await callTool(
      "get_recent_signals",
      {
        serviceId: "openai-api",
        windowMinutes: 5,
      },
      "http://localhost:3000",
    );

    expect(result.structuredContent).toMatchObject({
      serviceId: "openai-api",
      windowMinutes: 5,
      installedSignalsAvailable: true,
      installedSignals: {
        total: 3,
      },
    });
    expect(JSON.stringify(result.structuredContent)).not.toContain(
      "privateUnexpectedField",
    );
    expect(JSON.stringify(result.structuredContent)).not.toContain(
      "unexpectedText",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/signals/summary?serviceId=openai-api&windowMinutes=5",
      expect.any(Object),
    );
  });

  it("does not use serviceId as a signal-summary filter for full surface status", async () => {
    const fetchMock = stubStatusFetch();

    await callTool(
      "get_surface_status",
      {
        serviceId: "not-in-catalog",
      },
      "http://localhost:3000",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/signals/summary",
      expect.any(Object),
    );
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(
      "serviceId=not-in-catalog",
    );
  });

  it("reads recent installed signals without depending on community or official APIs", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/api/signals/summary")) {
        return jsonResponse({
          windowMinutes: 10,
          updatedAt: "2026-06-20T01:00:00.000Z",
          services: [],
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      callTool(
        "get_recent_signals",
        {
          serviceId: "openai-api",
        },
        "http://localhost:3000",
      ),
    ).resolves.toMatchObject({
      structuredContent: {
        installedSignalsAvailable: true,
      },
    });
  });

  it("rejects extra arguments that are not in the tool schema", async () => {
    await expect(
      callTool("get_surface_status", {
        serviceId: "openai-api",
        collectorToken: "not-allowed",
      }),
    ).rejects.toThrow("Unknown argument: collectorToken");
  });

  it("explains the privacy boundary without reading APIs", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await callTool("explain_privacy", {});

    expect(result.structuredContent).toMatchObject({
      readOnlyStatusTools: true,
      setupToolsWriteLocalConfig: true,
      toolSubmitsSignals: false,
      requiresCollectorTokenForStatusLookup: false,
    });
    expect(String(result.content[0]?.text)).toContain("prompt text");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads local reporting setup state without exposing token or local path", async () => {
    vi.stubEnv("NOTJUSTYOU_CONFIG_PATH", tempConfigPath());

    const result = await callTool("get_reporting_setup_state", {
      surface: "cursor",
    });

    expect(result.structuredContent).toMatchObject({
      surface: "cursor",
      serviceId: "cursor-ide",
      configured: false,
      enabled: false,
      source: null,
      serviceIds: [],
    });
    expect(JSON.stringify(result.structuredContent)).not.toContain("collectorToken");
    expect(JSON.stringify(result.structuredContent)).not.toContain(tmpdir());
  });

  it("requires explicit confirmation before enabling local reporting", async () => {
    vi.stubEnv("NOTJUSTYOU_CONFIG_PATH", tempConfigPath());

    await expect(
      callTool("enable_reporting", {
        surface: "cursor",
      }),
    ).rejects.toThrow("confirmed must be true");
  });

  it("sanitizes setup state config read errors", async () => {
    const configPath = tempConfigPath();
    mkdirSync(configPath);
    vi.stubEnv("NOTJUSTYOU_CONFIG_PATH", configPath);

    await expect(
      callTool("get_reporting_setup_state", {
        surface: "cursor",
      }),
    ).rejects.toThrow("Failed to read local reporting setup state.");
    await expect(
      callTool("get_reporting_setup_state", {
        surface: "cursor",
      }),
    ).rejects.not.toThrow(configPath);
  });

  it("sanitizes enable reporting config read errors", async () => {
    const configPath = tempConfigPath();
    mkdirSync(configPath);
    vi.stubEnv("NOTJUSTYOU_CONFIG_PATH", configPath);

    await expect(
      callTool("enable_reporting", {
        surface: "cursor",
        confirmed: true,
        startReceiver: false,
      }, "http://localhost:3000"),
    ).rejects.toThrow("Failed to enable local reporting.");
    await expect(
      callTool("enable_reporting", {
        surface: "cursor",
        confirmed: true,
        startReceiver: false,
      }, "http://localhost:3000"),
    ).rejects.not.toThrow(configPath);
  });

  it("enables Cursor reporting through local config without submitting a signal", async () => {
    const configPath = tempConfigPath();
    vi.stubEnv("NOTJUSTYOU_CONFIG_PATH", configPath);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "http://localhost:3000/api/collectors/register") {
        expect(init?.method).toBe("POST");
        expect(String(init?.body)).toContain('"source":"cli_hook"');
        expect(String(init?.body)).toContain('"cursor-ide"');
        return jsonResponse({
          collectorId: "collector_test",
          collectorToken: "secret_test_token",
          expiresAt: null,
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callTool("enable_reporting", {
      surface: "cursor",
      confirmed: true,
      startReceiver: false,
    }, "http://localhost:3000");

    expect(result.structuredContent).toMatchObject({
      surface: "cursor",
      serviceId: "cursor-ide",
      enabled: true,
      receiverStatus: "skipped",
      source: "cli_hook",
      serviceIds: ["cursor-ide"],
      localHookSignalOptIn: true,
      tokenPrinted: false,
      signalSubmitted: false,
    });
    expect(JSON.stringify(result.structuredContent)).not.toContain("secret_test_token");
    expect(JSON.stringify(result.structuredContent)).not.toContain(configPath);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const config = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    expect(config).toMatchObject({
      collectorToken: "secret_test_token",
      source: "cli_hook",
      serviceIds: ["cursor-ide"],
      localHookSignalOptIn: true,
    });
  });

  it("disables local reporting after explicit confirmation", async () => {
    const configPath = tempConfigPath();
    vi.stubEnv("NOTJUSTYOU_CONFIG_PATH", configPath);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          collectorId: "collector_test",
          collectorToken: "secret_test_token",
          expiresAt: null,
        }),
      ),
    );

    await callTool("enable_reporting", {
      surface: "claude-code",
      confirmed: true,
      startReceiver: false,
      baseUrl: "http://localhost:3000",
    });

    const result = await callTool("disable_reporting", {
      surface: "claude-code",
      confirmed: true,
    });

    expect(result.structuredContent).toMatchObject({
      surface: "claude-code",
      serviceId: "anthropic-claude-code",
      changed: true,
      enabled: false,
      tokenPrinted: false,
      signalSubmitted: false,
    });

    const config = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    expect(config.localHookSignalOptIn).toBe(false);
  });
});

function tempConfigPath() {
  return join(mkdtempSync(join(tmpdir(), "njy-mcp-config-")), "config.json");
}

function stubStatusFetch() {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith("/api/summary")) {
      return jsonResponse({
        windowMinutes: 10,
        updatedAt: "2026-06-20T01:00:00.000Z",
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
      });
    }

    if (url.includes("/api/signals/summary")) {
      return jsonResponse({
        windowMinutes: url.includes("windowMinutes=5") ? 5 : 10,
        updatedAt: "2026-06-20T01:00:00.000Z",
        services: [
          {
            serviceId: "openai-api",
            total: 3,
            uniqueInstallationsApprox: 1,
            privateUnexpectedField: "must not leak",
            countsBySource: {
              api_middleware: 3,
              unexpectedText: "must not leak",
            },
            countsBySymptom: {
              rate_limited: 3,
              unexpectedText: "must not leak",
            },
            lastSignal: {
              symptom: "rate_limited",
              source: "api_middleware",
              observedAt: "2026-06-20T01:00:00.000Z",
              privateUnexpectedField: "must not leak",
            },
          },
        ],
      });
    }

    if (url.endsWith("/api/official")) {
      return jsonResponse({
        updatedAt: "2026-06-20T01:00:00.000Z",
        services: [
          {
            serviceId: "openai-api",
            overall: "operational",
            source: "official",
            updatedAt: "2026-06-20T01:00:00.000Z",
          },
        ],
      });
    }

    throw new Error(`Unhandled URL: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
  });
}
