import type {
  CommunitySummaryResponse,
  InstalledSignalSummaryResponse,
  OfficialSummaryResponse,
  StatusData,
} from "./types.js";

export async function fetchStatusData(
  baseUrl: string,
  options: {
    serviceId?: string;
    signalWindowMinutes?: number;
  } = {},
): Promise<StatusData> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const signalsUrl = new URL(`${normalizedBaseUrl}/api/signals/summary`);

  if (options.serviceId) {
    signalsUrl.searchParams.set("serviceId", options.serviceId);
  }

  if (options.signalWindowMinutes) {
    signalsUrl.searchParams.set(
      "windowMinutes",
      String(options.signalWindowMinutes),
    );
  }

  const [communityResult, installedSignalsResult, officialResult] =
    await Promise.allSettled([
      fetchJson<CommunitySummaryResponse>(`${normalizedBaseUrl}/api/summary`),
      fetchJson<InstalledSignalSummaryResponse>(signalsUrl.toString()),
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

export async function fetchInstalledSignalSummary(
  baseUrl: string,
  options: {
    serviceId: string;
    windowMinutes?: number;
  },
): Promise<InstalledSignalSummaryResponse> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const signalsUrl = new URL(`${normalizedBaseUrl}/api/signals/summary`);

  signalsUrl.searchParams.set("serviceId", options.serviceId);

  if (options.windowMinutes) {
    signalsUrl.searchParams.set("windowMinutes", String(options.windowMinutes));
  }

  return fetchJson<InstalledSignalSummaryResponse>(signalsUrl.toString());
}

export function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${url} (${response.status})`);
  }

  return (await response.json()) as T;
}
