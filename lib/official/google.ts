import type { OfficialOverallStatus } from "./types";

const FETCH_TIMEOUT_MS = 4_000;

const GOOGLE_WORKSPACE_INCIDENTS_URL =
  "https://www.google.com/appsstatus/dashboard/incidents.json";
const GOOGLE_CLOUD_INCIDENTS_URL = "https://status.cloud.google.com/incidents.json";

interface GoogleAffectedProduct {
  id: string;
  title: string;
}

interface GoogleIncidentUpdate {
  when?: string;
  status?: string;
}

export interface GoogleStatusIncident {
  id: string;
  end?: string;
  modified?: string;
  created?: string;
  status_impact?: string;
  affected_products?: GoogleAffectedProduct[];
  most_recent_update?: GoogleIncidentUpdate;
}

export interface GoogleProductStatus {
  overall: OfficialOverallStatus;
  updatedAt: string;
}

export function fetchGoogleWorkspaceIncidents() {
  return fetchGoogleIncidents(GOOGLE_WORKSPACE_INCIDENTS_URL);
}

export function fetchGoogleCloudIncidents() {
  return fetchGoogleIncidents(GOOGLE_CLOUD_INCIDENTS_URL);
}

export function getGoogleProductStatus(
  productId: string,
  incidents: readonly GoogleStatusIncident[],
  now = new Date(),
): GoogleProductStatus {
  const activeIncidents = incidents.filter(
    (incident) =>
      incidentAffectsProduct(incident, productId) && isIncidentActive(incident, now),
  );

  if (activeIncidents.length === 0) {
    return {
      overall: "operational",
      updatedAt: now.toISOString(),
    };
  }

  const worstIncident = activeIncidents.reduce((worst, incident) => {
    const currentStatus = getIncidentOverallStatus(incident);
    const worstStatus = getIncidentOverallStatus(worst);

    return getStatusRank(currentStatus) > getStatusRank(worstStatus) ? incident : worst;
  });

  return {
    overall: getIncidentOverallStatus(worstIncident),
    updatedAt:
      worstIncident.most_recent_update?.when ??
      worstIncident.modified ??
      worstIncident.created ??
      now.toISOString(),
  };
}

async function fetchGoogleIncidents(url: string): Promise<GoogleStatusIncident[]> {
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
      throw new Error(`Google status fetch failed with ${response.status}`);
    }

    return (await response.json()) as GoogleStatusIncident[];
  } finally {
    clearTimeout(timeout);
  }
}

function incidentAffectsProduct(incident: GoogleStatusIncident, productId: string) {
  return (
    incident.affected_products?.some((product) => product.id === productId) ?? false
  );
}

function isIncidentActive(incident: GoogleStatusIncident, now: Date) {
  if (!incident.end) return true;

  const endTime = Date.parse(incident.end);
  return Number.isNaN(endTime) ? false : endTime > now.getTime();
}

function getIncidentOverallStatus(
  incident: GoogleStatusIncident,
): OfficialOverallStatus {
  const status =
    incident.most_recent_update?.status ?? incident.status_impact ?? "unknown";

  switch (status) {
    case "AVAILABLE":
      return "operational";
    case "SERVICE_INFORMATION":
      return "service_information";
    case "SERVICE_DISRUPTION":
      return "degraded";
    case "SERVICE_OUTAGE":
      return "major_outage";
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
      return -1;
  }
}
