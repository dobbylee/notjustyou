"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Provider, ProviderId, ReportStatus, ServiceSurface } from "@/lib/catalog";
import type { SummaryResponse } from "@/lib/aggregation";
import type { ClickEventInput } from "@/lib/clicks";
import type {
  OfficialProviderAdvisory,
  OfficialServiceStatus,
} from "@/lib/official/types";
import type { SignalSummaryResponse } from "@/lib/signals/aggregation";
import { getCommunityState, getTotalReports } from "@/lib/scoring";
import { SiteShell } from "./site-shell";
import { ProviderTabs } from "./provider-tabs";
import { ServiceCard } from "./service-card";

interface StatusDashboardProps {
  providers: readonly Provider[];
  services: readonly ServiceSurface[];
  embedded?: boolean;
}

interface OfficialSummaryResponse {
  updatedAt: string;
  services: OfficialServiceStatus[];
  providerAdvisories: OfficialProviderAdvisory[];
}

type PendingMap = Record<string, ReportStatus | null>;
type MessageMap = Record<string, string>;
type SourceSummaryStatus = "loading" | "available" | "stale" | "unavailable";

const OFFICIAL_POLL_INTERVAL_MS = 60_000;

export function StatusDashboard({
  providers,
  services,
  embedded = false,
}: StatusDashboardProps) {
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId>(
    providers[0]?.id ?? "anthropic",
  );
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [communitySummaryStatus, setCommunitySummaryStatus] =
    useState<SourceSummaryStatus>("loading");
  const [signalSummary, setSignalSummary] = useState<SignalSummaryResponse | null>(
    null,
  );
  const [signalSummaryStatus, setSignalSummaryStatus] =
    useState<SourceSummaryStatus>("loading");
  const [official, setOfficial] = useState<OfficialSummaryResponse | null>(null);
  const [pending, setPending] = useState<PendingMap>({});
  const [messages, setMessages] = useState<MessageMap>({});
  const [summaryMessage, setSummaryMessage] = useState("");
  const communityRequestIdRef = useRef(0);
  const signalRequestIdRef = useRef(0);
  const officialRequestIdRef = useRef(0);
  const communityRequestRef = useRef<AbortController | null>(null);
  const signalRequestRef = useRef<AbortController | null>(null);
  const officialRequestRef = useRef<AbortController | null>(null);
  const communityHasValueRef = useRef(false);
  const signalHasValueRef = useRef(false);
  const pendingReportCountRef = useRef(0);
  const communityReloadNeededRef = useRef(false);

  const loadCommunitySummary = useCallback(async () => {
    if (communityRequestRef.current || pendingReportCountRef.current > 0) return;
    const controller = new AbortController();
    communityRequestRef.current = controller;
    const requestId = ++communityRequestIdRef.current;

    try {
      const response = await fetch("/api/summary", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error("Failed to fetch summary");
      }
      const nextSummary = (await response.json()) as SummaryResponse;

      if (
        requestId !== communityRequestIdRef.current ||
        pendingReportCountRef.current > 0
      ) {
        return;
      }

      setSummary(nextSummary);
      communityHasValueRef.current = true;
      setCommunitySummaryStatus("available");
      setSummaryMessage("");
    } catch {
      if (
        requestId !== communityRequestIdRef.current ||
        pendingReportCountRef.current > 0
      ) {
        return;
      }

      setCommunitySummaryStatus(
        communityHasValueRef.current ? "stale" : "unavailable",
      );
      setSummaryMessage("Community reports unavailable.");
    } finally {
      if (communityRequestRef.current === controller) {
        communityRequestRef.current = null;
      }
    }
  }, []);

  const loadSignalSummary = useCallback(async () => {
    if (signalRequestRef.current) return;
    const controller = new AbortController();
    signalRequestRef.current = controller;
    const requestId = ++signalRequestIdRef.current;

    try {
      const response = await fetch("/api/signals/summary", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error("Failed to fetch installed signals");
      }
      const nextSummary = (await response.json()) as SignalSummaryResponse;

      if (requestId !== signalRequestIdRef.current) return;

      setSignalSummary(nextSummary);
      signalHasValueRef.current = true;
      setSignalSummaryStatus("available");
    } catch {
      if (requestId !== signalRequestIdRef.current) return;

      setSignalSummaryStatus(signalHasValueRef.current ? "stale" : "unavailable");
    } finally {
      if (signalRequestRef.current === controller) {
        signalRequestRef.current = null;
      }
    }
  }, []);

  const fetchOfficial = useCallback(async () => {
    if (officialRequestRef.current) return;
    const controller = new AbortController();
    officialRequestRef.current = controller;
    const requestId = ++officialRequestIdRef.current;

    try {
      const response = await fetch("/api/official", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error("Failed to fetch official status");
      }
      const nextOfficial = (await response.json()) as OfficialSummaryResponse;

      if (requestId !== officialRequestIdRef.current) return;

      setOfficial(nextOfficial);
    } catch {
      return;
    } finally {
      if (officialRequestRef.current === controller) {
        officialRequestRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => {
      void loadCommunitySummary();
      void loadSignalSummary();
    }, 0);
    let intervalId: ReturnType<typeof setInterval> | null = null;

    function schedulePolling() {
      if (intervalId) {
        clearInterval(intervalId);
      }

      const intervalMs = document.hidden ? 30_000 : 5_000;
      intervalId = setInterval(() => {
        void loadCommunitySummary();
        void loadSignalSummary();
      }, intervalMs);
    }

    function handleVisibilityChange() {
      schedulePolling();
      if (!document.hidden) {
        void loadCommunitySummary();
        void loadSignalSummary();
      }
    }

    schedulePolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(initialLoadId);
      communityRequestIdRef.current += 1;
      signalRequestIdRef.current += 1;
      communityRequestRef.current?.abort();
      signalRequestRef.current?.abort();
      communityRequestRef.current = null;
      signalRequestRef.current = null;
      if (intervalId) {
        clearInterval(intervalId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadCommunitySummary, loadSignalSummary]);

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => {
      void fetchOfficial();
    }, 0);
    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        void fetchOfficial();
      }
    }, OFFICIAL_POLL_INTERVAL_MS);

    function refreshWhenVisible() {
      if (!document.hidden) {
        void fetchOfficial();
      }
    }

    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearTimeout(initialLoadId);
      window.clearInterval(intervalId);
      officialRequestIdRef.current += 1;
      officialRequestRef.current?.abort();
      officialRequestRef.current = null;
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [fetchOfficial]);

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
  const selectedProvider = providers.find(
    (provider) => provider.id === selectedProviderId,
  );
  const selectedProviderAdvisories =
    official?.providerAdvisories?.filter(
      (advisory) => advisory.providerId === selectedProviderId,
    ) ?? [];

  function handleSelectProvider(providerId: ProviderId) {
    recordClick({
      event: "provider_tab",
      providerId,
    });
    setSelectedProviderId(providerId);
  }

  async function handleReport(serviceId: string, status: ReportStatus) {
    communityRequestRef.current?.abort();
    communityRequestRef.current = null;
    communityRequestIdRef.current += 1;
    pendingReportCountRef.current += 1;
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
    let reportNeedsReload = false;
    let shouldReloadSummary = false;

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
        reportNeedsReload = true;
      } else {
        setMessages((current) => ({
          ...current,
          [serviceId]: "Could not count that report.",
        }));
        reportNeedsReload = true;
      }
    } catch {
      setMessages((current) => ({
        ...current,
        [serviceId]: "Network error. Try again.",
      }));
      reportNeedsReload = true;
    } finally {
      communityRequestIdRef.current += 1;
      if (reportNeedsReload) {
        communityReloadNeededRef.current = true;
        setSummary((current) =>
          updateOptimisticSummary(current, serviceId, status, -1),
        );
      }
      pendingReportCountRef.current = Math.max(
        0,
        pendingReportCountRef.current - 1,
      );
      if (
        pendingReportCountRef.current === 0 &&
        communityReloadNeededRef.current
      ) {
        communityReloadNeededRef.current = false;
        shouldReloadSummary = true;
      }
      setPending((current) => ({
        ...current,
        [serviceId]: null,
      }));
    }

    if (shouldReloadSummary) {
      await loadCommunitySummary();
    }
  }

  const content = (
    <>
      <div
        className="min-h-6 text-right text-xs font-semibold text-slate-400"
        aria-live="polite"
      >
        {summaryMessage}
      </div>

      <ProviderTabs
        providers={providers}
        selectedProviderId={selectedProviderId}
        onSelect={handleSelectProvider}
      />

      {selectedProviderAdvisories.length > 0 && (
        <section
          role="status"
          aria-label={`${selectedProvider?.name ?? selectedProviderId} official provider advisories`}
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-amber-900"
        >
          <div className="text-xs font-bold uppercase tracking-wide text-amber-700">
            Official provider advisory
          </div>
          {selectedProviderAdvisories.map((advisory) => (
            <div key={advisory.id} className="mt-1 text-sm font-semibold">
              {advisory.name}
            </div>
          ))}
        </section>
      )}

      <section className="grid gap-3 py-5 md:grid-cols-2">
        {selectedServices.map((service) => {
          const serviceSummary =
            summariesByServiceId.get(service.id) ??
            createEmptyServiceSummary(service.id);
          const officialStatus = officialByServiceId.get(service.id);
          const installedSignals = signalSummaryByServiceId.get(service.id);

          return (
            <ServiceCard
              key={service.id}
              service={service}
              summary={serviceSummary}
              communitySummaryStatus={communitySummaryStatus}
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
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <SiteShell
      active="dashboard"
      maxWidth="5xl"
      mainClassName="flex flex-col pb-8 pt-4"
    >
      {content}
    </SiteShell>
  );
}

function optimisticSummary(
  summary: SummaryResponse | null,
  serviceId: string,
  status: ReportStatus,
): SummaryResponse | null {
  return updateOptimisticSummary(summary, serviceId, status, 1);
}

function updateOptimisticSummary(
  summary: SummaryResponse | null,
  serviceId: string,
  status: ReportStatus,
  delta: 1 | -1,
): SummaryResponse | null {
  if (!summary) return summary;

  return {
    ...summary,
    updatedAt: new Date().toISOString(),
    services: summary.services.map((service) => {
      if (service.serviceId !== serviceId) return service;

      const counts = {
        ...service.counts,
        [status]: Math.max(0, service.counts[status] + delta),
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
