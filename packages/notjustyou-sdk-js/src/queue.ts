import type { ProblemSignalPayload } from "./types.js";

const MAX_QUEUE_SIZE = 50;
const MAX_ATTEMPTS = 3;
const QUEUE_TTL_MS = 10 * 60 * 1000;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30 * 1000;
const JITTER_RATIO = 0.2;
const COALESCE_WINDOW_MS = 30 * 1000;

interface QueueEntry {
  payload: ProblemSignalPayload;
  attempts: number;
  queuedAt: number;
  expiresAt: number;
  nextAttemptAt: number;
  coalescingKey: string;
  sender?: SignalQueueSender;
}

export interface SignalQueueSnapshotEntry {
  payload: ProblemSignalPayload;
  attempts: number;
  queuedAt: number;
  expiresAt: number;
  nextAttemptAt: number;
  coalescingKey: string;
}

export type SignalQueueSender = (payload: ProblemSignalPayload) => Promise<void>;

let queue: QueueEntry[] = [];
let coalescedUntil = new Map<string, number>();
let drainTimer: ReturnType<typeof setTimeout> | null = null;
let drainTimerAt: number | null = null;
let draining = false;
let activeSender: SignalQueueSender | null = null;

export function enqueueSignal(
  payload: ProblemSignalPayload,
  now = Date.now(),
  sender?: SignalQueueSender,
) {
  purgeExpired(now);

  const coalescingKey = getCoalescingKey(payload);
  if (shouldCoalesce(payload)) {
    const suppressUntil = coalescedUntil.get(coalescingKey) ?? 0;
    if (suppressUntil > now) return false;

    coalescedUntil.set(coalescingKey, now + COALESCE_WINDOW_MS);
  }

  queue.push({
    payload,
    attempts: 0,
    queuedAt: now,
    expiresAt: now + QUEUE_TTL_MS,
    nextAttemptAt: now,
    coalescingKey,
    ...(sender ? { sender } : {}),
  });

  while (queue.length > MAX_QUEUE_SIZE) {
    queue.shift();
  }

  return true;
}

export function scheduleSignalQueueDrain(sender: SignalQueueSender, delayMs = 0) {
  activeSender = sender;
  const scheduledAt = Date.now() + delayMs;

  if (drainTimer && drainTimerAt !== null && drainTimerAt <= scheduledAt) return;

  if (drainTimer) {
    clearTimeout(drainTimer);
  }

  drainTimer = setTimeout(() => {
    drainTimer = null;
    drainTimerAt = null;
    void drainSignalQueue();
  }, delayMs);
  drainTimer.unref();
  drainTimerAt = scheduledAt;
}

export async function drainSignalQueue(now = Date.now()) {
  if (draining || (!activeSender && !queue.some((entry) => entry.sender))) return;

  draining = true;

  try {
    purgeExpired(now);

    for (const entry of [...queue]) {
      if (entry.nextAttemptAt > Date.now()) continue;

      const sender = entry.sender ?? activeSender;
      if (!sender) continue;

      entry.attempts += 1;

      try {
        await sender(entry.payload);
        removeEntry(entry);
      } catch (error) {
        if (!shouldRetry(error) || entry.attempts >= MAX_ATTEMPTS) {
          removeEntry(entry);
          continue;
        }

        entry.nextAttemptAt = Math.min(
          Date.now() + getRetryDelayMs(error, entry.attempts),
          entry.expiresAt,
        );
      }
    }
  } finally {
    draining = false;
    scheduleNextDrain();
  }
}

export function getSignalQueueSnapshot(): SignalQueueSnapshotEntry[] {
  return queue.map((entry) => ({
    payload: entry.payload,
    attempts: entry.attempts,
    queuedAt: entry.queuedAt,
    expiresAt: entry.expiresAt,
    nextAttemptAt: entry.nextAttemptAt,
    coalescingKey: entry.coalescingKey,
  }));
}

export function resetSignalQueueForTests() {
  queue = [];
  coalescedUntil = new Map();
  activeSender = null;

  if (drainTimer) {
    clearTimeout(drainTimer);
    drainTimer = null;
  }
  drainTimerAt = null;

  draining = false;
}

function scheduleNextDrain() {
  if (queue.length === 0 || (!activeSender && !queue.some((entry) => entry.sender))) return;

  const now = Date.now();
  const nextAttemptAt = Math.min(
    ...queue.map((entry) => Math.min(entry.nextAttemptAt, entry.expiresAt)),
  );
  const sender = activeSender ?? queue.find((entry) => entry.sender)?.sender;
  if (!sender) return;

  scheduleSignalQueueDrain(sender, Math.max(0, nextAttemptAt - now));
}

function purgeExpired(now: number) {
  queue = queue.filter((entry) => entry.expiresAt > now);

  for (const [key, suppressUntil] of coalescedUntil) {
    if (suppressUntil <= now) {
      coalescedUntil.delete(key);
    }
  }
}

function removeEntry(entry: QueueEntry) {
  queue = queue.filter((candidate) => candidate !== entry);
}

function shouldRetry(error: unknown) {
  if (error && typeof error === "object" && "retryable" in error) {
    return error.retryable === true;
  }

  return true;
}

function getRetryDelayMs(error: unknown, attempts: number) {
  const retryAfterMs = readRetryAfterMs(error);
  if (retryAfterMs !== undefined) return retryAfterMs;

  const exponential = Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
  const jitter = exponential * JITTER_RATIO * Math.random();
  return Math.round(exponential + jitter);
}

function readRetryAfterMs(error: unknown) {
  if (!error || typeof error !== "object" || !("retryAfterMs" in error)) {
    return undefined;
  }

  const retryAfterMs = error.retryAfterMs;
  return typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs)
    ? Math.max(0, retryAfterMs)
    : undefined;
}

function getCoalescingKey(payload: ProblemSignalPayload) {
  return [
    payload.serviceId,
    payload.source,
    payload.symptom,
    payload.statusCode ?? "",
    payload.errorCode ?? "",
  ].join(":");
}

function shouldCoalesce(payload: ProblemSignalPayload) {
  return payload.symptom !== "slow";
}
