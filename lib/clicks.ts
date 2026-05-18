import { z } from "zod";
import {
  CATALOG,
  PROVIDERS,
  getProvider,
  getService,
  isReportStatus,
  type ProviderId,
  type ReportStatus,
} from "./catalog";

export const CLICK_WINDOW_HOURS = 24 * 7;
export const CLICK_COUNTER_TTL_SECONDS = (CLICK_WINDOW_HOURS + 24) * 60 * 60;

const HOUR_MS = 60 * 60 * 1000;

export type ClickEventName =
  | "report_button"
  | "provider_tab"
  | "refresh_button"
  | "copy_link";

const clickEventSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("report_button"),
    serviceId: z.string().min(1),
    status: z.string().min(1),
  }),
  z.object({
    event: z.literal("provider_tab"),
    providerId: z.string().min(1),
  }),
  z.object({
    event: z.literal("refresh_button"),
  }),
  z.object({
    event: z.literal("copy_link"),
  }),
]);

export type ClickEventInput = z.infer<typeof clickEventSchema>;

export interface ClickMetricSpec {
  id: string;
  event: ClickEventName;
  label: string;
  providerId?: ProviderId;
  serviceId?: string;
  status?: ReportStatus;
}

export interface ClickMetricSummary extends ClickMetricSpec {
  total: number;
}

export interface ClickSummaryResponse {
  windowHours: number;
  updatedAt: string;
  metrics: ClickMetricSummary[];
}

export function validateClickEvent(input: unknown) {
  const parsed = clickEventSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false as const,
      reason: "invalid_request" as const,
    };
  }

  switch (parsed.data.event) {
    case "report_button": {
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
        metricId: getReportButtonMetricId(service.id, parsed.data.status),
      };
    }
    case "provider_tab": {
      const provider = getProvider(parsed.data.providerId as ProviderId);

      if (!provider) {
        return {
          ok: false as const,
          reason: "invalid_provider" as const,
        };
      }

      return {
        ok: true as const,
        metricId: getProviderTabMetricId(provider.id),
      };
    }
    case "refresh_button":
      return {
        ok: true as const,
        metricId: "refresh_button",
      };
    case "copy_link":
      return {
        ok: true as const,
        metricId: "copy_link",
      };
  }
}

export function getClickMetricSpecs(): ClickMetricSpec[] {
  return [
    ...CATALOG.flatMap((service) =>
      service.reportOptions.map((status) => ({
        id: getReportButtonMetricId(service.id, status),
        event: "report_button" as const,
        label: `${service.name} ${getReportStatusLabel(status)}`,
        providerId: service.providerId,
        serviceId: service.id,
        status,
      })),
    ),
    ...PROVIDERS.map((provider) => ({
      id: getProviderTabMetricId(provider.id),
      event: "provider_tab" as const,
      label: `${provider.name} tab`,
      providerId: provider.id,
    })),
    {
      id: "refresh_button",
      event: "refresh_button",
      label: "Refresh button",
    },
    {
      id: "copy_link",
      event: "copy_link",
      label: "Copy link",
    },
  ];
}

export function getClickHourBucket(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");

  return `${year}${month}${day}${hour}`;
}

export function getRecentClickHourBuckets(windowHours: number, now = new Date()) {
  return Array.from({ length: windowHours }, (_, index) => {
    const date = new Date(now.getTime() - index * HOUR_MS);
    return getClickHourBucket(date);
  });
}

export function getClickCountKey(metricId: string, bucket: string) {
  return `click:v1:${metricId}:${bucket}`;
}

function getReportButtonMetricId(serviceId: string, status: ReportStatus) {
  return `report_button:${serviceId}:${status}`;
}

function getProviderTabMetricId(providerId: ProviderId) {
  return `provider_tab:${providerId}`;
}

function getReportStatusLabel(status: ReportStatus) {
  switch (status) {
    case "slow":
      return "Slow";
    case "error":
      return "Error";
    case "down":
      return "Down";
  }
}
