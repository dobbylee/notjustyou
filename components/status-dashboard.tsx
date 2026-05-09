"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Copy, RefreshCw } from "lucide-react";
import type { Provider, ProviderId, ReportStatus, ServiceSurface } from "@/lib/catalog";
import type { SummaryResponse } from "@/lib/aggregation";
import type { OfficialServiceStatus } from "@/lib/official/types";
import { getCommunityState, getTotalReports } from "@/lib/scoring";
import { ProviderTabs } from "./provider-tabs";
import { ServiceCard } from "./service-card";

interface StatusDashboardProps {
  providers: readonly Provider[];
  services: readonly ServiceSurface[];
}

interface OfficialSummaryResponse {
  updatedAt: string;
  services: OfficialServiceStatus[];
}

type PendingMap = Record<string, ReportStatus | null>;
type MessageMap = Record<string, string>;

export function StatusDashboard({ providers, services }: StatusDashboardProps) {
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId>(
    providers[0]?.id ?? "anthropic",
  );
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [official, setOfficial] = useState<OfficialSummaryResponse | null>(null);
  const [pending, setPending] = useState<PendingMap>({});
  const [messages, setMessages] = useState<MessageMap>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");

  const loadSummary = useCallback(async () => {
    const response = await fetch("/api/summary", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch summary");
    }

    setSummary((await response.json()) as SummaryResponse);
  }, []);

  const refreshSummary = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await loadSummary();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadSummary]);

  const fetchOfficial = useCallback(async () => {
    const response = await fetch("/api/official", {
      cache: "no-store",
    });

    if (response.ok) {
      setOfficial((await response.json()) as OfficialSummaryResponse);
    }
  }, []);

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => {
      void loadSummary();
      void fetchOfficial();
    }, 0);
    let intervalId: ReturnType<typeof setInterval> | null = null;

    function schedulePolling() {
      if (intervalId) {
        clearInterval(intervalId);
      }

      const intervalMs = document.hidden ? 30_000 : 5_000;
      intervalId = setInterval(() => {
        void loadSummary();
      }, intervalMs);
    }

    schedulePolling();
    document.addEventListener("visibilitychange", schedulePolling);

    return () => {
      window.clearTimeout(initialLoadId);
      if (intervalId) {
        clearInterval(intervalId);
      }
      document.removeEventListener("visibilitychange", schedulePolling);
    };
  }, [fetchOfficial, loadSummary]);

  const summariesByServiceId = useMemo(() => {
    return new Map(summary?.services.map((service) => [service.serviceId, service]));
  }, [summary]);

  const officialByServiceId = useMemo(() => {
    return new Map(
      official?.services?.map((service) => [service.serviceId, service]) ?? [],
    );
  }, [official]);

  const selectedServices = services.filter(
    (service) => service.providerId === selectedProviderId,
  );

  async function handleReport(serviceId: string, status: ReportStatus) {
    setPending((current) => ({
      ...current,
      [serviceId]: status,
    }));
    setMessages((current) => ({
      ...current,
      [serviceId]: `${getReportLabel(status)} +1 just now`,
    }));
    setSummary((current) => optimisticSummary(current, serviceId, status));

    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          serviceId,
          status,
        }),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        counted: boolean;
        reason?: string;
        cooldownSeconds?: number;
      };

      if (payload.ok && payload.counted) {
        setMessages((current) => ({
          ...current,
          [serviceId]: "Thanks - counted.",
        }));
      } else if (payload.reason === "cooldown") {
        setMessages((current) => ({
          ...current,
          [serviceId]: `Already counted. Try again in ${payload.cooldownSeconds ?? 180}s.`,
        }));
        await loadSummary();
      } else {
        setMessages((current) => ({
          ...current,
          [serviceId]: "Could not count that report.",
        }));
        await loadSummary();
      }
    } catch {
      setMessages((current) => ({
        ...current,
        [serviceId]: "Network error. Try again.",
      }));
      await loadSummary();
    } finally {
      setPending((current) => ({
        ...current,
        [serviceId]: null,
      }));
    }
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopyMessage("Copied");
    window.setTimeout(() => setCopyMessage(""), 1800);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
            <Activity aria-hidden="true" className="h-4 w-4" />
            <span>Live community signal</span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950 sm:text-4xl">
            Not Just You
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Check whether AI tools are acting up for other users, then report what
            you are seeing.
          </p>
        </div>

        <div className="flex justify-end gap-2 sm:items-center">
          <div className="min-w-36 text-right text-xs text-slate-500">
            <div>Live</div>
            <div>{summary ? `updated ${formatUpdatedAt(summary.updatedAt)}` : "loading"}</div>
          </div>
          <button
            type="button"
            onClick={() => void refreshSummary()}
            title="Refresh"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25"
          >
            <RefreshCw
              aria-hidden="true"
              className={isRefreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
            />
          </button>
          <button
            type="button"
            onClick={() => void handleCopyLink()}
            title="Copy link"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25"
          >
            <Copy aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="min-h-6 pt-2 text-right text-sm text-slate-500" aria-live="polite">
        {copyMessage}
      </div>

      <ProviderTabs
        providers={providers}
        selectedProviderId={selectedProviderId}
        onSelect={setSelectedProviderId}
      />

      <section className="grid gap-4 py-5 md:grid-cols-2">
        {selectedServices.map((service) => {
          const serviceSummary =
            summariesByServiceId.get(service.id) ?? createEmptyServiceSummary(service.id);
          const officialStatus = officialByServiceId.get(service.id);

          return (
            <ServiceCard
              key={service.id}
              service={service}
              summary={serviceSummary}
              officialStatus={officialStatus}
              pendingStatus={pending[service.id] ?? null}
              message={messages[service.id]}
              onReport={handleReport}
            />
          );
        })}
      </section>
    </main>
  );
}

function optimisticSummary(
  summary: SummaryResponse | null,
  serviceId: string,
  status: ReportStatus,
): SummaryResponse | null {
  if (!summary) return summary;

  return {
    ...summary,
    updatedAt: new Date().toISOString(),
    services: summary.services.map((service) => {
      if (service.serviceId !== serviceId) return service;

      const counts = {
        ...service.counts,
        [status]: service.counts[status] + 1,
      };

      return {
        ...service,
        counts,
        total: getTotalReports(counts),
        communityState: getCommunityState(counts),
      };
    }),
  };
}

function createEmptyServiceSummary(serviceId: string) {
  const counts = {
    slow: 0,
    error: 0,
    down: 0,
  };

  return {
    serviceId,
    counts,
    total: 0,
    communityState: getCommunityState(counts),
  };
}

function getReportLabel(status: ReportStatus) {
  switch (status) {
    case "slow":
      return "Slow";
    case "error":
      return "Error";
    case "down":
      return "Down";
  }
}

function formatUpdatedAt(isoTimestamp: string) {
  const diffSeconds = Math.max(
    0,
    Math.round((Date.now() - new Date(isoTimestamp).getTime()) / 1000),
  );

  if (diffSeconds < 2) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  return `${Math.floor(diffSeconds / 60)}m ago`;
}
