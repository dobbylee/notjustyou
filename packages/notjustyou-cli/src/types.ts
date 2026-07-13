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

export interface OfficialSummaryResponse {
  updatedAt: string;
  services: OfficialServiceStatus[];
}

export interface StatusData {
  community: CommunitySummaryResponse;
  installedSignals: InstalledSignalSummaryResponse | null;
  official: OfficialSummaryResponse | null;
}

export type SignalSource =
  | "api_middleware"
  | "cli_hook"
  | "ide_extension"
  | "browser_extension"
  | "mcp_monitor"
  | "local_probe";

export interface CollectorRegistrationResponse {
  collectorId: string;
  collectorToken: string;
  expiresAt: string | null;
}

export interface CliConfig {
  configVersion: number;
  baseUrl: string;
  collectorId: string;
  collectorToken: string;
  source: SignalSource;
  serviceIds: string[];
  clientName: string;
  clientVersion: string;
  localHookSignalOptIn?: boolean;
  localReceiverToken?: string;
}

export type PayloadPreviewResult =
  | {
      ok: true;
      kind: "signal" | "hook";
      payload: unknown;
    }
  | {
      ok: false;
      reason: string;
    };

export type SignalSymptom =
  | "slow"
  | "error"
  | "down"
  | "rate_limited"
  | "auth_error"
  | "model_unavailable"
  | "network_error"
  | "tool_failure"
  | "permission_blocked"
  | "unknown";

export interface CliSignalPayload {
  serviceId: string;
  source: "cli_hook";
  symptom: SignalSymptom;
  observedAt?: string;
  durationMs?: number;
  statusCode?: number;
  errorCode?: string;
  clientVersion?: string;
}
