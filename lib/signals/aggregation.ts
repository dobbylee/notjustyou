import { CATALOG } from "../catalog";
import { getMinuteBucket, getRecentMinuteBuckets } from "../aggregation";
import {
  SIGNAL_SOURCES,
  SIGNAL_SYMPTOMS,
  type SignalSource,
  type SignalSymptom,
} from "./schema";

export const SIGNAL_WINDOW_MINUTES = 10;
export const SIGNAL_COUNTER_TTL_SECONDS = 2 * 60 * 60;
export const SIGNAL_LAST_TTL_SECONDS = 30 * 60;
export const HEARTBEAT_TTL_SECONDS = 5 * 60;
export const RATE_LIMIT_TTL_SECONDS = 5 * 60;

export interface LastSignalSummary {
  symptom: SignalSymptom;
  source: SignalSource;
  observedAt: string;
}

export interface SignalServiceSummary {
  serviceId: string;
  countsBySource: Record<SignalSource, number>;
  countsBySymptom: Record<SignalSymptom, number>;
  total: number;
  uniqueInstallationsApprox: number;
  lastSignal: LastSignalSummary | null;
}

export interface SignalSummaryResponse {
  windowMinutes: number;
  updatedAt: string;
  services: SignalServiceSummary[];
}

export function getSignalCountKey(
  serviceId: string,
  source: SignalSource,
  symptom: SignalSymptom,
  bucket: string,
) {
  return `signal:v1:count:${serviceId}:${source}:${symptom}:${bucket}`;
}

export function getSignalInstallationsKey(serviceId: string, bucket: string) {
  return `signal:v1:installations:${serviceId}:${bucket}`;
}

export function getSignalLastKey(serviceId: string) {
  return `signal:v1:last:${serviceId}`;
}

export function getRecentSignalMinuteBuckets(
  windowMinutes: number,
  now = new Date(),
) {
  return getRecentMinuteBuckets(windowMinutes, now);
}

export function getSignalMinuteBucket(now = new Date()) {
  return getMinuteBucket(now);
}

export function emptyCountsBySource() {
  return SIGNAL_SOURCES.reduce(
    (counts, source) => {
      counts[source] = 0;
      return counts;
    },
    {} as Record<SignalSource, number>,
  );
}

export function emptyCountsBySymptom() {
  return SIGNAL_SYMPTOMS.reduce(
    (counts, symptom) => {
      counts[symptom] = 0;
      return counts;
    },
    {} as Record<SignalSymptom, number>,
  );
}

export function emptySignalSummaries() {
  return CATALOG.map((service) => ({
    serviceId: service.id,
    countsBySource: emptyCountsBySource(),
    countsBySymptom: emptyCountsBySymptom(),
    total: 0,
    uniqueInstallationsApprox: 0,
    lastSignal: null,
  }));
}

