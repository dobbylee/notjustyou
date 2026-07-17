import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { isDirectRun } from "@/packages/notjustyou-mcp/src/index";
import {
  handleJsonRpcMessage,
  serializeJsonRpcMessage,
} from "@/packages/notjustyou-mcp/src/protocol";

describe("MCP JSON-RPC protocol", () => {
  it("negotiates tools capability", async () => {
    const response = await handleJsonRpcMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: {
          name: "test-client",
          version: "0.1.0",
        },
      },
    });

    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-06-18",
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: "notjustyou-mcp",
          version: "0.2.7",
        },
      },
    });
  });

  it("returns MCP tool schemas", async () => {
    const response = await handleJsonRpcMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });

    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: 2,
      result: {
        tools: [
          {
            name: "list_surfaces",
            annotations: {
              readOnlyHint: true,
            },
          },
          {
            name: "get_surface_status",
            inputSchema: {
              required: ["serviceId"],
            },
          },
          {
            name: "get_recent_signals",
            inputSchema: {
              required: ["serviceId"],
            },
          },
          {
            name: "explain_privacy",
          },
          {
            name: "get_reporting_setup_state",
            inputSchema: {
              required: ["surface"],
            },
          },
          {
            name: "enable_reporting",
            inputSchema: {
              required: ["surface", "confirmed"],
            },
            annotations: {
              readOnlyHint: false,
            },
          },
          {
            name: "disable_reporting",
            inputSchema: {
              required: ["surface", "confirmed"],
            },
            annotations: {
              readOnlyHint: false,
            },
          },
        ],
      },
    });
  });

  it("calls tools through tools/call", async () => {
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
          ],
        });
      }

      if (url.includes("/api/signals/summary")) {
        return jsonResponse({
          windowMinutes: 10,
          updatedAt: "2026-06-20T01:00:00.000Z",
          services: [],
        });
      }

      if (url.endsWith("/api/official")) {
        return jsonResponse({
          updatedAt: "2026-06-20T01:00:00.000Z",
          services: [],
        });
      }

      throw new Error(`Unhandled URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleJsonRpcMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "get_surface_status",
        arguments: {
          serviceId: "openai-api",
        },
      },
    });

    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: 3,
      result: {
        structuredContent: {
          serviceId: "openai-api",
          found: true,
          community: {
            total: 0,
          },
        },
        isError: false,
      },
    });

    vi.unstubAllGlobals();
  });

  it("reports upstream status failures as tool execution errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response("unavailable", {
          status: 503,
        });
      }),
    );

    const response = await handleJsonRpcMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "get_surface_status",
        arguments: {
          serviceId: "openai-api",
        },
      },
    });

    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: 4,
      result: {
        isError: true,
      },
    });
    expect(JSON.stringify(response)).not.toContain("-32602");

    vi.unstubAllGlobals();
  });

  it("keeps invalid tool arguments as JSON-RPC invalid params", async () => {
    const response = await handleJsonRpcMessage({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "get_surface_status",
        arguments: {
          serviceId: "openai-api",
          body: "not allowed",
        },
      },
    });

    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: 5,
      error: {
        code: -32602,
        message: "Unknown argument: body",
      },
    });
  });

  it("serializes stdio messages with a newline delimiter", () => {
    expect(serializeJsonRpcMessage({ jsonrpc: "2.0", id: 1, result: {} })).toBe(
      '{"jsonrpc":"2.0","id":1,"result":{}}\n',
    );
  });

  it("recognizes npm bin symlinks as direct runs", () => {
    const target = join(mkdtempSync(join(tmpdir(), "njy-mcp-test-")), "index.js");
    const link = join(
      mkdtempSync(join(tmpdir(), "njy-mcp-bin-test-")),
      "notjustyou-mcp",
    );

    writeFileSync(target, "");
    symlinkSync(target, link);

    expect(isDirectRun(pathToFileURL(target).href, link)).toBe(true);
  });

  it("does not throw when an importing process has a missing argv path", () => {
    const target = join(mkdtempSync(join(tmpdir(), "njy-mcp-test-")), "index.js");

    writeFileSync(target, "");

    expect(isDirectRun(pathToFileURL(target).href, "not-a-file")).toBe(false);
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
  });
}
