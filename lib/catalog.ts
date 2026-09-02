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
      providerId: StatuspageProviderId;
      kind: "statuspage_components";
      componentNames: readonly string[];
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
      componentName: "Codex in ChatGPT Desktop",
    },
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "openai-codex-web",
    providerId: "openai",
    name: "Codex Web",
    surfaceType: "web",
    officialStatusRef: {
      providerId: "openai",
      kind: "statuspage_component",
      componentName: "Codex Web",
    },
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "openai-codex-vscode",
    providerId: "openai",
    name: "Codex VS Code extension",
    surfaceType: "ide",
    officialStatusRef: {
      providerId: "openai",
      kind: "statuspage_component",
      componentName: "VS Code extension",
    },
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "openai-codex-api",
    providerId: "openai",
    name: "Codex API",
    surfaceType: "api",
    officialStatusRef: {
      providerId: "openai",
      kind: "statuspage_component",
      componentName: "Codex API",
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
    id: "openai-chatgpt-work",
    providerId: "openai",
    name: "ChatGPT Work",
    surfaceType: "collaboration",
    officialStatusRef: {
      providerId: "openai",
      kind: "statuspage_component",
      componentName: "ChatGPT Work",
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
      kind: "statuspage_components",
      componentNames: ["Chat Completions", "Responses"],
    },
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "google-antigravity-cli",
    providerId: "google",
    name: "Antigravity CLI",
    surfaceType: "cli",
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "google-antigravity",
    providerId: "google",
    name: "Antigravity 2.0",
    surfaceType: "app",
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "google-antigravity-ide",
    providerId: "google",
    name: "Antigravity IDE",
    surfaceType: "ide",
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
    name: "Gemini Developer API",
    surfaceType: "api",
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "google-vertex-gemini-api",
    providerId: "google",
    name: "Vertex Gemini API",
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
  {
    id: "cursor-cloud-agents",
    providerId: "cursor",
    name: "Cursor Cloud Agents",
    surfaceType: "code",
    officialStatusRef: {
      providerId: "cursor",
      kind: "statuspage_component",
      componentName: "Cloud Agents",
    },
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "cursor-review-agents",
    providerId: "cursor",
    name: "Cursor Review Agents",
    surfaceType: "code",
    officialStatusRef: {
      providerId: "cursor",
      kind: "statuspage_component",
      componentName: "Review Agents",
    },
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "cursor-automations",
    providerId: "cursor",
    name: "Cursor Automations",
    surfaceType: "code",
    officialStatusRef: {
      providerId: "cursor",
      kind: "statuspage_component",
      componentName: "Automations",
    },
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "cursor-origin",
    providerId: "cursor",
    name: "Cursor Origin",
    surfaceType: "collaboration",
    officialStatusRef: {
      providerId: "cursor",
      kind: "statuspage_component",
      componentName: "Origin",
    },
    reportOptions: REPORT_STATUSES,
  },
  {
    id: "cursor-grok-bot",
    providerId: "cursor",
    name: "Grok Bot",
    surfaceType: "collaboration",
    officialStatusRef: {
      providerId: "cursor",
      kind: "statuspage_component",
      componentName: "Grok Bot",
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
