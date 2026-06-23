import { readSdkConfig } from "./config.js";
import { normalizeProviderError } from "./normalize.js";
import { enqueueSignal, scheduleSignalQueueDrain } from "./queue.js";
import { canSendToBaseUrl, sendSignal } from "./sender.js";
import type { ProblemSignalPayload, RecordAiCallOptions, SupportedServiceId } from "./types.js";

export type {
  ProblemSignalPayload,
  RecordAiCallOptions,
  SignalSymptom,
  SupportedServiceId,
} from "./types.js";

export async function recordAiCall<T>(
  options: RecordAiCallOptions,
  fn: () => Promise<T> | T,
): Promise<T> {
  const startedAt = Date.now();

  try {
    const value = await fn();
    const durationMs = Date.now() - startedAt;

    if (options.slowAfterMs !== undefined && durationMs >= options.slowAfterMs) {
      scheduleBestEffort(options, {
        serviceId: options.serviceId,
        source: "api_middleware",
        symptom: "slow",
        observedAt: new Date().toISOString(),
        durationMs,
      });
    }

    return value;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const normalized = normalizeProviderError(options.serviceId, error);

    scheduleBestEffort(options, {
      serviceId: options.serviceId,
      source: "api_middleware",
      symptom: normalized.symptom,
      observedAt: new Date().toISOString(),
      durationMs,
      ...(normalized.statusCode ? { statusCode: normalized.statusCode } : {}),
      ...(normalized.errorCode ? { errorCode: normalized.errorCode } : {}),
    });

    throw error;
  }
}

function scheduleBestEffort(
  options: RecordAiCallOptions,
  partialPayload: Omit<ProblemSignalPayload, "installationId" | "clientVersion">,
) {
  if (!isSupportedServiceId(options.serviceId)) return;

  setTimeout(() => {
    void submitBestEffort(options, partialPayload);
  }, 0);
}

async function submitBestEffort(
  options: RecordAiCallOptions,
  partialPayload: Omit<ProblemSignalPayload, "installationId" | "clientVersion">,
) {
  try {
    if (!isSupportedServiceId(options.serviceId)) return;

    const config = readSdkConfig();
    if (!config) return;
    if (!canSendToBaseUrl(config.baseUrl, options.baseUrl)) return;
    if (config.source !== "api_middleware" || !config.serviceIds.includes(options.serviceId)) {
      return;
    }

    const payload = {
      ...partialPayload,
      installationId: config.installationId,
      clientVersion: config.clientVersion,
    };

    const expectedBaseUrl = config.baseUrl;
    const queuedSender = (payload: ProblemSignalPayload) =>
      sendQueuedSignal(payload, expectedBaseUrl);
    if (!enqueueSignal(payload, Date.now(), queuedSender)) return;

    scheduleSignalQueueDrain(queuedSender);
  } catch {
    return;
  }
}

function isSupportedServiceId(serviceId: string): serviceId is SupportedServiceId {
  return (
    serviceId === "anthropic-claude-api" ||
    serviceId === "google-gemini-api" ||
    serviceId === "openai-api"
  );
}

async function sendQueuedSignal(payload: ProblemSignalPayload, expectedBaseUrl: string) {
  const config = readSdkConfig();
  if (!config) return;
  if (config.source !== "api_middleware") return;
  if (!config.serviceIds.includes(payload.serviceId)) return;
  if (!canSendToBaseUrl(config.baseUrl, expectedBaseUrl)) return;

  await sendSignal(config, payload);
}
