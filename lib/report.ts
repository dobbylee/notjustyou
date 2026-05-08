import { z } from "zod";
import { getService, isReportStatus } from "./catalog";

export const REPORT_WINDOW_MINUTES = 10;
export const COUNTER_TTL_SECONDS = 2 * 60 * 60;
export const DEDUPE_TTL_SECONDS = 3 * 60;

export const reportRequestSchema = z.object({
  serviceId: z.string().min(1),
  status: z.string().min(1),
});

export type ReportRequestBody = z.infer<typeof reportRequestSchema>;

export function validateReportRequest(input: unknown) {
  const parsed = reportRequestSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false as const,
      reason: "invalid_request" as const,
    };
  }

  const service = getService(parsed.data.serviceId);
  if (!service) {
    return {
      ok: false as const,
      reason: "invalid_service" as const,
    };
  }

  if (!isReportStatus(parsed.data.status)) {
    return {
      ok: false as const,
      reason: "invalid_status" as const,
    };
  }

  if (!service.reportOptions.includes(parsed.data.status)) {
    return {
      ok: false as const,
      reason: "unsupported_status" as const,
    };
  }

  return {
    ok: true as const,
    service,
    status: parsed.data.status,
  };
}
