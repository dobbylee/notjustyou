export interface CommunityServiceSummary {
  serviceId: string;
  total: number;
  counts: {
    slow: number;
    error: number;
    down: number;
  };
  communityState: string;
}

export interface CommunitySummaryResponse {
  windowMinutes: number;
  updatedAt: string;
  services: CommunityServiceSummary[];
}

export interface InstalledSignalServiceSummary {
  serviceId: string;
  total: number;
  uniqueInstallationsApprox: number;
  countsBySource: Record<string, number>;
  countsBySymptom: Record<string, number>;
  lastSignal: {
    symptom: string;
    source: string;
    observedAt: string;
  } | null;
}

export interface InstalledSignalSummaryResponse {
  windowMinutes: number;
  updatedAt: string;
  services: InstalledSignalServiceSummary[];
}

export interface OfficialServiceStatus {
  serviceId: string;
  overall: string;
  source: "official" | "not_connected";
  updatedAt: string;
}

export interface OfficialProviderAdvisory {
  providerId: string;
  id: string;
  name: string;
  status: string;
  impact: string;
  updatedAt: string;
}

export interface OfficialSummaryResponse {
  updatedAt: string;
  services: OfficialServiceStatus[];
  providerAdvisories?: OfficialProviderAdvisory[];
}

export interface StatusData {
  community: CommunitySummaryResponse | null;
  installedSignals: InstalledSignalSummaryResponse | null;
  official: OfficialSummaryResponse | null;
}
