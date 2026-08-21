export const REMOTE_MCP_RATE_LIMITS = {
  clientPerMinute: 60,
  instancePerMinute: 600,
} as const;

const WINDOW_MS = 60_000;

interface RateBucket {
  startedAt: number;
  count: number;
}

let instanceBucket: RateBucket = {
  startedAt: 0,
  count: 0,
};
let clientBuckets = new Map<string, RateBucket>();

export function checkRemoteMcpRateLimit(
  fingerprint: string,
  now = Date.now(),
) {
  if (windowExpired(instanceBucket, now)) {
    instanceBucket = {
      startedAt: now,
      count: 0,
    };
    clientBuckets = new Map();
  }

  instanceBucket.count += 1;
  if (instanceBucket.count > REMOTE_MCP_RATE_LIMITS.instancePerMinute) {
    return denied(instanceBucket, now);
  }

  const currentClient = clientBuckets.get(fingerprint);
  const clientBucket =
    !currentClient || windowExpired(currentClient, now)
      ? {
          startedAt: now,
          count: 0,
        }
      : currentClient;
  clientBucket.count += 1;
  clientBuckets.set(fingerprint, clientBucket);

  if (clientBucket.count > REMOTE_MCP_RATE_LIMITS.clientPerMinute) {
    return denied(clientBucket, now);
  }

  return {
    allowed: true as const,
    retryAfterSeconds: 0,
  };
}

export function resetRemoteMcpRateLimitForTests() {
  instanceBucket = {
    startedAt: 0,
    count: 0,
  };
  clientBuckets = new Map();
}

function windowExpired(bucket: RateBucket, now: number) {
  return bucket.startedAt === 0 || now - bucket.startedAt >= WINDOW_MS;
}

function denied(bucket: RateBucket, now: number) {
  return {
    allowed: false as const,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((bucket.startedAt + WINDOW_MS - now) / 1000),
    ),
  };
}
