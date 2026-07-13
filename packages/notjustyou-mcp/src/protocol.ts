import { callTool, toolErrorResult, ToolExecutionError, TOOLS } from "./tools.js";

const PROTOCOL_VERSION = "2025-06-18";

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
}

export async function handleJsonRpcMessage(message: unknown) {
  if (!isJsonRpcRequest(message) || !message.method) {
    return errorResponse(null, -32600, "Invalid Request");
  }

  if (message.id === undefined) {
    return null;
  }

  try {
    if (message.method === "initialize") {
      return successResponse(message.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: "notjustyou-mcp",
          title: "Not Just You MCP",
            version: "0.2.6",
        },
        instructions:
          "Not Just You status lookup and explicit local reporting setup. This server does not submit signals directly.",
      });
    }

    if (message.method === "ping") {
      return successResponse(message.id, {});
    }

    if (message.method === "tools/list") {
      return successResponse(message.id, {
        tools: TOOLS,
      });
    }

    if (message.method === "tools/call") {
      const params = readParamsObject(message.params);
      const name = readToolName(params.name);
      const result = await callTool(name, params.arguments).catch((error: unknown) => {
        if (error instanceof ToolExecutionError) {
          return toolErrorResult(error);
        }

        throw error;
      });

      return successResponse(message.id, result);
    }

    return errorResponse(message.id, -32601, `Method not found: ${message.method}`);
  } catch (error) {
    return errorResponse(
      message.id,
      -32602,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function parseJsonRpcLine(line: string) {
  return JSON.parse(line) as unknown;
}

export function serializeJsonRpcMessage(message: unknown) {
  return `${JSON.stringify(message)}\n`;
}

function successResponse(id: JsonRpcId, result: unknown) {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

function errorResponse(id: JsonRpcId, code: number, message: string) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  };
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return candidate.jsonrpc === "2.0";
}

function readParamsObject(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("params must be an object.");
  }

  return value as Record<string, unknown>;
}

function readToolName(value: unknown) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Tool name must be a non-empty string.");
  }

  return value;
}
