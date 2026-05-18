import type { ReportStatus } from "../catalog";
import type { SummaryResponse } from "../aggregation";
import type { ClickSummaryResponse } from "../clicks";

export interface AddReportInput {
  serviceId: string;
  status: ReportStatus;
  now?: Date;
}

export interface AddClickInput {
  metricId: string;
  now?: Date;
}

export interface DedupeInput {
  fingerprint: string;
  serviceId: string;
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
  addReport(input: AddReportInput): Promise<void>;
  addClick(input: AddClickInput): Promise<void>;
  claimDedupe(input: DedupeInput): Promise<DedupeResult>;
  getClickSummary(input: ClickSummaryQuery): Promise<ClickSummaryResponse>;
  getSummary(input: SummaryQuery): Promise<SummaryResponse>;
}
