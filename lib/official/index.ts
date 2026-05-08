import { PROVIDERS, type ProviderId } from "../catalog";
import { getRedis } from "../redis";
import { fetchAnthropicStatus } from "./anthropic";
import { fetchOpenAIStatus } from "./openai";
import type { OfficialProviderStatus } from "./types";

const OFFICIAL_CACHE_TTL_SECONDS = 120;

const memoryCache = new Map<
  ProviderId,
  {
    expiresAt: number;
    value: OfficialProviderStatus;
  }
>();

export interface OfficialSummaryResponse {
  updatedAt: string;
  providers: OfficialProviderStatus[];
}

export async function getOfficialSummary(): Promise<OfficialSummaryResponse> {
  const providers = await Promise.all(
    PROVIDERS.map(async (provider) => {
      if (provider.officialStatusSource === "not_connected") {
        return createNotConnectedStatus(provider.id);
      }

      return getOfficialProviderStatus(provider.id);
    }),
  );

  return {
    updatedAt: new Date().toISOString(),
    providers,
  };
}

async function getOfficialProviderStatus(providerId: ProviderId) {
  const cached = await getCachedOfficialStatus(providerId);
  if (cached) return cached;

  try {
    const status = await fetchProviderStatus(providerId);
    await setCachedOfficialStatus(status);
    return status;
  } catch {
    return createUnknownStatus(providerId);
  }
}

async function fetchProviderStatus(providerId: ProviderId) {
  switch (providerId) {
    case "anthropic":
      return fetchAnthropicStatus();
    case "openai":
      return fetchOpenAIStatus();
    case "google":
    case "cursor":
      return createNotConnectedStatus(providerId);
  }
}

async function getCachedOfficialStatus(providerId: ProviderId) {
  const redis = getRedis();
  const key = getOfficialCacheKey(providerId);

  if (redis) {
    return redis.get<OfficialProviderStatus>(key);
  }

  const cached = memoryCache.get(providerId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  return null;
}

async function setCachedOfficialStatus(status: OfficialProviderStatus) {
  const redis = getRedis();
  const key = getOfficialCacheKey(status.providerId);

  if (redis) {
    await redis.set(key, status, {
      ex: OFFICIAL_CACHE_TTL_SECONDS,
    });
    return;
  }

  memoryCache.set(status.providerId, {
    value: status,
    expiresAt: Date.now() + OFFICIAL_CACHE_TTL_SECONDS * 1000,
  });
}

function createUnknownStatus(providerId: ProviderId): OfficialProviderStatus {
  return {
    providerId,
    overall: "unknown",
    source: "official",
    updatedAt: new Date().toISOString(),
    components: [],
  };
}

function createNotConnectedStatus(providerId: ProviderId): OfficialProviderStatus {
  return {
    providerId,
    overall: "unknown",
    source: "not_connected",
    updatedAt: new Date().toISOString(),
    components: [],
  };
}

function getOfficialCacheKey(providerId: ProviderId) {
  return `official:v1:${providerId}`;
}
