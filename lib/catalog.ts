export type ProviderId = "anthropic" | "openai" | "google" | "cursor";

export type SurfaceType =
  | "web"
  | "desktop"
  | "app"
  | "api"
  | "cli"
  | "code"
  | "ide"
  | "collaboration";

export type ReportStatus = "slow" | "error" | "down";

export type StatuspageProviderId = Extract<
  ProviderId,
  "anthropic" | "openai" | "cursor"
>;

export type OfficialStatusRef =
  | {
      providerId: StatuspageProviderId;
      kind: "statuspage_component";
      componentName: string;
    }
  | {
      providerId: "google";
      kind: "google_workspace_product" | "google_cloud_product";
      productId: string;
      productName: string;
    };

export interface Provider {
  id: ProviderId;
  name: string;
}

export interface ServiceSurface {
  id: string;
  providerId: ProviderId;
  name: string;
  surfaceType: SurfaceType;
  officialStatusRef?: OfficialStatusRef;
  reportOptions: readonly ReportStatus[];
}

export const REPORT_STATUSES = ["slow", "error", "down"] as const satisfies
  readonly ReportStatus[];

export const PROVIDERS = [
  {
    id: "anthropic",
    name: "Anthropic",
  },
  {
    id: "openai",
    name: "OpenAI",
  },
  {
    id: "google",
    name: "Google",
  },
  {
    id: "cursor",
    name: "Cursor",
  },
] as const satisfies readonly Provider[];

export const CATALOG = [
  {
    id: "anthropic-claude-code",
    providerId: "anthropic",
    name: "Claude Code",
    surfaceType: "code",
    officialStatusRef: {
      providerId: "anthropic",
      kind: "statuspage_component",
      componentName: "Claude Code",
    },
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "anthropic-claude-ai",
    providerId: "anthropic",
    name: "Claude.ai",
    surfaceType: "web",
    officialStatusRef: {
      providerId: "anthropic",
      kind: "statuspage_component",
      componentName: "claude.ai",
    },
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "anthropic-claude-cowork",
    providerId: "anthropic",
    name: "Claude Cowork",
    surfaceType: "collaboration",
    officialStatusRef: {
      providerId: "anthropic",
      kind: "statuspage_component",
      componentName: "Claude Cowork",
    },
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "anthropic-claude-api",
    providerId: "anthropic",
    name: "Claude API",
    surfaceType: "api",
    officialStatusRef: {
      providerId: "anthropic",
      kind: "statuspage_component",
      componentName: "Claude API (api.anthropic.com)",
    },
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "openai-codex-cli",
    providerId: "openai",
    name: "Codex CLI",
    surfaceType: "cli",
    officialStatusRef: {
      providerId: "openai",
      kind: "statuspage_component",
      componentName: "CLI",
    },
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "openai-codex-app",
    providerId: "openai",
    name: "Codex App",
    surfaceType: "app",
    officialStatusRef: {
      providerId: "openai",
      kind: "statuspage_component",
      componentName: "App",
    },
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "openai-chatgpt",
    providerId: "openai",
    name: "ChatGPT",
    surfaceType: "app",
    officialStatusRef: {
      providerId: "openai",
      kind: "statuspage_component",
      componentName: "Conversations",
    },
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "openai-api",
    providerId: "openai",
    name: "OpenAI API",
    surfaceType: "api",
    officialStatusRef: {
      providerId: "openai",
      kind: "statuspage_component",
      componentName: "Chat Completions",
    },
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "google-gemini-cli",
    providerId: "google",
    name: "Gemini CLI",
    surfaceType: "cli",
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "google-antigravity",
    providerId: "google",
    name: "Antigravity",
    surfaceType: "code",
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "google-gemini-web",
    providerId: "google",
    name: "Gemini Web",
    surfaceType: "web",
    officialStatusRef: {
      providerId: "google",
      kind: "google_workspace_product",
      productId: "npdyhgECDJ6tB66MxXyo",
      productName: "Gemini",
    },
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "google-gemini-api",
    providerId: "google",
    name: "Gemini API",
    surfaceType: "api",
    officialStatusRef: {
      providerId: "google",
      kind: "google_cloud_product",
      productId: "Z0FZJAMvEB4j3NbCJs6B",
      productName: "Vertex Gemini API",
    },
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "cursor-ide",
    providerId: "cursor",
    name: "Cursor IDE",
    surfaceType: "ide",
    officialStatusRef: {
      providerId: "cursor",
      kind: "statuspage_component",
      componentName: "IDE",
    },
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "cursor-cli",
    providerId: "cursor",
    name: "Cursor CLI",
    surfaceType: "cli",
    officialStatusRef: {
      providerId: "cursor",
      kind: "statuspage_component",
      componentName: "CLI",
    },
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
