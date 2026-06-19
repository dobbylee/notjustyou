#!/usr/bin/env node

import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { fetchStatusData } from "./api.js";
import { formatStatus } from "./format.js";

const DEFAULT_BASE_URL = "https://notjustyou.dev";
const WATCH_INTERVAL_MS = 2_000;

export async function main(argv = process.argv.slice(2)) {
  const parsed = parseCliArgs(argv);

  if (parsed.command !== "status") {
    printUsage();
    return parsed.command === "help" ? 0 : 1;
  }

  await runStatus({
    baseUrl: parsed.baseUrl,
    serviceId: parsed.serviceId,
    watch: parsed.watch,
  });

  return 0;
}

export function parseCliArgs(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      "base-url": {
        type: "string",
      },
      watch: {
        type: "boolean",
        default: false,
      },
      help: {
        type: "boolean",
        short: "h",
        default: false,
      },
    },
  });
  const [command = "", serviceId] = positionals;

  return {
    command: values.help ? "help" : command,
    serviceId,
    watch: values.watch ?? false,
    baseUrl:
      values["base-url"] ?? process.env.NOTJUSTYOU_BASE_URL ?? DEFAULT_BASE_URL,
  };
}

async function runStatus(input: {
  baseUrl: string;
  serviceId: string | undefined;
  watch: boolean;
}) {
  let keepRunning = true;

  process.once("SIGINT", () => {
    keepRunning = false;
  });

  do {
    const data = await fetchStatusData(input.baseUrl);
    const output = formatStatus(data, input.serviceId);

    console.log(output);

    if (!input.watch) return;
    await delay(WATCH_INTERVAL_MS);
    if (keepRunning) {
      console.log("");
    }
  } while (keepRunning);
}

function printUsage() {
  console.log(`Usage:
  njy status [serviceId] [--base-url <url>] [--watch]

Examples:
  njy status
  njy status openai-api --base-url http://localhost:3000
  njy status openai-api --watch`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
