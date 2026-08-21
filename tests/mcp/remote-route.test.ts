import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DELETE,
  GET,
  OPTIONS,
  POST,
} from "@/app/mcp/route";
import { getRequestFingerprint } from "@/lib/abuse";
import { REMOTE_STATUS_TOOL_NAMES } from "@/lib/mcp/remote-status-server";
import {
  checkRemoteMcpRateLimit,
  REMOTE_MCP_RATE_LIMITS,
  resetRemoteMcpRateLimitForTests,
} from "@/lib/mcp/rate-limit";
import { STATUS_TOOLS } from "@/packages/notjustyou-mcp/src/tools";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetRemoteMcpRateLimitForTests();
});

describe("remote status MCP route", () => {
  it("initializes a stateless Streamable HTTP MCP server", async () => {
    const response = await POST(
      mcpRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: {
            name: "review-client",
            version: "1.0.0",
          },
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        serverInfo: {
          name: "notjustyou-status",
          version: "0.1.0",
        },
        capabilities: {
          tools: {},
        },
      },
    });
  });

  it("advertises only four fully annotated read-only tools", async () => {
    const response = await POST(
      mcpRequest({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    );
    const payload = await response.json();
    const tools = payload.result.tools as Array<Record<string, unknown>>;

    expect(tools.map((tool) => tool.name)).toEqual([
      "list_surfaces",
      "get_surface_status",
      "get_recent_signals",
      "explain_privacy",
    ]);
    expect(REMOTE_STATUS_TOOL_NAMES).toEqual(
      STATUS_TOOLS.map((tool) => tool.name),
    );
    expect(tools).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "enable_reporting" }),
        expect.objectContaining({ name: "disable_reporting" }),
      ]),
    );
    for (const tool of tools) {
      expect(tool).toMatchObject({
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
        inputSchema: {
          type: "object",
        },
        outputSchema: {
          type: "object",
        },
      });
    }
  });

  it("returns source-separated public status through a remote tool call", async () => {
    vi.stubEnv("NOTJUSTYOU_BASE_URL", "http://status.test");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/summary")) {
        return jsonResponse({
          windowMinutes: 10,
          updatedAt: "2026-08-21T00:00:00.000Z",
          services: [
            {
              serviceId: "openai-api",
              total: 2,
              counts: { slow: 0, error: 2, down: 0 },
              communityState: "reports_seen",
            },
          ],
        });
      }

      if (url.endsWith("/api/signals/summary")) {
        return jsonResponse({
          windowMinutes: 10,
          updatedAt: "2026-08-21T00:00:00.000Z",
          services: [
            {
              serviceId: "openai-api",
              total: 1,
              uniqueInstallationsApprox: 1,
              countsBySource: { api_middleware: 1 },
              countsBySymptom: { error: 1 },
              lastSignal: {
                symptom: "error",
                source: "api_middleware",
                observedAt: "2026-08-21T00:00:00.000Z",
              },
            },
          ],
        });
      }

      if (url.endsWith("/api/official")) {
        return jsonResponse({
          updatedAt: "2026-08-21T00:00:00.000Z",
          services: [
            {
              serviceId: "openai-api",
              overall: "operational",
              source: "official",
              updatedAt: "2026-08-21T00:00:00.000Z",
            },
          ],
          providerAdvisories: [],
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      mcpRequest({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "get_surface_status",
          arguments: {
            serviceId: "openai-api",
          },
        },
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      result: {
        structuredContent: {
          serviceId: "openai-api",
          community: { total: 2 },
          installedSignals: { total: 1 },
          official: { overall: "operational" },
          sources: {
            community: true,
            installedSignals: true,
            official: true,
          },
        },
      },
    });
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("authorization");
  });

  it.each([
    {
      failedSource: "community",
      failedPath: "/api/summary",
      expectedAvailable: {
        community: false,
        installedSignals: true,
        official: true,
      },
      expectedPresent: ["installedSignals", "official"],
    },
    {
      failedSource: "installed signals",
      failedPath: "/api/signals/summary",
      expectedAvailable: {
        community: true,
        installedSignals: false,
        official: true,
      },
      expectedPresent: ["community", "official"],
    },
    {
      failedSource: "official status",
      failedPath: "/api/official",
      expectedAvailable: {
        community: true,
        installedSignals: true,
        official: false,
      },
      expectedPresent: ["community", "installedSignals"],
    },
  ])(
    "preserves successful sources when $failedSource is unavailable",
    async ({ failedPath, expectedAvailable, expectedPresent }) => {
      vi.stubEnv("NOTJUSTYOU_BASE_URL", "http://status.test");
      vi.stubGlobal("fetch", partialStatusFetch(failedPath));

      const response = await POST(
        mcpRequest({
          jsonrpc: "2.0",
          id: 31,
          method: "tools/call",
          params: {
            name: "get_surface_status",
            arguments: {
              serviceId: "openai-api",
            },
          },
        }),
      );
      const payload = await response.json();
      const result = payload.result.structuredContent as Record<string, unknown>;

      expect(result.sources).toEqual(expectedAvailable);
      for (const field of expectedPresent) {
        expect(result[field]).not.toBeNull();
      }
    },
  );

  it("describes the remote-only privacy boundary without local setup claims", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      mcpRequest({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "explain_privacy",
          arguments: {},
        },
      }),
    );
    const payload = await response.json();

    expect(payload.result.structuredContent).toMatchObject({
      remoteStatusOnly: true,
      readOnlyStatusTools: true,
      toolSubmitsSignals: false,
      requiresAuthentication: false,
      transportData: {
        jsonRpcBodyProcessedInMemory: true,
        transportHeadersProcessedInMemory: true,
        trustedClientAddressProcessedForRateLimit: true,
        rawClientAddressStored: false,
        clientAddressHashCounterRetentionSeconds: 60,
      },
    });
    expect(payload.result.structuredContent.doesNotCollect).toContain(
      "AI provider request or response bodies",
    );
    expect(payload.result.structuredContent.doesNotCollect).not.toContain(
      "request or response bodies",
    );
    expect(payload.result.structuredContent).not.toHaveProperty(
      "setupToolsWriteLocalConfig",
    );
    expect(payload.result.structuredContent).not.toHaveProperty(
      "hookReceiverCanSendAfterOptIn",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unknown tool arguments before reading any status source", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      mcpRequest({
        jsonrpc: "2.0",
        id: 40,
        method: "tools/call",
        params: {
          name: "get_surface_status",
          arguments: {
            serviceId: "openai-api",
            collectorToken: "not-allowed",
          },
        },
      }),
    );
    const payload = await response.json();

    expect(payload.result).toMatchObject({
      isError: true,
    });
    expect(JSON.stringify(payload.result)).toContain("Unrecognized key");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("applies the trusted-client request budget before handling a call", async () => {
    vi.stubEnv("VERCEL", "1");
    const request = mcpRequest(
      {
        jsonrpc: "2.0",
        id: 41,
        method: "ping",
      },
      {
        "x-vercel-forwarded-for": "198.51.100.42",
      },
    );
    const fingerprint = getRequestFingerprint(request);

    for (let index = 0; index < REMOTE_MCP_RATE_LIMITS.clientPerMinute; index += 1) {
      checkRemoteMcpRateLimit(fingerprint);
    }

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    await expect(response.json()).resolves.toMatchObject({
      error: {
        message: "MCP request rate limit exceeded.",
      },
    });
  });

  it("rejects malformed, oversized, and unsupported requests", async () => {
    const malformed = await POST(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: mcpHeaders(),
        body: "{",
      }),
    );
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toMatchObject({
      error: { code: -32700 },
    });

    const oversized = await POST(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: mcpHeaders(),
        body: JSON.stringify({ payload: "x".repeat(33 * 1024) }),
      }),
    );
    expect(oversized.status).toBe(413);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(20 * 1024)));
        controller.enqueue(new TextEncoder().encode("x".repeat(20 * 1024)));
        controller.close();
      },
    });
    const streamedOversized = await POST(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: mcpHeaders(),
        body: stream,
        duplex: "half",
      } as RequestInit & { duplex: "half" }),
    );
    expect(streamedOversized.status).toBe(413);

    const get = GET();
    const remove = DELETE();
    const options = OPTIONS();

    expect(get.status).toBe(405);
    expect(remove.status).toBe(405);
    expect(options.status).toBe(204);
    expect(options.headers.get("access-control-allow-methods")).toContain("POST");
  });
});

function mcpRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      ...mcpHeaders(),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function mcpHeaders() {
  return {
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
    "mcp-protocol-version": "2025-06-18",
  };
}

function jsonResponse(payload: unknown) {
  return Response.json(payload);
}

function partialStatusFetch(failedPath: string) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith(failedPath)) {
      return new Response("unavailable", { status: 503 });
    }

    if (url.endsWith("/api/summary")) {
      return jsonResponse({
        windowMinutes: 10,
        updatedAt: "2026-08-21T00:00:00.000Z",
        services: [
          {
            serviceId: "openai-api",
            total: 1,
            counts: { slow: 0, error: 1, down: 0 },
            communityState: "reports_seen",
          },
        ],
      });
    }

    if (url.endsWith("/api/signals/summary")) {
      return jsonResponse({
        windowMinutes: 10,
        updatedAt: "2026-08-21T00:00:00.000Z",
        services: [
          {
            serviceId: "openai-api",
            total: 1,
            uniqueInstallationsApprox: 1,
            countsBySource: { api_middleware: 1 },
            countsBySymptom: { error: 1 },
            lastSignal: null,
          },
        ],
      });
    }

    if (url.endsWith("/api/official")) {
      return jsonResponse({
        updatedAt: "2026-08-21T00:00:00.000Z",
        services: [
          {
            serviceId: "openai-api",
            overall: "operational",
            source: "official",
            updatedAt: "2026-08-21T00:00:00.000Z",
          },
        ],
        providerAdvisories: [],
      });
    }

    throw new Error(`Unhandled fetch: ${url}`);
  });
}
