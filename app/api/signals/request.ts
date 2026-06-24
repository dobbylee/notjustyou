import type { NextRequest } from "next/server";
import { getRequestFingerprint } from "@/lib/abuse";
import {
  getSignalSecret,
  type CollectorRecord,
} from "@/lib/signals/collectors";
import { isBodyWithinSignalLimit, scanForSensitiveKeys } from "@/lib/signals/privacy";
import {
  collectorHeartbeatSchema,
  collectorRegistrationSchema,
  parseProblemSignalInput,
  type ProblemSignalInput,
} from "@/lib/signals/schema";
import { validateSignalTimestamp } from "@/lib/signals/timestamps";
import { getSignalStorage } from "@/lib/storage";

export type SignalErrorReason =
  | "body_too_large"
  | "invalid_json"
  | "sensitive_payload"
  | "invalid_request"
  | "missing_token"
  | "invalid_token"
  | "revoked_token"
  | "source_not_allowed"
  | "service_not_allowed"
  | "rate_limited"
  | "observed_at_too_old"
  | "observed_at_in_future"
  | "internal_error"
  | "redis_unavailable"
  | "server_config_error";

export async function readJsonBody(request: NextRequest) {
  const text = await request.text();

  if (!isBodyWithinSignalLimit(text)) {
    return {
      ok: false as const,
      reason: "body_too_large" as const,
    };
  }

  try {
    const json = text ? (JSON.parse(text) as unknown) : {};
    return {
      ok: true as const,
      json,
    };
  } catch {
    return {
      ok: false as const,
      reason: "invalid_json" as const,
    };
  }
}

export function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(/\s+/);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function getAuthorizedCollector(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      ok: false as const,
      reason: "missing_token" as const,
    };
  }

  const secret = getSignalSecret();
  const storage = await getSignalStorage();
  const collector = await storage.findCollectorByToken(token, secret);

  if (!collector) {
    return {
      ok: false as const,
      reason: "invalid_token" as const,
    };
  }

  if (collector.revokedAt) {
    return {
      ok: false as const,
      reason: "revoked_token" as const,
    };
  }

  return {
    ok: true as const,
    token,
    secret,
    storage,
    collector,
  };
}

export async function validateSignalRequest(request: NextRequest) {
  const body = await readJsonBody(request);
  if (!body.ok) return body;

  const sensitiveScan = scanForSensitiveKeys(body.json);
  if (!sensitiveScan.ok) {
    return {
      ok: false as const,
      reason: "sensitive_payload" as const,
    };
  }

  const parsed = parseProblemSignalInput(body.json);
  if (!parsed.success) {
    return {
      ok: false as const,
      reason: "invalid_request" as const,
    };
  }

  const auth = await getAuthorizedCollector(request);
  if (!auth.ok) return auth;

  const allowlist = validateCollectorAllowlist(auth.collector, parsed.data);
  if (!allowlist.ok) return allowlist;

  const rateLimit = await auth.storage.checkSignalRateLimits({
    collectorId: auth.collector.collectorId,
    serviceId: parsed.data.serviceId,
    installationId: parsed.data.installationId,
    secret: auth.secret,
  });

  if (!rateLimit.allowed) {
    return {
      ok: false as const,
      reason: "rate_limited" as const,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    };
  }

  const timestamp = validateSignalTimestamp(parsed.data.observedAt);
  if (!timestamp.ok) return timestamp;

  return {
    ok: true as const,
    token: auth.token,
    secret: auth.secret,
    storage: auth.storage,
    collector: auth.collector,
    signal: {
      ...parsed.data,
      collectorId: auth.collector.collectorId,
      observedAt: timestamp.observedAt,
      receivedAt: timestamp.receivedAt,
    },
  };
}

export async function validateRegistrationRequest(request: NextRequest) {
  const body = await readJsonBody(request);
  if (!body.ok) return body;

  const sensitiveScan = scanForSensitiveKeys(body.json);
  if (!sensitiveScan.ok) {
    return {
      ok: false as const,
      reason: "sensitive_payload" as const,
    };
  }

  const parsed = collectorRegistrationSchema.safeParse(body.json);
  if (!parsed.success) {
    return {
      ok: false as const,
      reason: "invalid_request" as const,
    };
  }

  const secret = getSignalSecret();
  const storage = await getSignalStorage();
  const rateLimit = await storage.checkRegistrationRateLimit(
    getRequestFingerprint(request),
  );

  if (!rateLimit.allowed) {
    return {
      ok: false as const,
      reason: "rate_limited" as const,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    };
  }

  return {
    ok: true as const,
    storage,
    secret,
    data: parsed.data,
  };
}

export async function validateHeartbeatRequest(request: NextRequest) {
  const body = await readJsonBody(request);
  if (!body.ok) return body;

  const sensitiveScan = scanForSensitiveKeys(body.json);
  if (!sensitiveScan.ok) {
    return {
      ok: false as const,
      reason: "sensitive_payload" as const,
    };
  }

  const parsed = collectorHeartbeatSchema.safeParse(body.json);
  if (!parsed.success) {
    return {
      ok: false as const,
      reason: "invalid_request" as const,
    };
  }

  const auth = await getAuthorizedCollector(request);
  if (!auth.ok) return auth;

  const rateLimit = await auth.storage.checkHeartbeatRateLimits({
    collectorId: auth.collector.collectorId,
    installationId: parsed.data.installationId,
    secret: auth.secret,
  });

  if (!rateLimit.allowed) {
    return {
      ok: false as const,
      reason: "rate_limited" as const,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    };
  }

  return {
    ok: true as const,
    token: auth.token,
    secret: auth.secret,
    storage: auth.storage,
    collector: auth.collector,
    data: parsed.data,
  };
}

function validateCollectorAllowlist(
  collector: CollectorRecord,
  signal: ProblemSignalInput,
) {
  if (collector.source !== signal.source) {
    return {
      ok: false as const,
      reason: "source_not_allowed" as const,
    };
  }

  if (!collector.serviceIds.includes(signal.serviceId)) {
    return {
      ok: false as const,
      reason: "service_not_allowed" as const,
    };
  }

  return {
    ok: true as const,
  };
}
