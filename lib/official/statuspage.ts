import type { StatuspageProviderId } from "../catalog";
import type {
  OfficialComponentStatus,
  OfficialOverallStatus,
  OfficialProviderStatus,
  StatuspageSummary,
} from "./types";

const FETCH_TIMEOUT_MS = 4_000;

export async function fetchStatuspageProvider(
  providerId: StatuspageProviderId,
  url: string,
): Promise<OfficialProviderStatus> {
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

    const payload = (await response.json()) as StatuspageSummary;
    const updatedAt = payload.page?.updated_at ?? new Date().toISOString();

    return {
      providerId,
      overall: mapStatuspageIndicator(payload.status?.indicator),
      source: "official",
      updatedAt,
      components:
        payload.components?.map((component) => ({
          id: component.id,
          name: component.name,
          status: mapStatuspageComponentStatus(component.status),
          updatedAt: component.updated_at ?? updatedAt,
        })) ?? [],
    };
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
