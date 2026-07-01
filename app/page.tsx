"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Lock,
  Plug,
  Star,
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
  "event": "provider_call_failed",
  "serviceId": "anthropic-claude-api",
  "symptom": "timeout",
  "durationMs": 5500,
  "kept": ["serviceId", "symptom", "durationMs", "statusCode"],
  "dropped": ["prompt", "body", "headers", "token", "filePath"]
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
            <Star aria-hidden="true" className="h-4 w-4 text-amber-500" />
            Star on GitHub
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

      <section className="grid items-center gap-12 border-b border-slate-200/50 py-16 md:py-24 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 md:text-4xl">
            Privacy boundary by default
          </h2>
          <p className="mt-4 text-base font-medium leading-7 text-slate-600 text-balance">
            <span className="block">
              Installed clients send service-level metadata only.
            </span>
            <span className="block">
              Prompt text, provider bodies, headers, API keys, file paths,
            </span>
            <span className="block">
              and account identifiers are outside the collection boundary.
            </span>
          </p>

          <div className="mt-8 space-y-4">
            <div className="flex gap-3">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mt-0.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-800">Collected metadata</h4>
                <p className="mt-1 text-base font-medium leading-7 text-slate-600 text-pretty">
                  <span className="block">
                    Service id, symptom, status code when available,
                  </span>
                  <span className="block">
                    duration, short error code, source, and observed time.
                  </span>
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 mt-0.5">
                <Lock className="h-3.5 w-3.5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-800">Excluded payloads</h4>
                <p className="mt-1 text-base font-medium leading-7 text-slate-600 text-pretty">
                  <span className="block">
                    Prompts, messages, request or response bodies, headers,
                  </span>
                  <span className="block">
                    API keys, cookies, file paths, exact IP addresses, usernames.
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-6 text-left font-mono text-sm leading-7 text-slate-800">
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
