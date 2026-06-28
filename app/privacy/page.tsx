import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Privacy notes for Not Just You.",
  alternates: {
    canonical: "/privacy",
  },
};

const GITHUB_URL = "https://github.com/dobbylee/notjustyou";

export default function PrivacyPage() {
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

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-10 pt-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold text-slate-950">Privacy</h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Not Just You is a small public status board. It does not require an
          account, login, email address, or profile.
        </p>

        <section className="mt-8">
          <h2 className="text-base font-semibold text-slate-950">
            Community reports
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            When you submit a report, the app stores aggregated counters for the
            selected service and status. Reports are kept in short-lived Redis
            buckets for the recent status window.
          </p>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-semibold text-slate-950">
            Duplicate prevention
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            To reduce duplicate reports, the app creates a short-lived hash from
            request metadata such as IP address, user agent, and language. The
            hash is used for cooldown only and expires after a few minutes.
          </p>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-semibold text-slate-950">
            Installed-client signals
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            SDK and local-tool collectors are opt in. When enabled, they send
            service-level metadata such as service id, symptom category,
            duration, status code, short error code, client version, and a
            random local installation id. Server aggregation stores derived
            installation hashes, not the raw installation id.
          </p>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-semibold text-slate-950">
            Collector setup
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Collector setup stores an anonymous collector id, allowed source,
            allowed services, client name and version, registration time, and
            revocation time when applicable. Raw collector tokens are saved
            locally by setup tools and are not printed. Server-side lookup uses
            derived token data instead of storing raw tokens.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Collector heartbeat checks can update last-seen metadata using the
            collector id, derived installation hash, and client version.
          </p>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-semibold text-slate-950">
            Local hook reporting
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            If you opt in to local hook reporting, a local adapter may receive a
            vendor hook payload in memory to derive a metadata-only signal. Raw
            hook payload fields such as prompts, commands, outputs, file paths,
            transcript paths, headers, cookies, tokens, and emails are not
            stored, queued, logged, or sent to Not Just You.
          </p>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-semibold text-slate-950">Analytics</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Vercel Web Analytics may be used to understand page views, referrers,
            and basic traffic patterns. Fallback report control clicks and
            provider tabs are stored as aggregate Redis counters.
          </p>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-semibold text-slate-950">
            Not stored
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Not Just You does not store prompt text, provider request or
            response bodies, provider request or response headers, API keys,
            cookies, source files, diffs, clipboard content, exact IP addresses,
            account emails, machine names, or local usernames.
          </p>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-semibold text-slate-950">
            Source separation
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Community reports, official provider status, and installed-client
            signals remain separate in storage and API contracts. The dashboard
            can summarize recent problems together, but it keeps source
            breakdown visible.
          </p>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-3xl items-center justify-center border-t border-slate-200 px-4 py-6 text-sm font-semibold text-slate-400 sm:px-6 lg:px-8">
        <span>© 2026 Not Just You</span>
      </footer>
    </div>
  );
}
