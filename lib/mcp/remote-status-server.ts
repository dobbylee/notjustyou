import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  getRemoteRecentSignals,
  getRemoteStatusBaseUrl,
  getRemoteSurfaceStatus,
  listRemoteSurfaces,
} from "@/lib/mcp/remote-status-data";

const SERVER_NAME = "notjustyou-status";
const SERVER_VERSION = "0.1.0";

const statusToolMetadata = {
  list_surfaces: {
    title: "List Not Just You Surfaces",
    description:
      "List AI service surfaces with public community, installed-signal, and official status summaries.",
  },
  get_surface_status: {
    title: "Get Surface Status",
    description:
      "Get public Not Just You status for one service surface by serviceId.",
  },
  get_recent_signals: {
    title: "Get Recent Signals",
    description:
      "Get recent installed-client signal aggregates for one service surface.",
  },
  explain_privacy: {
    title: "Explain Privacy Boundary",
    description: "Explain the public privacy boundary for Not Just You status tools.",
  },
} as const;

type StatusToolName = keyof typeof statusToolMetadata;

export const REMOTE_STATUS_TOOL_NAMES = Object.keys(
  statusToolMetadata,
) as StatusToolName[];

const countRecordSchema = z.record(z.string(), z.number());
const communitySchema = z
  .object({
    total: z.number(),
    counts: countRecordSchema,
    state: z.string(),
  })
  .nullable();
const installedSignalsSchema = z
  .object({
    total: z.number(),
    uniqueInstallationsApprox: z.number(),
    countsBySource: countRecordSchema,
    countsBySymptom: countRecordSchema,
    lastSignal: z
      .object({
        symptom: z.string(),
        source: z.string(),
        observedAt: z.string(),
      })
      .nullable(),
  })
  .nullable();
const officialSchema = z
  .object({
    overall: z.string(),
    source: z.string(),
    updatedAt: z.string(),
  })
  .nullable();
const advisorySchema = z.object({
  providerId: z.string(),
  id: z.string(),
  name: z.string(),
  status: z.string(),
  impact: z.string(),
  updatedAt: z.string(),
});
const sourceAvailabilitySchema = z.object({
  community: z.boolean(),
  installedSignals: z.boolean(),
  official: z.boolean(),
});

const privacyResult = {
  remoteStatusOnly: true,
  readOnlyStatusTools: true,
  toolSubmitsSignals: false,
  requiresAuthentication: false,
  readsPublicEndpoints: [
    "/api/summary",
    "/api/signals/summary",
    "/api/official",
  ],
  transportData: {
    jsonRpcBodyProcessedInMemory: true,
    transportHeadersProcessedInMemory: true,
    trustedClientAddressProcessedForRateLimit: true,
    rawClientAddressStored: false,
    clientAddressHashCounterRetentionSeconds: 60,
  },
  doesNotCollect: [
    "AI provider prompt text",
    "AI provider messages",
    "AI provider request or response bodies",
    "AI provider request or response headers",
    "AI provider API keys",
    "AI provider cookies",
    "source files",
    "diffs",
    "file paths",
    "clipboard content",
    "account emails",
    "machine names",
    "local usernames",
    "workspace identifiers",
  ],
};

export function createRemoteStatusMcpServer(baseUrl = getRemoteStatusBaseUrl()) {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      instructions:
        "Use these read-only tools to check public AI service status. Keep official status, community reports, and installed-client signals separate. Do not claim a confirmed outage from one source alone.",
    },
  );

  server.registerTool(
    "list_surfaces",
    {
      ...toolMetadata("list_surfaces"),
      inputSchema: z.strictObject({
        provider: z
          .string()
          .min(1)
          .optional()
          .describe("Optional provider id such as openai, anthropic, google, or cursor."),
      }),
      outputSchema: {
        surfaces: z.array(
          z.object({
            serviceId: z.string(),
            providerId: z.string(),
            community: communitySchema,
            installedSignals: installedSignalsSchema,
            official: officialSchema,
          }),
        ),
        providerAdvisories: z.array(advisorySchema),
        sources: sourceAvailabilitySchema,
      },
    },
    async ({ provider }) =>
      runStatusOperation(() => listRemoteSurfaces(baseUrl, provider)),
  );

  server.registerTool(
    "get_surface_status",
    {
      ...toolMetadata("get_surface_status"),
      inputSchema: z.strictObject({
        serviceId: z.string().min(1).describe("Service id, for example openai-api."),
      }),
      outputSchema: {
        serviceId: z.string(),
        found: z.boolean(),
        community: communitySchema,
        installedSignals: installedSignalsSchema,
        official: officialSchema,
        providerAdvisories: z.array(advisorySchema),
        sources: sourceAvailabilitySchema,
      },
    },
    async ({ serviceId }) =>
      runStatusOperation(() => getRemoteSurfaceStatus(baseUrl, serviceId)),
  );

  server.registerTool(
    "get_recent_signals",
    {
      ...toolMetadata("get_recent_signals"),
      inputSchema: z.strictObject({
        serviceId: z.string().min(1).describe("Service id, for example openai-api."),
        windowMinutes: z
          .number()
          .int()
          .min(1)
          .max(60)
          .optional()
          .describe("Recent signal window in minutes, from 1 to 60."),
      }),
      outputSchema: {
        serviceId: z.string(),
        windowMinutes: z.number(),
        installedSignalsAvailable: z.boolean(),
        installedSignals: installedSignalsSchema,
      },
    },
    async ({ serviceId, windowMinutes }) =>
      runStatusOperation(() =>
        getRemoteRecentSignals(baseUrl, serviceId, windowMinutes),
      ),
  );

  server.registerTool(
    "explain_privacy",
    {
      ...toolMetadata("explain_privacy"),
      inputSchema: z.strictObject({}),
      outputSchema: {
        remoteStatusOnly: z.boolean(),
        readOnlyStatusTools: z.boolean(),
        toolSubmitsSignals: z.boolean(),
        requiresAuthentication: z.boolean(),
        readsPublicEndpoints: z.array(z.string()),
        transportData: z.object({
          jsonRpcBodyProcessedInMemory: z.boolean(),
          transportHeadersProcessedInMemory: z.boolean(),
          trustedClientAddressProcessedForRateLimit: z.boolean(),
          rawClientAddressStored: z.boolean(),
          clientAddressHashCounterRetentionSeconds: z.number(),
        }),
        doesNotCollect: z.array(z.string()),
      },
    },
    async () => jsonResult(privacyResult),
  );

  return server;
}

function toolMetadata(name: StatusToolName) {
  return {
    ...statusToolMetadata[name],
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  };
}

async function runStatusOperation(operation: () => Promise<Record<string, unknown>>) {
  try {
    return jsonResult(await operation());
  } catch {
    return {
      content: [
        {
          type: "text" as const,
          text: "Not Just You status is temporarily unavailable.",
        },
      ],
      isError: true,
    };
  }
}

function jsonResult(value: Record<string, unknown>) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
    structuredContent: value,
  };
}
