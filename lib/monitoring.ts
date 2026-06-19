import type { SummaryResponse } from "./aggregation";
import type { ClickSummaryResponse } from "./clicks";
import type {
  SignalServiceSummary,
  SignalSummaryResponse,
} from "./signals/aggregation";
import { emptyCountsBySource, emptyCountsBySymptom } from "./signals/aggregation";
import type { SignalSource, SignalSymptom } from "./signals/schema";

export interface MonitoringResponse {
  updatedAt: string;
  windows: {
    communityMinutes: number;
    installedSignalMinutes: number;
    clickHours: number;
  };
  community: {
    totalReports: number;
    activeServices: number;
  };
  installedSignals: {
    totalSignals: number;
    activeServices: number;
    installationServiceObservations: number;
    countsBySource: Record<SignalSource, number>;
    countsBySymptom: Record<SignalSymptom, number>;
  };
  clicks: {
    totalClicks: number;
    activeMetrics: number;
  };
}

export function summarizeMonitoring(input: {
  now?: Date;
  community: SummaryResponse;
  installedSignals: SignalSummaryResponse;
  clicks: ClickSummaryResponse;
}): MonitoringResponse {
  const communityTotal = input.community.services.reduce(
    (total, service) => total + service.total,
    0,
  );
  const clickTotal = input.clicks.metrics.reduce(
    (total, metric) => total + metric.total,
    0,
  );
  const signalCounts = summarizeSignalServices(input.installedSignals.services);

  return {
    updatedAt: (input.now ?? new Date()).toISOString(),
    windows: {
      communityMinutes: input.community.windowMinutes,
      installedSignalMinutes: input.installedSignals.windowMinutes,
      clickHours: input.clicks.windowHours,
    },
    community: {
      totalReports: communityTotal,
      activeServices: input.community.services.filter((service) => service.total > 0)
        .length,
    },
    installedSignals: signalCounts,
    clicks: {
      totalClicks: clickTotal,
      activeMetrics: input.clicks.metrics.filter((metric) => metric.total > 0).length,
    },
  };
}

function summarizeSignalServices(services: SignalServiceSummary[]) {
  const countsBySource = emptyCountsBySource();
  const countsBySymptom = emptyCountsBySymptom();

  let totalSignals = 0;
  let installationServiceObservations = 0;

  for (const service of services) {
    totalSignals += service.total;
    installationServiceObservations += service.uniqueInstallationsApprox;

    for (const [source, count] of Object.entries(service.countsBySource)) {
      countsBySource[source as SignalSource] += count;
    }

    for (const [symptom, count] of Object.entries(service.countsBySymptom)) {
      countsBySymptom[symptom as SignalSymptom] += count;
    }
  }

  return {
    totalSignals,
    activeServices: services.filter((service) => service.total > 0).length,
    installationServiceObservations,
    countsBySource,
    countsBySymptom,
  };
}
