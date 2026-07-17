import type { ProviderId, StatuspageProviderId } from "../catalog";

export type OfficialOverallStatus =
  | "operational"
  | "service_information"
  | "degraded"
  | "partial_outage"
  | "major_outage"
  | "maintenance"
  | "unknown";

export type OfficialStatusSource = "official" | "not_connected";

export interface OfficialComponentStatus {
  id: string;
  name: string;
  status: OfficialOverallStatus;
  updatedAt: string;
}

export interface OfficialProviderAdvisory {
  providerId: StatuspageProviderId;
  id: string;
  name: string;
  status: string;
  impact: string;
  updatedAt: string;
}

export interface OfficialProviderStatus {
  providerId: ProviderId;
  overall: OfficialOverallStatus;
  source: OfficialStatusSource;
  updatedAt: string;
  components: OfficialComponentStatus[];
  providerAdvisories?: OfficialProviderAdvisory[];
}

export interface OfficialServiceStatus {
  serviceId: string;
  overall: OfficialOverallStatus;
  source: OfficialStatusSource;
  updatedAt: string;
  matchedComponent?: string;
  matchedProduct?: string;
}

export interface StatuspageSummary {
  page?: {
    updated_at?: string;
  };
  status?: {
    indicator?: string;
    description?: string;
  };
  components?: Array<{
    id: string;
    name: string;
    status: string;
    updated_at?: string;
  }>;
  incidents?: Array<{
    id: string;
    name: string;
    status: string;
    impact: string;
    updated_at?: string;
    created_at?: string;
    components?: Array<{
      id: string;
    }>;
  }>;
}

export interface StatuspageComponentsResponse {
  components?: StatuspageSummary["components"];
}
