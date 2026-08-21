import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getRequestFingerprint } from "@/lib/abuse";
import { createRemoteStatusMcpServer } from "@/lib/mcp/remote-status-server";
import { checkRemoteMcpRateLimit } from "@/lib/mcp/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MCP_BODY_BYTES = 32 * 1024;

export async function POST(request: Request) {
  const rateLimit = checkRemoteMcpRateLimit(getRequestFingerprint(request));
  if (!rateLimit.allowed) {
    const response = mcpError(429, -32000, "MCP request rate limit exceeded.");
    response.headers.set("retry-after", String(rateLimit.retryAfterSeconds));
    return response;
  }

  const body = await readBody(request);
  if (!body.ok) return body.response;

  const server = createRemoteStatusMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  const response = await transport.handleRequest(request, {
    parsedBody: body.value,
  });

  return withCors(response);
}

export function GET() {
  return unsupportedMethod();
}

export function DELETE() {
  return unsupportedMethod();
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

function unsupportedMethod() {
  const response = mcpError(405, -32000, "Method not allowed.");
  response.headers.set("allow", "POST");
  return response;
}

async function readBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_MCP_BODY_BYTES) {
    return {
      ok: false as const,
      response: mcpError(413, -32000, "MCP request body is too large."),
    };
  }

  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_MCP_BODY_BYTES) {
        await reader.cancel();
        return {
          ok: false as const,
          response: mcpError(413, -32000, "MCP request body is too large."),
        };
      }
      chunks.push(value);
    }
  }

  const bodyBytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bodyBytes);

  try {
    return {
      ok: true as const,
      value: JSON.parse(text) as unknown,
    };
  } catch {
    return {
      ok: false as const,
      response: mcpError(400, -32700, "Parse error."),
    };
  }
}

function mcpError(status: number, code: number, message: string) {
  return Response.json(
    {
      jsonrpc: "2.0",
      id: null,
      error: {
        code,
        message,
      },
    },
    {
      status,
      headers: corsHeaders(),
    },
  );
}

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders())) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-allow-headers":
      "content-type, mcp-session-id, last-event-id, mcp-protocol-version",
    "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
  };
}
