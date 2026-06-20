#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import {
  handleJsonRpcMessage,
  parseJsonRpcLine,
  serializeJsonRpcMessage,
} from "./protocol.js";

export async function main() {
  const lines = createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    if (!line.trim()) continue;

    const response = await handleLine(line);

    if (response) {
      process.stdout.write(serializeJsonRpcMessage(response));
    }
  }
}

async function handleLine(line: string) {
  try {
    return await handleJsonRpcMessage(parseJsonRpcLine(line));
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
