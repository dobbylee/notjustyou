import type { StatuspageProviderId } from "../catalog";
import type {
  OfficialComponentStatus,
  OfficialOverallStatus,
  OfficialProviderAdvisory,
  OfficialProviderStatus,
  StatuspageComponentsResponse,
  StatuspageSummary,
} from "./types";

const FETCH_TIMEOUT_MS = 4_000;

export async function fetchStatuspageProvider(
  providerId: StatuspageProviderId,
  url: string,
  componentsUrl?: string,
): Promise<OfficialProviderStatus> {
  const payload = await fetchStatuspageJson<StatuspageSummary>(url);
  const updatedAt = payload.page?.updated_at ?? new Date().toISOString();
  let components = payload.components ?? [];

  if (componentsUrl) {
    const componentsPayload =
      await fetchStatuspageJson<StatuspageComponentsResponse>(componentsUrl);
    components = componentsPayload.components ?? components;
  }

  return {
    providerId,
    overall: mapStatuspageIndicator(payload.status?.indicator),
    source: "official",
    updatedAt,
    components: components.map((component) => ({
      id: component.id,
      name: component.name,
      status: mapStatuspageComponentStatus(component.status),
      updatedAt: component.updated_at ?? updatedAt,
    })),
    providerAdvisories: getStatuspageProviderAdvisories(
      providerId,
      payload,
      updatedAt,
    ),
  };
}

async function fetchStatuspageJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
      },
      next: {
        revalidate: 0,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Status fetch failed with ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function findStatuspageComponent(
  status: OfficialProviderStatus,
  componentName: string,
): OfficialComponentStatus | undefined {
  const expectedName = normalizeComponentName(componentName);

  return status.components.find(
    (component) => normalizeComponentName(component.name) === expectedName,
  );
}

export function findStatuspageComponents(
  status: OfficialProviderStatus,
  componentNames: readonly string[],
): OfficialComponentStatus[] | undefined {
  const components = componentNames.map((componentName) =>
    findStatuspageComponent(status, componentName),
  );

  return components.every(
    (component): component is OfficialComponentStatus => component !== undefined,
  )
    ? components
    : undefined;
}

export function getWorstStatuspageComponent(
  components: readonly OfficialComponentStatus[],
): OfficialComponentStatus | undefined {
  return components.reduce<OfficialComponentStatus | undefined>(
    (worst, component) => {
      if (!worst) return component;

      const rankDifference =
        getStatusRank(component.status) - getStatusRank(worst.status);
      if (rankDifference > 0) return component;
      if (rankDifference < 0) return worst;

      return Date.parse(component.updatedAt) > Date.parse(worst.updatedAt)
        ? component
        : worst;
    },
    undefined,
  );
}

export function getStatuspageProviderAdvisories(
  providerId: StatuspageProviderId,
  payload: StatuspageSummary,
  fallbackUpdatedAt: string,
): OfficialProviderAdvisory[] {
  return (payload.incidents ?? [])
    .filter(
      (incident) =>
        incident.status !== "resolved" && (incident.components?.length ?? 0) === 0,
    )
    .map((incident) => ({
      providerId,
      id: incident.id,
      name: incident.name,
      status: incident.status,
      impact: incident.impact,
      updatedAt: incident.updated_at ?? incident.created_at ?? fallbackUpdatedAt,
    }));
}

function normalizeComponentName(name: string) {
  return name.trim().toLowerCase();
}

export function mapStatuspageIndicator(
  indicator: string | undefined,
): OfficialOverallStatus {
  switch (indicator) {
    case "none":
      return "operational";
    case "minor":
      return "degraded";
    case "major":
      return "partial_outage";
    case "critical":
      return "major_outage";
    case "maintenance":
      return "maintenance";
    default:
      return "unknown";
  }
}

export function mapStatuspageComponentStatus(
  status: string,
): OfficialOverallStatus {
  switch (status) {
    case "operational":
      return "operational";
    case "degraded_performance":
      return "degraded";
    case "partial_outage":
      return "partial_outage";
    case "major_outage":
      return "major_outage";
    case "under_maintenance":
      return "maintenance";
    default:
      return "unknown";
  }
}

function getStatusRank(status: OfficialOverallStatus) {
  switch (status) {
    case "operational":
      return 0;
    case "service_information":
      return 1;
    case "maintenance":
      return 2;
    case "degraded":
      return 3;
    case "partial_outage":
      return 4;
    case "major_outage":
      return 5;
    case "unknown":
      return 6;
  }
}
