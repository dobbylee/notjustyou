import type { ProblemSignalPayload, SdkConfig } from "./types.js";

export class SignalSendError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "SignalSendError";
  }
}

export function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

export function canSendToBaseUrl(configBaseUrl: string, requestedBaseUrl?: string) {
  if (!requestedBaseUrl) return true;
  return normalizeBaseUrl(configBaseUrl) === normalizeBaseUrl(requestedBaseUrl);
}

export async function sendSignal(
  config: SdkConfig,
  payload: ProblemSignalPayload,
  timeoutMs = 1500,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/api/signals`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.collectorToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new SignalSendError(
        `Signal submission failed with ${response.status}.`,
        response.status === 429 || response.status >= 500,
        response.status === 429 ? await readRetryAfterMs(response) : undefined,
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function readRetryAfterMs(response: Response) {
  try {
    const body = (await response.clone().json()) as unknown;
    if (!body || typeof body !== "object" || !("retryAfterSeconds" in body)) {
      return undefined;
    }

    const retryAfterSeconds = body.retryAfterSeconds;
    return typeof retryAfterSeconds === "number" && Number.isFinite(retryAfterSeconds)
      ? Math.max(0, retryAfterSeconds * 1000)
      : undefined;
  } catch {
    return undefined;
  }
}
