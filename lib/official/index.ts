import {
  CATALOG,
  type OfficialStatusRef,
  type ServiceSurface,
  type StatuspageProviderId,
} from "../catalog";
import { getRedis } from "../redis";
import { fetchAnthropicStatus } from "./anthropic";
import { fetchCursorStatus } from "./cursor";
import {
  fetchGoogleCloudIncidents,
  fetchGoogleWorkspaceIncidents,
  getGoogleProductStatus,
  type GoogleStatusIncident,
} from "./google";
import { fetchOpenAIStatus } from "./openai";
import { findStatuspageComponent } from "./statuspage";
import type {
  OfficialProviderStatus,
  OfficialServiceStatus,
} from "./types";

const OFFICIAL_CACHE_TTL_SECONDS = 120;

const memoryCache = new Map<
  string,
  {
    expiresAt: number;
    value: unknown;
  }
>();

interface OfficialSummaryResponse {
  updatedAt: string;
  services: OfficialServiceStatus[];
}

export async function getOfficialSummary(): Promise<OfficialSummaryResponse> {
  const sourceCache = createRequestSourceCache();

  const services = await Promise.all(
    CATALOG.map((service) => getOfficialServiceStatus(service, sourceCache)),
  );

  return {
    updatedAt: new Date().toISOString(),
    services,
  };
}

function createRequestSourceCache() {
  const statuspageStatuses = new Map<
    StatuspageProviderId,
    Promise<OfficialProviderStatus>
  >();
  let googleWorkspaceIncidents: Promise<GoogleStatusIncident[]> | null = null;
  let googleCloudIncidents: Promise<GoogleStatusIncident[]> | null = null;

  return {
    getStatuspageStatus(providerId: StatuspageProviderId) {
      const cached = statuspageStatuses.get(providerId);
      if (cached) return cached;

      const status = getCachedOfficialValue<OfficialProviderStatus>(
        getStatuspageCacheKey(providerId),
        () => fetchStatuspageStatus(providerId),
      );
      statuspageStatuses.set(providerId, status);
      return status;
    },
    getGoogleWorkspaceIncidents() {
      googleWorkspaceIncidents ??= getCachedOfficialValue<GoogleStatusIncident[]>(
        "official:v1:google-workspace",
        fetchGoogleWorkspaceIncidents,
      );
      return googleWorkspaceIncidents;
    },
    getGoogleCloudIncidents() {
      googleCloudIncidents ??= getCachedOfficialValue<GoogleStatusIncident[]>(
        "official:v1:google-cloud",
        fetchGoogleCloudIncidents,
      );
      return googleCloudIncidents;
    },
  };
}

async function getOfficialServiceStatus(
  service: ServiceSurface,
  sourceCache: ReturnType<typeof createRequestSourceCache>,
): Promise<OfficialServiceStatus> {
  const statusRef = service.officialStatusRef;

  if (!statusRef) {
    return createNotConnectedServiceStatus(service.id);
  }

  try {
    return await getOfficialServiceStatusForRef(service.id, statusRef, sourceCache);
  } catch {
    return createUnknownServiceStatus(service.id);
  }
}

async function getOfficialServiceStatusForRef(
  serviceId: string,
  statusRef: OfficialStatusRef,
  sourceCache: ReturnType<typeof createRequestSourceCache>,
): Promise<OfficialServiceStatus> {
  switch (statusRef.kind) {
    case "statuspage_component": {
      const providerStatus = await sourceCache.getStatuspageStatus(statusRef.providerId);
      const component = findStatuspageComponent(
        providerStatus,
        statusRef.componentName,
      );

      if (!component) {
        return createUnknownServiceStatus(serviceId, providerStatus.updatedAt);
      }

      return {
        serviceId,
        overall: component.status,
        source: "official",
        updatedAt: component.updatedAt,
        matchedComponent: component.name,
      };
    }
    case "google_workspace_product": {
      const incidents = await sourceCache.getGoogleWorkspaceIncidents();
      const status = getGoogleProductStatus(statusRef.productId, incidents);

      return {
        serviceId,
        overall: status.overall,
        source: "official",
        updatedAt: status.updatedAt,
        matchedProduct: statusRef.productName,
      };
    }
    case "google_cloud_product": {
      const incidents = await sourceCache.getGoogleCloudIncidents();
      const status = getGoogleProductStatus(statusRef.productId, incidents);

      return {
        serviceId,
        overall: status.overall,
        source: "official",
        updatedAt: status.updatedAt,
        matchedProduct: statusRef.productName,
      };
    }
  }
}

async function fetchStatuspageStatus(providerId: StatuspageProviderId) {
  switch (providerId) {
    case "anthropic":
      return fetchAnthropicStatus();
    case "openai":
      return fetchOpenAIStatus();
    case "cursor":
      return fetchCursorStatus();
  }
}

async function getCachedOfficialValue<T>(
  cacheKey: string,
  fetchValue: () => Promise<T>,
) {
  const cached = await getCachedValue<T>(cacheKey);
  if (cached !== null) return cached;

  const value = await fetchValue();
  await setCachedValue(cacheKey, value);
  return value;
}

async function getCachedValue<T>(cacheKey: string): Promise<T | null> {
  const redis = getRedis();

  if (redis) {
    return redis.get<T>(cacheKey);
  }

  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  return null;
}

async function setCachedValue(cacheKey: string, value: unknown) {
  const redis = getRedis();

  if (redis) {
    await redis.set(cacheKey, value, {
      ex: OFFICIAL_CACHE_TTL_SECONDS,
    });
    return;
  }

  memoryCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + OFFICIAL_CACHE_TTL_SECONDS * 1000,
  });
}

function createUnknownServiceStatus(
  serviceId: string,
  updatedAt = new Date().toISOString(),
): OfficialServiceStatus {
  return {
    serviceId,
    overall: "unknown",
    source: "official",
    updatedAt,
  };
}

function createNotConnectedServiceStatus(serviceId: string): OfficialServiceStatus {
  return {
    serviceId,
    overall: "unknown",
    source: "not_connected",
    updatedAt: new Date().toISOString(),
  };
}

function getStatuspageCacheKey(providerId: StatuspageProviderId) {
  return `official:v1:statuspage:${providerId}`;
}
