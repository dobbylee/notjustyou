import type {
  CommunitySummaryResponse,
  InstalledSignalSummaryResponse,
  OfficialSummaryResponse,
  StatusData,
} from "./types.js";

export async function fetchStatusData(baseUrl: string): Promise<StatusData> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const [communityResult, installedSignalsResult, officialResult] =
    await Promise.allSettled([
    fetchJson<CommunitySummaryResponse>(`${normalizedBaseUrl}/api/summary`),
    fetchJson<InstalledSignalSummaryResponse>(
      `${normalizedBaseUrl}/api/signals/summary`,
    ),
    fetchJson<OfficialSummaryResponse>(`${normalizedBaseUrl}/api/official`),
  ]);

  if (communityResult.status === "rejected") {
    throw communityResult.reason;
  }

  return {
    community: communityResult.value,
    installedSignals:
      installedSignalsResult.status === "fulfilled"
        ? installedSignalsResult.value
        : null,
    official: officialResult.status === "fulfilled" ? officialResult.value : null,
  };
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

