import type {
  CommunitySummaryResponse,
  CollectorRegistrationResponse,
  InstalledSignalSummaryResponse,
  OfficialSummaryResponse,
  SignalSource,
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

export async function registerCollector(input: {
  baseUrl: string;
  source: SignalSource;
  serviceIds: string[];
  clientName: string;
  clientVersion: string;
}) {
  return fetchJson<CollectorRegistrationResponse>(
    `${normalizeBaseUrl(input.baseUrl)}/api/collectors/register`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        source: input.source,
        serviceIds: input.serviceIds,
        clientName: input.clientName,
        clientVersion: input.clientVersion,
      }),
    },
  );
}

export async function checkCollectorToken(input: {
  baseUrl: string;
  collectorToken: string;
  clientVersion: string;
}) {
  await fetchJson(`${normalizeBaseUrl(input.baseUrl)}/api/collectors/heartbeat`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.collectorToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      installationId: "doctor-readiness-check",
      clientVersion: input.clientVersion,
    }),
  });
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${url} (${response.status})`);
  }

  return (await response.json()) as T;
}
