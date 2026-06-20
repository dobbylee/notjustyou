import { fetchInstalledSignalSummary, fetchStatusData } from "./api.js";
import type {
  CommunityServiceSummary,
  InstalledSignalServiceSummary,
  OfficialServiceStatus,
  StatusData,
} from "./types.js";

export const DEFAULT_BASE_URL = "https://notjustyou.dev";

export interface McpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: {
    readOnlyHint: true;
  };
}

export interface ToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export class ToolExecutionError extends Error {}

type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: false;
};

export const TOOLS = [
  {
    name: "list_surfaces",
    title: "List Not Just You Surfaces",
    description:
      "List AI service surfaces with public community, installed-signal, and official status summaries.",
    inputSchema: {
      type: "object",
      properties: {
        provider: {
          type: "string",
          description: "Optional provider id such as openai, anthropic, google, or cursor.",
        },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: "get_surface_status",
    title: "Get Surface Status",
    description:
      "Get public Not Just You status for one service surface by serviceId.",
    inputSchema: {
      type: "object",
      properties: {
        serviceId: {
          type: "string",
          description: "Service id, for example openai-api.",
        },
      },
      required: ["serviceId"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: "get_recent_signals",
    title: "Get Recent Signals",
    description:
      "Get recent installed-client signal aggregates for one service surface.",
    inputSchema: {
      type: "object",
      properties: {
        serviceId: {
          type: "string",
          description: "Service id, for example openai-api.",
        },
        windowMinutes: {
          type: "integer",
          minimum: 1,
          maximum: 60,
          description: "Signal summary window in minutes. Defaults to the server default.",
        },
      },
      required: ["serviceId"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: "explain_privacy",
    title: "Explain Privacy Boundary",
    description: "Explain the public privacy boundary for Not Just You local tools.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
    },
  },
] as const satisfies readonly McpTool[];

export function getBaseUrl() {
  return process.env.NOTJUSTYOU_BASE_URL ?? DEFAULT_BASE_URL;
}

export async function callTool(
  name: string,
  argumentsValue: unknown,
  baseUrl = getBaseUrl(),
): Promise<ToolResult> {
  if (name === "list_surfaces") {
    const args = readObject(argumentsValue);
    rejectUnknownFields(args, ["provider"]);
    const provider = readOptionalString(args.provider, "provider");
    const data = await readStatusData(baseUrl);
    const surfaces = listSurfaceSummaries(data, provider);

    return jsonToolResult({
      surfaces,
      sources: sourceAvailability(data),
    });
  }

  if (name === "get_surface_status") {
    const args = readObject(argumentsValue);
    rejectUnknownFields(args, ["serviceId"]);
    const serviceId = readRequiredString(args.serviceId, "serviceId");
    const data = await readStatusData(baseUrl);
    const status = getSurfaceSummary(data, serviceId);

    return jsonToolResult({
      serviceId,
      found: Boolean(status.community || status.installedSignals || status.official),
      ...status,
      sources: sourceAvailability(data),
    });
  }

  if (name === "get_recent_signals") {
    const args = readObject(argumentsValue);
    rejectUnknownFields(args, ["serviceId", "windowMinutes"]);
    const serviceId = readRequiredString(args.serviceId, "serviceId");
    const windowMinutes = readOptionalWindowMinutes(args.windowMinutes);
    const summary = await readInstalledSignalSummary(baseUrl, {
      serviceId,
      windowMinutes,
    });
    const installedSignals = summary.services.find(
      (service) => service.serviceId === serviceId,
    );

    return jsonToolResult({
      serviceId,
      windowMinutes: summary.windowMinutes,
      installedSignalsAvailable: true,
      installedSignals: installedSignals ? formatInstalled(installedSignals) : null,
    });
  }

  if (name === "explain_privacy") {
    rejectUnknownFields(readObject(argumentsValue), []);

    return jsonToolResult({
      readOnly: true,
      sendsSignals: false,
      requiresCollectorToken: false,
      readsPublicEndpoints: [
        "/api/summary",
        "/api/signals/summary",
        "/api/official",
      ],
      doesNotCollect: [
        "prompt text",
        "request or response bodies",
        "headers",
        "API keys",
        "cookies",
        "source files",
        "diffs",
        "clipboard content",
        "exact IP addresses",
        "account emails",
        "machine or user names",
      ],
    });
  }

  throw new Error(`Unknown tool: ${name}`);
}

export function toolErrorResult(error: unknown): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: error instanceof Error ? error.message : String(error),
      },
    ],
    isError: true,
  };
}

async function readStatusData(
  baseUrl: string,
  options: {
    serviceId?: string;
  } = {},
) {
  try {
    return await fetchStatusData(baseUrl, options);
  } catch (error) {
    throw new ToolExecutionError(
      `Failed to read Not Just You status: ${errorMessage(error)}`,
    );
  }
}

async function readInstalledSignalSummary(
  baseUrl: string,
  options: {
    serviceId: string;
    windowMinutes?: number;
  },
) {
  try {
    return await fetchInstalledSignalSummary(baseUrl, options);
  } catch (error) {
    throw new ToolExecutionError(
      `Failed to read installed signal summary: ${errorMessage(error)}`,
    );
  }
}

function listSurfaceSummaries(data: StatusData, provider?: string) {
  return getServiceIds(data)
    .filter((serviceId) => !provider || getProviderId(serviceId) === provider)
    .map((serviceId) => ({
      serviceId,
      providerId: getProviderId(serviceId),
      ...getSurfaceSummary(data, serviceId),
    }));
}

function getSurfaceSummary(data: StatusData, serviceId: string) {
  const community = data.community.services.find(
    (service) => service.serviceId === serviceId,
  );
  const installedSignals = data.installedSignals?.services.find(
    (service) => service.serviceId === serviceId,
  );
  const official = data.official?.services.find(
    (service) => service.serviceId === serviceId,
  );

  return {
    community: community ? formatCommunity(community) : null,
    installedSignals: installedSignals ? formatInstalled(installedSignals) : null,
    official: official ? formatOfficial(official) : null,
  };
}

function getServiceIds(data: StatusData) {
  return [
    ...new Set([
      ...data.community.services.map((service) => service.serviceId),
      ...(data.installedSignals?.services.map((service) => service.serviceId) ?? []),
      ...(data.official?.services.map((service) => service.serviceId) ?? []),
    ]),
  ];
}

function getProviderId(serviceId: string) {
  return serviceId.split("-")[0] ?? "unknown";
}

function formatCommunity(service: CommunityServiceSummary) {
  return {
    total: service.total,
    counts: service.counts,
    state: service.communityState,
  };
}

function formatInstalled(service: InstalledSignalServiceSummary) {
  return {
    total: service.total,
    uniqueInstallationsApprox: service.uniqueInstallationsApprox,
    countsBySource: numericRecord(service.countsBySource),
    countsBySymptom: numericRecord(service.countsBySymptom),
    lastSignal: service.lastSignal
      ? {
          symptom: service.lastSignal.symptom,
          source: service.lastSignal.source,
          observedAt: service.lastSignal.observedAt,
        }
      : null,
  };
}

function formatOfficial(service: OfficialServiceStatus) {
  return {
    overall: service.overall,
    source: service.source,
    updatedAt: service.updatedAt,
  };
}

function sourceAvailability(data: StatusData) {
  return {
    community: true,
    installedSignals: Boolean(data.installedSignals),
    official: Boolean(data.official),
  };
}

function jsonToolResult(value: Record<string, unknown>): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
    structuredContent: value,
    isError: false,
  };
}

function readObject(value: unknown) {
  if (value === undefined || value === null) return {};

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Tool arguments must be an object.");
  }

  return value as Record<string, unknown>;
}

function rejectUnknownFields(
  value: Record<string, unknown>,
  allowedFields: readonly string[],
) {
  const unknownField = Object.keys(value).find(
    (key) => !allowedFields.includes(key),
  );

  if (unknownField) {
    throw new Error(`Unknown argument: ${unknownField}`);
  }
}

function readRequiredString(value: unknown, name: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }

  return value;
}

function readOptionalString(value: unknown, name: string) {
  if (value === undefined) return undefined;

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} must be a non-empty string when provided.`);
  }

  return value;
}

function readOptionalWindowMinutes(value: unknown) {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 60) {
    throw new Error("windowMinutes must be an integer from 1 to 60 when provided.");
  }

  return Number(value);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function numericRecord(value: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => {
      const [, count] = entry;

      return typeof count === "number";
    }),
  );
}
