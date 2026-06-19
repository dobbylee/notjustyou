"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Copy, RefreshCw } from "lucide-react";
import type { Provider, ProviderId, ReportStatus, ServiceSurface } from "@/lib/catalog";
import type { SummaryResponse } from "@/lib/aggregation";
import type { ClickEventInput } from "@/lib/clicks";
import type { OfficialServiceStatus } from "@/lib/official/types";
import type { SignalSummaryResponse } from "@/lib/signals/aggregation";
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

const GITHUB_URL = "https://github.com/dobbylee/notjustyou";

export function StatusDashboard({ providers, services }: StatusDashboardProps) {
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId>(
    providers[0]?.id ?? "anthropic",
  );
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [signalSummary, setSignalSummary] = useState<SignalSummaryResponse | null>(
    null,
  );
  const [official, setOfficial] = useState<OfficialSummaryResponse | null>(null);
  const [pending, setPending] = useState<PendingMap>({});
  const [messages, setMessages] = useState<MessageMap>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [summaryMessage, setSummaryMessage] = useState("");

  const loadSummary = useCallback(async () => {
    try {
      const [summaryResult, signalResult] = await Promise.allSettled([
        fetch("/api/summary", {
          cache: "no-store",
        }),
        fetch("/api/signals/summary", {
          cache: "no-store",
        }),
      ]);

      if (summaryResult.status === "rejected") {
        throw new Error("Failed to fetch summary");
      }

      const summaryResponse = summaryResult.value;
      if (!summaryResponse.ok) {
        throw new Error("Failed to fetch summary");
      }

      setSummary((await summaryResponse.json()) as SummaryResponse);
      if (signalResult.status === "fulfilled" && signalResult.value.ok) {
        setSignalSummary((await signalResult.value.json()) as SignalSummaryResponse);
      }
      setSummaryMessage("");
    } catch {
      setSummaryMessage("Community reports unavailable.");
    }
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

  const signalSummaryByServiceId = useMemo(() => {
    return new Map(
      signalSummary?.services.map((service) => [service.serviceId, service]) ?? [],
    );
  }, [signalSummary]);

  const selectedServices = services.filter(
    (service) => service.providerId === selectedProviderId,
  );

  function handleSelectProvider(providerId: ProviderId) {
    recordClick({
      event: "provider_tab",
      providerId,
    });
    setSelectedProviderId(providerId);
  }

  async function handleRefreshClick() {
    recordClick({
      event: "refresh_button",
    });
    await refreshSummary();
  }

  async function handleReport(serviceId: string, status: ReportStatus) {
    recordClick({
      event: "report_button",
      serviceId,
      status,
    });
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
    recordClick({
      event: "copy_link",
    });
    await navigator.clipboard.writeText(window.location.href);
    setCopyMessage("Copied");
    window.setTimeout(() => setCopyMessage(""), 1800);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-blue-600 uppercase">
            <Activity aria-hidden="true" className="h-3.5 w-3.5 animate-pulse" />
            <span>Live community signal</span>
          </div>
          <h1 className="mt-2.5 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Not Just You
          </h1>
        </div>

        <div className="flex justify-end gap-3 items-center">
          <div className="min-w-36 text-right text-xs font-semibold text-slate-400">
            <div className="flex items-center justify-end gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>Live</span>
            </div>
            <div className="mt-0.5 text-[10px] text-slate-500/70 font-medium">
              {summary ? `updated ${formatUpdatedAt(summary.updatedAt)}` : "loading"}
            </div>
          </div>
          <button
            type="button"
            aria-label="Refresh"
            onClick={() => void handleRefreshClick()}
            title="Refresh"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/60 bg-white/70 text-slate-500 shadow-xs backdrop-blur-xs transition-all duration-200 hover:border-slate-300 hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25"
          >
            <RefreshCw
              aria-hidden="true"
              className={isRefreshing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}
            />
          </button>
          <button
            type="button"
            aria-label="Copy link"
            onClick={() => void handleCopyLink()}
            title="Copy link"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/60 bg-white/70 text-slate-500 shadow-xs backdrop-blur-xs transition-all duration-200 hover:border-slate-300 hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25"
          >
            <Copy aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub repository"
            title="GitHub repository"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/60 bg-white/70 text-slate-500 shadow-xs backdrop-blur-xs transition-all duration-200 hover:border-slate-300 hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25"
          >
            <svg
              aria-hidden="true"
              className="h-[20px] w-[20px]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>
        </div>
      </header>

      <div className="min-h-6 pt-2 text-right text-xs font-semibold text-slate-400" aria-live="polite">
        {copyMessage || summaryMessage}
      </div>

      <ProviderTabs
        providers={providers}
        selectedProviderId={selectedProviderId}
        onSelect={handleSelectProvider}
      />

      <section className="grid gap-4 py-5 md:grid-cols-2">
        {selectedServices.map((service) => {
          const serviceSummary =
            summariesByServiceId.get(service.id) ?? createEmptyServiceSummary(service.id);
          const officialStatus = officialByServiceId.get(service.id);
          const installedSignals = signalSummaryByServiceId.get(service.id);

          return (
            <ServiceCard
              key={service.id}
              service={service}
              summary={serviceSummary}
              signalSummary={installedSignals}
              officialStatus={officialStatus}
              pendingStatus={pending[service.id] ?? null}
              message={messages[service.id]}
              onReport={handleReport}
            />
          );
        })}
      </section>

      <footer className="mt-auto flex justify-end border-t border-slate-200 py-6 text-xs font-semibold text-slate-400">
        <Link
          href="/privacy"
          className="underline-offset-4 hover:text-slate-950 hover:underline"
        >
          Privacy
        </Link>
      </footer>
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

function recordClick(input: ClickEventInput) {
  void fetch("/api/clicks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
    keepalive: true,
  }).catch(() => {
    // Click analytics should never block the report flow.
  });
}
