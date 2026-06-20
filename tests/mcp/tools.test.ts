import { afterEach, describe, expect, it, vi } from "vitest";
import { callTool, TOOLS } from "@/packages/notjustyou-mcp/src/tools";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MCP tools", () => {
  it("only exposes read-only status and privacy tools", () => {
    expect(TOOLS.map((tool) => tool.name)).toEqual([
      "list_surfaces",
      "get_surface_status",
      "get_recent_signals",
      "explain_privacy",
    ]);
    expect(TOOLS.map((tool) => tool.annotations.readOnlyHint)).toEqual([
      true,
      true,
      true,
      true,
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
      readOnly: true,
      sendsSignals: false,
      requiresCollectorToken: false,
    });
    expect(String(result.content[0]?.text)).toContain("prompt text");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

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
