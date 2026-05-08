import type { ReportStatus } from "../catalog";
import type { SummaryResponse } from "../aggregation";

export interface AddReportInput {
  serviceId: string;
  status: ReportStatus;
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

export interface ReportStorage {
  addReport(input: AddReportInput): Promise<void>;
  claimDedupe(input: DedupeInput): Promise<DedupeResult>;
  getSummary(input: SummaryQuery): Promise<SummaryResponse>;
}
