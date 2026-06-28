"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
type SignalSummaryStatus = "loading" | "available" | "unavailable";

const GITHUB_URL = "https://github.com/dobbylee/notjustyou";

export function StatusDashboard({ providers, services }: StatusDashboardProps) {
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId>(
    providers[0]?.id ?? "anthropic",
  );
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [signalSummary, setSignalSummary] = useState<SignalSummaryResponse | null>(
    null,
  );
  const [signalSummaryStatus, setSignalSummaryStatus] =
    useState<SignalSummaryStatus>("loading");
  const [official, setOfficial] = useState<OfficialSummaryResponse | null>(null);
  const [pending, setPending] = useState<PendingMap>({});
  const [messages, setMessages] = useState<MessageMap>({});
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
        setSignalSummaryStatus("available");
      } else {
        setSignalSummary(null);
        setSignalSummaryStatus("unavailable");
      }
      setSummaryMessage("");
    } catch {
      setSignalSummary(null);
      setSignalSummaryStatus("unavailable");
      setSummaryMessage("Community reports unavailable.");
    }
  }, []);

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

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="Not Just You home"
            title="Not Just You"
            className="inline-flex items-center gap-1.5 rounded-md text-slate-950 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25"
          >
            <Image
              src="/logo.png"
              alt=""
              width={48}
              height={48}
              priority
              className="h-12 w-12 rounded-sm"
            />
            <span className="leading-none text-xl font-extrabold tracking-tight">
              Not Just You
            </span>
          </Link>

          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            title="GitHub repository"
            className="text-base text-slate-500 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25"
          >
            GitHub
          </a>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <div className="min-h-6 text-right text-xs font-semibold text-slate-400" aria-live="polite">
          {summaryMessage}
        </div>

        <ProviderTabs
          providers={providers}
          selectedProviderId={selectedProviderId}
          onSelect={handleSelectProvider}
        />

        <section className="grid gap-3 py-5 md:grid-cols-2">
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
                signalSummaryStatus={signalSummaryStatus}
                officialStatus={officialStatus}
                pendingStatus={pending[service.id] ?? null}
                message={messages[service.id]}
                onReport={handleReport}
              />
            );
          })}
        </section>

        <footer className="relative mt-auto flex items-center justify-center border-t border-slate-200 py-6 text-sm font-semibold text-slate-400">
          <span>© 2026 Not Just You</span>
          <Link
            href="/privacy"
            className="absolute right-0 top-1/2 -translate-y-1/2 text-sm font-normal text-slate-500 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25"
          >
            Privacy
          </Link>
        </footer>
      </main>
    </div>
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
