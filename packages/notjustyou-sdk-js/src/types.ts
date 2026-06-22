export type SupportedServiceId = "openai-api";

export type SignalSymptom =
  | "slow"
  | "error"
  | "rate_limited"
  | "auth_error"
  | "network_error"
  | "unknown";

export interface RecordAiCallOptions {
  serviceId: SupportedServiceId;
  slowAfterMs?: number;
  baseUrl?: string;
}

export interface SdkConfig {
  configVersion: number;
  baseUrl: string;
  collectorToken: string;
  source: "api_middleware";
  serviceIds: string[];
  clientVersion: string;
  installationId: string;
}

export interface ProblemSignalPayload {
  serviceId: SupportedServiceId;
  source: "api_middleware";
  symptom: SignalSymptom;
  observedAt: string;
  durationMs: number;
  statusCode?: number;
  errorCode?: string;
  installationId: string;
  clientVersion: string;
}
