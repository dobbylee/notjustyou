import type { ProviderId } from "../catalog";

export type OfficialOverallStatus =
  | "operational"
  | "degraded"
  | "partial_outage"
  | "major_outage"
  | "maintenance"
  | "unknown";

export interface OfficialComponentStatus {
  id: string;
  name: string;
  status: OfficialOverallStatus;
}

export interface OfficialProviderStatus {
  providerId: ProviderId;
  overall: OfficialOverallStatus;
  source: "official" | "not_connected";
  updatedAt: string;
  components: OfficialComponentStatus[];
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
  }>;
}
