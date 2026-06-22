import type { ProblemSignalPayload, SdkConfig } from "./types.js";

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
    await fetch(`${normalizeBaseUrl(config.baseUrl)}/api/signals`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.collectorToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
