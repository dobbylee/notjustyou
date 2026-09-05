import { readJsonBody } from "@/lib/http/read-json-body";
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

  const body = await readJsonBody(request, MAX_MCP_BODY_BYTES);
  if (!body.ok) {
    return body.reason === "body_too_large"
      ? mcpError(413, -32000, "MCP request body is too large.")
      : mcpError(400, -32700, "Parse error.");
  }

  const server = createRemoteStatusMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  const response = await transport.handleRequest(request, {
    parsedBody: body.json,
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
