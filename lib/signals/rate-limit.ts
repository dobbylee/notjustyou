export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export const SIGNAL_RATE_LIMITS = {
  collectorPerMinute: 60,
  installationPerMinute: 20,
  heartbeatCollectorPerMinute: 60,
  heartbeatInstallationPerMinute: 20,
  serviceSoftPerMinute: 300,
  registrationPerMinute: 20,
} as const;

export function evaluateRateLimit(count: number, limit: number): RateLimitResult {
  return {
    allowed: count <= limit,
    retryAfterSeconds: 60,
  };
}
