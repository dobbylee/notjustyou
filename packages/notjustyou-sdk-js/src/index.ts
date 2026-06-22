import { readSdkConfig } from "./config.js";
import { normalizeOpenAiError } from "./normalize.js";
import { enqueueSignal, scheduleSignalQueueDrain } from "./queue.js";
import { canSendToBaseUrl, sendSignal } from "./sender.js";
import type { ProblemSignalPayload, RecordAiCallOptions } from "./types.js";

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
    const normalized = normalizeOpenAiError(error);

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
  if (options.serviceId !== "openai-api") return;

  setTimeout(() => {
    void submitBestEffort(options, partialPayload);
  }, 0);
}

async function submitBestEffort(
  options: RecordAiCallOptions,
  partialPayload: Omit<ProblemSignalPayload, "installationId" | "clientVersion">,
) {
  try {
    if (options.serviceId !== "openai-api") return;

    const config = readSdkConfig();
    if (!config) return;
    if (!canSendToBaseUrl(config.baseUrl, options.baseUrl)) return;

    const payload = {
      ...partialPayload,
      installationId: config.installationId,
      clientVersion: config.clientVersion,
    };

    if (!enqueueSignal(payload)) return;

    scheduleSignalQueueDrain(sendQueuedSignal);
  } catch {
    return;
  }
}

async function sendQueuedSignal(payload: ProblemSignalPayload) {
  const config = readSdkConfig();
  if (!config) return;
  if (config.source !== "api_middleware" || !config.serviceIds.includes(payload.serviceId)) {
    return;
  }

  await sendSignal(config, payload);
}
