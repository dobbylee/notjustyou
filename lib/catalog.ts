export type ProviderId = "anthropic" | "openai" | "google" | "cursor";

export type SurfaceType = "web" | "desktop" | "api" | "cli" | "code" | "ide";

export type ReportStatus = "slow" | "error" | "down";

export type OfficialStatusSource = "official" | "not_connected";

export interface Provider {
  id: ProviderId;
  name: string;
  officialStatusSource: OfficialStatusSource;
}

export interface ServiceSurface {
  id: string;
  providerId: ProviderId;
  name: string;
  surfaceType: SurfaceType;
  hasOfficialStatus: boolean;
  reportOptions: readonly ReportStatus[];
}

export const REPORT_STATUSES = ["slow", "error", "down"] as const satisfies
  readonly ReportStatus[];

export const PROVIDERS = [
  {
    id: "anthropic",
    name: "Anthropic",
    officialStatusSource: "official",
  },
  {
    id: "openai",
    name: "OpenAI",
    officialStatusSource: "official",
  },
  {
    id: "google",
    name: "Google",
    officialStatusSource: "not_connected",
  },
  {
    id: "cursor",
    name: "Cursor",
    officialStatusSource: "not_connected",
  },
] as const satisfies readonly Provider[];

export const CATALOG = [
  {
    id: "anthropic-claude-code",
    providerId: "anthropic",
    name: "Claude Code",
    surfaceType: "code",
    hasOfficialStatus: true,
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "anthropic-claude-desktop",
    providerId: "anthropic",
    name: "Claude Desktop",
    surfaceType: "desktop",
    hasOfficialStatus: true,
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "anthropic-claude-web",
    providerId: "anthropic",
    name: "Claude Web",
    surfaceType: "web",
    hasOfficialStatus: true,
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "anthropic-claude-api",
    providerId: "anthropic",
    name: "Claude API",
    surfaceType: "api",
    hasOfficialStatus: true,
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "openai-codex-cli",
    providerId: "openai",
    name: "Codex CLI",
    surfaceType: "cli",
    hasOfficialStatus: true,
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "openai-codex-desktop",
    providerId: "openai",
    name: "Codex Desktop",
    surfaceType: "desktop",
    hasOfficialStatus: true,
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "openai-chatgpt-desktop",
    providerId: "openai",
    name: "ChatGPT Desktop",
    surfaceType: "desktop",
    hasOfficialStatus: true,
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "openai-chatgpt-web",
    providerId: "openai",
    name: "ChatGPT Web",
    surfaceType: "web",
    hasOfficialStatus: true,
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "openai-api",
    providerId: "openai",
    name: "OpenAI API",
    surfaceType: "api",
    hasOfficialStatus: true,
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "google-gemini-web",
    providerId: "google",
    name: "Gemini Web",
    surfaceType: "web",
    hasOfficialStatus: false,
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "google-antigravity",
    providerId: "google",
    name: "Antigravity",
    surfaceType: "code",
    hasOfficialStatus: false,
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "cursor-main",
    providerId: "cursor",
    name: "Cursor",
    surfaceType: "ide",
    hasOfficialStatus: false,
    reportOptions: REPORT_STATUSES,
  },
] as const satisfies readonly ServiceSurface[];

export function getProvider(providerId: ProviderId) {
  return PROVIDERS.find((provider) => provider.id === providerId);
}

export function getService(serviceId: string) {
  return CATALOG.find((service) => service.id === serviceId);
}

export function isReportStatus(value: unknown): value is ReportStatus {
  return (
    typeof value === "string" &&
    REPORT_STATUSES.includes(value as ReportStatus)
  );
}
