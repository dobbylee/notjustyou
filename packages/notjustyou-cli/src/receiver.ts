import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { readConfig } from "./config.js";
import { submitSignal } from "./api.js";
import { normalizeLocalHookEvent } from "./local-hook.js";
import { scanForSensitiveKeys } from "./privacy.js";
import type { CliConfig, CliSignalPayload } from "./types.js";

const SIGNAL_BODY_LIMIT_BYTES = 8 * 1024;
const DEFAULT_RECEIVER_HOST = "127.0.0.1";
const DEFAULT_RECEIVER_PORT = 8765;
const LOCAL_RECEIVER_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

export type LocalHookSubmitter = (
  config: CliConfig,
  payload: CliSignalPayload,
) => Promise<void>;

export interface LocalHookReceiverOptions {
  host?: string;
  port?: number;
  sendSignals?: boolean;
  readConfig?: () => CliConfig | null;
  submit?: LocalHookSubmitter;
}

export function createLocalHookReceiver(options: LocalHookReceiverOptions = {}) {
  const host = options.host ?? DEFAULT_RECEIVER_HOST;
  assertLocalReceiverHost(host);

  const port = options.port ?? DEFAULT_RECEIVER_PORT;
  const shouldSend = options.sendSignals === true;
  const configReader = options.readConfig ?? readConfig;
  const signalSubmitter = options.submit ?? submitSignal;

  const server = createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/hook") {
      writeJson(response, 404, {
        ok: false,
        error: "Use POST /hook.",
      });
      return;
    }

    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      writeJson(response, 400, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    const sensitiveScan = scanForSensitiveKeys(body);
    if (!sensitiveScan.ok) {
      writeJson(response, 400, {
        ok: false,
        error: `Sensitive field rejected: ${sensitiveScan.key}`,
      });
      return;
    }

    const normalized = normalizeLocalHookEvent(body);
    if (!normalized.ok) {
      writeJson(response, 400, {
        ok: false,
        error: normalized.reason,
      });
      return;
    }

    if (!shouldSend) {
      writeJson(response, 202, {
        ok: true,
        mode: "preview",
        payload: normalized.payload,
      });
      return;
    }

    const config = configReader();
    if (!config) {
      writeJson(response, 409, {
        ok: false,
        error: "Local collector config is missing. Run njy register --source cli_hook first.",
      });
      return;
    }

    const readiness = getHookSendReadiness(config, normalized.payload);
    if (!readiness.ok) {
      writeJson(response, 409, {
        ok: false,
        error: readiness.reason,
      });
      return;
    }

    try {
      await signalSubmitter(config, normalized.payload);
      writeJson(response, 202, {
        ok: true,
        mode: "sent",
        payload: normalized.payload,
      });
    } catch (error) {
      writeJson(response, 502, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return {
    server,
    host,
    port,
    start: () =>
      new Promise<{ host: string; port: number }>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          const address = server.address() as AddressInfo;
          resolve({
            host,
            port: address.port,
          });
        });
      }),
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  };
}

export function assertLocalReceiverHost(host: string) {
  if (!LOCAL_RECEIVER_HOSTS.has(host)) {
    throw new Error("Local hook receiver only binds to localhost.");
  }
}

export function getHookSendReadiness(config: CliConfig | null, payload: CliSignalPayload):
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: string;
    } {
  if (!config) {
    return {
      ok: false,
      reason: "Local collector config is missing. Run njy register --source cli_hook first.",
    };
  }

  if (config.localHookSignalOptIn !== true) {
    return {
      ok: false,
      reason: "Local hook signal sending is disabled. Set localHookSignalOptIn to true.",
    };
  }

  if (!config.collectorToken) {
    return {
      ok: false,
      reason: "Collector token is missing. Run njy register --source cli_hook first.",
    };
  }

  if (config.source !== "cli_hook") {
    return {
      ok: false,
      reason: "Collector config source must be cli_hook for local hook signals.",
    };
  }

  if (!config.serviceIds.includes(payload.serviceId)) {
    return {
      ok: false,
      reason: "Collector config does not allow this serviceId.",
    };
  }

  return {
    ok: true,
  };
}

async function readJsonBody(request: IncomingMessage) {
  let body = "";

  for await (const chunk of request) {
    body += String(chunk);
    if (Buffer.byteLength(body, "utf8") > SIGNAL_BODY_LIMIT_BYTES) {
      throw new Error("Hook payload exceeds 8 KB.");
    }
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error("Hook payload must be valid JSON.");
  }
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, {
    "content-type": "application/json",
  });
  response.end(JSON.stringify(body));
}
