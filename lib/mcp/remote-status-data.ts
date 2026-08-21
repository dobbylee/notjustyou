interface CommunityServiceSummary {
  serviceId: string;
  total: number;
  counts: Record<string, number>;
  communityState: string;
}

interface CommunitySummaryResponse {
  services: CommunityServiceSummary[];
}

interface InstalledSignalServiceSummary {
  serviceId: string;
  total: number;
  uniqueInstallationsApprox: number;
  countsBySource: Record<string, number>;
  countsBySymptom: Record<string, number>;
  lastSignal: {
    symptom: string;
    source: string;
    observedAt: string;
  } | null;
}

interface InstalledSignalSummaryResponse {
  windowMinutes: number;
  services: InstalledSignalServiceSummary[];
}

interface OfficialServiceStatus {
  serviceId: string;
  overall: string;
  source: string;
  updatedAt: string;
}

interface OfficialProviderAdvisory {
  providerId: string;
  id: string;
  name: string;
  status: string;
  impact: string;
  updatedAt: string;
}

interface OfficialSummaryResponse {
  services: OfficialServiceStatus[];
  providerAdvisories?: OfficialProviderAdvisory[];
}

interface RemoteStatusData {
  community: CommunitySummaryResponse | null;
  installedSignals: InstalledSignalSummaryResponse | null;
  official: OfficialSummaryResponse | null;
}

export function getRemoteStatusBaseUrl() {
  return process.env.NOTJUSTYOU_BASE_URL ?? "https://notjustyou.dev";
}

export async function listRemoteSurfaces(baseUrl: string, provider?: string) {
  const data = await fetchRemoteStatusData(baseUrl);

  return {
    surfaces: getServiceIds(data)
      .filter((serviceId) => !provider || getProviderId(serviceId) === provider)
      .map((serviceId) => ({
        serviceId,
        providerId: getProviderId(serviceId),
        ...getSurfaceSummary(data, serviceId),
      })),
    providerAdvisories: getProviderAdvisories(data, provider),
    sources: sourceAvailability(data),
  };
}

export async function getRemoteSurfaceStatus(baseUrl: string, serviceId: string) {
  const data = await fetchRemoteStatusData(baseUrl);
  const status = getSurfaceSummary(data, serviceId);

  return {
    serviceId,
    found: Boolean(status.community || status.installedSignals || status.official),
    ...status,
    providerAdvisories: getProviderAdvisories(data, getProviderId(serviceId)),
    sources: sourceAvailability(data),
  };
}

export async function getRemoteRecentSignals(
  baseUrl: string,
  serviceId: string,
  windowMinutes?: number,
) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const signalsUrl = new URL(`${normalizedBaseUrl}/api/signals/summary`);
  signalsUrl.searchParams.set("serviceId", serviceId);
  if (windowMinutes) {
    signalsUrl.searchParams.set("windowMinutes", String(windowMinutes));
  }

  const summary = await fetchJson<InstalledSignalSummaryResponse>(
    signalsUrl.toString(),
  );
  const installedSignals = summary.services.find(
    (service) => service.serviceId === serviceId,
  );

  return {
    serviceId,
    windowMinutes: summary.windowMinutes,
    installedSignalsAvailable: true,
    installedSignals: installedSignals ? formatInstalled(installedSignals) : null,
  };
}

async function fetchRemoteStatusData(baseUrl: string): Promise<RemoteStatusData> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const [communityResult, installedSignalsResult, officialResult] =
    await Promise.allSettled([
      fetchJson<CommunitySummaryResponse>(`${normalizedBaseUrl}/api/summary`),
      fetchJson<InstalledSignalSummaryResponse>(
        `${normalizedBaseUrl}/api/signals/summary`,
      ),
      fetchJson<OfficialSummaryResponse>(`${normalizedBaseUrl}/api/official`),
    ]);

  if (
    communityResult.status === "rejected" &&
    installedSignalsResult.status === "rejected" &&
    officialResult.status === "rejected"
  ) {
    throw communityResult.reason;
  }

  return {
    community:
      communityResult.status === "fulfilled" ? communityResult.value : null,
    installedSignals:
      installedSignalsResult.status === "fulfilled"
        ? installedSignalsResult.value
        : null,
    official: officialResult.status === "fulfilled" ? officialResult.value : null,
  };
}

function getSurfaceSummary(data: RemoteStatusData, serviceId: string) {
  const community = data.community?.services.find(
    (service) => service.serviceId === serviceId,
  );
  const installedSignals = data.installedSignals?.services.find(
    (service) => service.serviceId === serviceId,
  );
  const official = data.official?.services.find(
    (service) => service.serviceId === serviceId,
  );

  return {
    community: community
      ? {
          total: community.total,
          counts: numericRecord(community.counts),
          state: community.communityState,
        }
      : null,
    installedSignals: installedSignals ? formatInstalled(installedSignals) : null,
    official: official
      ? {
          overall: official.overall,
          source: official.source,
          updatedAt: official.updatedAt,
        }
      : null,
  };
}

function getServiceIds(data: RemoteStatusData) {
  return [
    ...new Set([
      ...(data.community?.services.map((service) => service.serviceId) ?? []),
      ...(data.installedSignals?.services.map((service) => service.serviceId) ?? []),
      ...(data.official?.services.map((service) => service.serviceId) ?? []),
    ]),
  ];
}

function getProviderAdvisories(data: RemoteStatusData, providerId?: string) {
  return (data.official?.providerAdvisories ?? [])
    .filter((advisory) => !providerId || advisory.providerId === providerId)
    .map((advisory) => ({
      providerId: advisory.providerId,
      id: advisory.id,
      name: advisory.name,
      status: advisory.status,
      impact: advisory.impact,
      updatedAt: advisory.updatedAt,
    }));
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

function sourceAvailability(data: RemoteStatusData) {
  return {
    community: Boolean(data.community),
    installedSignals: Boolean(data.installedSignals),
    official: Boolean(data.official),
  };
}

function getProviderId(serviceId: string) {
  return serviceId.split("-")[0] ?? "unknown";
}

function numericRecord(value: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => {
      const [, count] = entry;
      return typeof count === "number";
    }),
  );
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Status source returned ${response.status}.`);
  }

  return (await response.json()) as T;
}
