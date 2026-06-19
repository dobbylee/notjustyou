export const MAX_SIGNAL_AGE_MS = 15 * 60 * 1000;
export const MAX_SIGNAL_FUTURE_SKEW_MS = 2 * 60 * 1000;

export type TimestampValidationResult =
  | {
      ok: true;
      observedAt: string;
      receivedAt: string;
    }
  | {
      ok: false;
      reason: "observed_at_too_old" | "observed_at_in_future";
    };

export function validateSignalTimestamp(
  observedAt: string | undefined,
  now = new Date(),
): TimestampValidationResult {
  const observed = observedAt ? new Date(observedAt) : now;
  const deltaMs = observed.getTime() - now.getTime();

  if (deltaMs < -MAX_SIGNAL_AGE_MS) {
    return {
      ok: false,
      reason: "observed_at_too_old",
    };
  }

  if (deltaMs > MAX_SIGNAL_FUTURE_SKEW_MS) {
    return {
      ok: false,
      reason: "observed_at_in_future",
    };
  }

  return {
    ok: true,
    observedAt: observed.toISOString(),
    receivedAt: now.toISOString(),
  };
}

