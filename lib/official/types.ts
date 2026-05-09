import type { ProviderId } from "../catalog";

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

export interface OfficialProviderStatus {
  providerId: ProviderId;
  overall: OfficialOverallStatus;
  source: OfficialStatusSource;
  updatedAt: string;
  components: OfficialComponentStatus[];
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
}
