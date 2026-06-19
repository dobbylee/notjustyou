import { z } from "zod";
import { getService } from "../catalog";

export const SIGNAL_SOURCES = [
  "api_middleware",
  "cli_hook",
  "ide_extension",
  "browser_extension",
  "mcp_monitor",
  "local_probe",
] as const;

export const SIGNAL_SYMPTOMS = [
  "slow",
  "error",
  "down",
  "rate_limited",
  "auth_error",
  "model_unavailable",
  "network_error",
  "tool_failure",
  "permission_blocked",
  "unknown",
] as const;

export type SignalSource = (typeof SIGNAL_SOURCES)[number];
export type SignalSymptom = (typeof SIGNAL_SYMPTOMS)[number];

export const problemSignalInputSchema = z
  .object({
    serviceId: z.string().min(1).max(80),
    source: z.enum(SIGNAL_SOURCES),
    symptom: z.enum(SIGNAL_SYMPTOMS),
    observedAt: z.string().datetime().optional(),
    durationMs: z.number().int().min(0).max(600_000).optional(),
    statusCode: z.number().int().min(100).max(599).optional(),
    errorCode: z.string().min(1).max(120).optional(),
    installationId: z.string().min(1).max(120).optional(),
    clientVersion: z.string().min(1).max(80).optional(),
    regionHint: z.string().min(1).max(40).optional(),
  })
  .strict()
  .refine((value) => Boolean(getService(value.serviceId)), {
    message: "Unknown service",
    path: ["serviceId"],
  });

export const collectorRegistrationSchema = z
  .object({
    source: z.enum(SIGNAL_SOURCES),
    serviceIds: z.array(z.string().min(1).max(80)).min(1).max(25),
    clientName: z.string().min(1).max(80).regex(/^[a-z0-9][a-z0-9._-]*$/),
    clientVersion: z.string().min(1).max(80),
  })
  .strict()
  .refine(
    (value) => value.serviceIds.every((serviceId) => Boolean(getService(serviceId))),
    {
      message: "Unknown service",
      path: ["serviceIds"],
    },
  );

export const collectorHeartbeatSchema = z
  .object({
    installationId: z.string().min(1).max(120),
    clientVersion: z.string().min(1).max(80),
  })
  .strict();

export type ProblemSignalInput = z.infer<typeof problemSignalInputSchema>;
export type CollectorRegistrationInput = z.infer<
  typeof collectorRegistrationSchema
>;
export type CollectorHeartbeatInput = z.infer<typeof collectorHeartbeatSchema>;

export interface StoredProblemSignal extends ProblemSignalInput {
  collectorId: string;
  observedAt: string;
  receivedAt: string;
}

export function parseProblemSignalInput(input: unknown) {
  return problemSignalInputSchema.safeParse(input);
}
