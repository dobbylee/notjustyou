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
import {
  findStatuspageComponent,
  findStatuspageComponents,
  getWorstStatuspageComponent,
} from "./statuspage";
import type {
  OfficialProviderAdvisory,
  OfficialProviderStatus,
  OfficialServiceStatus,
} from "./types";

const OFFICIAL_CACHE_TTL_SECONDS = 120;

interface OfficialSummaryResponse {
  updatedAt: string;
  services: OfficialServiceStatus[];
  providerAdvisories: OfficialProviderAdvisory[];
}

export async function getOfficialSummary(): Promise<OfficialSummaryResponse> {
  const sourceCache = createRequestSourceCache();

  const services = await Promise.all(
    CATALOG.map((service) => getOfficialServiceStatus(service, sourceCache)),
  );
  const providerAdvisories = await getProviderAdvisories(sourceCache);

  return {
    updatedAt: new Date().toISOString(),
    services,
    providerAdvisories,
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
    case "statuspage_components": {
      const providerStatus = await sourceCache.getStatuspageStatus(
        statusRef.providerId,
      );
      const components = findStatuspageComponents(
        providerStatus,
        statusRef.componentNames,
      );
      const worstComponent = components
        ? getWorstStatuspageComponent(components)
        : undefined;

      if (!components || !worstComponent) {
        return createUnknownServiceStatus(serviceId, providerStatus.updatedAt);
      }

      return {
        serviceId,
        overall: worstComponent.status,
        source: "official",
        updatedAt: worstComponent.updatedAt,
        matchedComponent: components
          .map((component) => component.name)
          .join(", "),
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
  const redis = await getRedis();
  const cached = await redis.get(cacheKey);
  return cached === null ? null : (JSON.parse(cached) as T);
}

async function setCachedValue(cacheKey: string, value: unknown) {
  const redis = await getRedis();
  await redis.set(cacheKey, JSON.stringify(value), {
    expiration: {
      type: "EX",
      value: OFFICIAL_CACHE_TTL_SECONDS,
    },
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
  return `official:v2:statuspage:${providerId}`;
}

async function getProviderAdvisories(
  sourceCache: ReturnType<typeof createRequestSourceCache>,
) {
  const advisoryGroups = await Promise.all(
    (["anthropic", "openai", "cursor"] as const).map(async (providerId) => {
      try {
        const providerStatus = await sourceCache.getStatuspageStatus(providerId);
        return providerStatus.providerAdvisories ?? [];
      } catch {
        return [];
      }
    }),
  );

  return advisoryGroups.flat();
}
