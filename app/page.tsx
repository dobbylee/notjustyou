"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Lock,
  Plug,
} from "lucide-react";
import { DocsContent } from "@/components/docs-content";
import { SiteShell } from "@/components/site-shell";
import { StatusDashboard } from "@/components/status-dashboard";
import { CATALOG, PROVIDERS } from "@/lib/catalog";

const SERVICES = ["Claude Code", "Codex", "Cursor", "Antigravity"] as const;

const signalSources = [
  {
    title: "Official status",
    body: "Provider feeds are shown separately from Not Just You signals.",
    icon: CheckCircle2,
    color: "text-emerald-500 border-emerald-200 bg-emerald-50/50",
  },
  {
    title: "Community reports",
    body: "Manual browser reports remain available as a fallback signal.",
    icon: Activity,
    color: "text-amber-500 border-amber-200 bg-amber-50/50",
  },
  {
    title: "Installed signals",
    body: "Opt-in clients send metadata-only failure signals from real workflows.",
    icon: Plug,
    color: "text-blue-500 border-blue-200 bg-blue-50/50",
  },
];

const metadataSignalExample = `{
  "serviceId": "anthropic-claude-api",
  "source": "api_middleware",
  "symptom": "network_error",
  "durationMs": 5500,
  "errorCode": "timeout"
}`;

export default function Home() {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % SERVICES.length);
        setFade(true);
      }, 300); // Wait for fade-out to finish before changing text
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SiteShell active="home" maxWidth="6xl" mainClassName="pb-0 pt-8">
      <section className="flex min-h-[calc(100svh-5rem)] flex-col items-center justify-center border-b border-slate-200/50 py-20 text-center lg:py-28">
        <h1 className="max-w-6xl text-5xl font-black leading-[1.12] text-slate-900 sm:text-6xl md:text-7xl lg:text-8xl">
          <span className="block sm:whitespace-nowrap">
            <span
              className={`inline-block whitespace-nowrap bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 bg-clip-text pb-2 text-transparent transition-opacity duration-300 ${
                fade ? "opacity-100" : "opacity-0"
              }`}
            >
              {SERVICES[index]}
            </span>{" "}
            is down.
          </span>
          <span className="mt-3 block">Is it just me?</span>
        </h1>

        <p className="mt-10 max-w-3xl text-pretty text-lg font-semibold leading-8 text-slate-600 md:text-xl md:leading-9">
          <span className="block">
            Check official status, community reports, and opt-in client signals
            in one place,
          </span>
          <span className="block">
            then decide whether an AI service issue is local or widespread.
          </span>
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <a
            href="#dashboard"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/65 px-6 text-sm font-bold text-slate-700 shadow-sm backdrop-blur transition-all hover:border-slate-300 hover:bg-white/85 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25"
          >
            <Activity aria-hidden="true" className="h-4 w-4 text-blue-500" />
            View live dashboard
          </a>
          <a
            href="https://github.com/dobbylee/notjustyou"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/65 px-6 text-sm font-bold text-slate-700 shadow-sm backdrop-blur transition-all hover:border-slate-300 hover:bg-white/85 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="h-4 w-4 fill-current"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.81c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            View on GitHub
          </a>
        </div>
      </section>

      <section className="border-b border-slate-200/50 py-16 md:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl font-extrabold text-slate-800 md:text-4xl">
            Source-aware AI status
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 font-medium text-balance">
            <span className="block">
              Official status, manual reports, and installed-client signals stay separated
            </span>
            <span className="block">
              so users can see whether others are experiencing the same issue before deciding what to do next.
            </span>
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {signalSources.map((source) => {
            const Icon = source.icon;
            return (
              <article
                key={source.title}
                className="flex flex-col items-center rounded-xl border border-slate-200/60 bg-white/50 p-6 text-center backdrop-blur-sm transition-all duration-300 hover:border-slate-300/80 hover:bg-white/80"
              >
                <h3 className="mb-2 flex items-center justify-center gap-2 text-xl font-bold text-slate-800">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${source.color}`}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  {source.title}
                </h3>
                <p className="text-base font-medium leading-7 text-slate-600 text-pretty">
                  {source.body}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid min-w-0 items-center gap-12 border-b border-slate-200/50 py-16 md:py-24 lg:grid-cols-2">
        <div className="min-w-0 text-center lg:text-left">
          <h2 className="text-balance text-3xl font-extrabold text-slate-800 md:text-4xl">
            Privacy boundary <span className="whitespace-nowrap">by default</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-base font-medium leading-7 text-slate-600 lg:mx-0">
            Installed clients send{" "}
            <span className="whitespace-nowrap">service-level metadata</span> only.
            Prompt text, provider bodies, headers, API keys, file paths, and
            account identifiers are outside the collection boundary.
          </p>

          <div className="mt-8 space-y-5">
            <div>
              <h4 className="flex items-center justify-center gap-2 text-base font-bold text-slate-800 lg:justify-start">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </span>
                Collected metadata
              </h4>
              <p className="mx-auto mt-2 max-w-2xl text-pretty text-base font-medium leading-7 text-slate-600 lg:mx-0">
                Service id, symptom, status code when available, duration,
                short error code, source, and observed time.
              </p>
            </div>
            <div>
              <h4 className="flex items-center justify-center gap-2 text-base font-bold text-slate-800 lg:justify-start">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-600">
                  <Lock className="h-3.5 w-3.5" />
                </span>
                Excluded payloads
              </h4>
              <p className="mx-auto mt-2 max-w-2xl text-pretty text-base font-medium leading-7 text-slate-600 lg:mx-0">
                Prompts, messages, request or response bodies, headers, API
                keys, cookies, file paths, exact IP addresses, usernames.
              </p>
            </div>
          </div>
        </div>

        <pre className="min-w-0 max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-4 text-left font-mono text-xs leading-6 text-slate-800 sm:p-6 sm:text-sm sm:leading-7">
          <code>{metadataSignalExample}</code>
        </pre>
      </section>

      <section id="dashboard" className="scroll-mt-24 border-b border-slate-200/50 py-16 md:py-24">
        <div className="mb-8 max-w-5xl">
          <h2 className="text-3xl font-extrabold text-slate-900">Dashboard</h2>
          <p className="mt-3 text-base leading-7 text-slate-600 md:whitespace-nowrap">
            Live status cards keep official status, community reports, and installed-client signals separated by source.
          </p>
        </div>
        <StatusDashboard providers={PROVIDERS} services={CATALOG} embedded />
      </section>

      <section id="docs" className="scroll-mt-24 pb-12 pt-16 md:pb-14 md:pt-24">
        <div className="mb-8 max-w-3xl">
          <h2 className="text-3xl font-extrabold text-slate-900">Docs</h2>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Install the clients, wire provider calls, and check supported
            service ids without leaving this page.
          </p>
        </div>
        <DocsContent />
      </section>
    </SiteShell>
  );
}
