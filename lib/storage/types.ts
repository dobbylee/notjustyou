import type { ReportStatus } from "../catalog";
import type { SummaryResponse } from "../aggregation";
import type { ClickSummaryResponse } from "../clicks";

export interface AddReportInput {
  fingerprint: string;
  serviceId: string;
  status: ReportStatus;
  now?: Date;
}

export interface AddClickInput {
  metricId: string;
  now?: Date;
}

export type DedupeResult =
  | {
      allowed: true;
      cooldownSeconds: number;
    }
  | {
      allowed: false;
      cooldownSeconds: number;
    };

export interface SummaryQuery {
  windowMinutes: number;
  now?: Date;
}

export interface ClickSummaryQuery {
  windowHours: number;
  now?: Date;
}

export interface ReportStorage {
  addReport(input: AddReportInput): Promise<DedupeResult>;
  addClick(input: AddClickInput): Promise<void>;
  getClickSummary(input: ClickSummaryQuery): Promise<ClickSummaryResponse>;
  getSummary(input: SummaryQuery): Promise<SummaryResponse>;
}
