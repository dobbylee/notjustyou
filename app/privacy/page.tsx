import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Privacy notes for Not Just You.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <SiteShell active="privacy" maxWidth="3xl" mainClassName="pb-10 pt-8">
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
          the client address supplied by the trusted Vercel deployment proxy.
          Self-hosted deployments without that trust boundary share a
          conservative abuse bucket instead of trusting forwarding headers. The
          hash is used for cooldown and registration abuse prevention only and
          expires after a few minutes. User agent and language are not included.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold text-slate-950">
          Installed-client signals
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          SDK and local-tool collectors are opt in. When enabled, they send
          service-level metadata such as service id, symptom category, duration,
          status code, short error code, client version, and a random local
          installation id. SDK delivery retries also include a random signal id.
          Server aggregation stores derived installation and short-lived signal
          hashes, not the raw installation or signal ids.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold text-slate-950">
          Remote status tools
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The public MCP endpoint is read-only and requires no account. To limit
          abuse, it keeps short-lived in-process request counters keyed by a hash
          of the client address supplied by the trusted Vercel deployment proxy.
          The raw address is not stored, and the counters reset after one minute.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold text-slate-950">
          Collector setup
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Collector setup stores an anonymous collector id, allowed source,
          allowed services, client name and version, registration time, and
          revocation time when applicable. Raw collector tokens are saved locally
          by setup tools and are not printed. Server-side lookup uses derived
          token data instead of storing raw tokens.
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
          transcript paths, headers, cookies, tokens, and emails are not stored,
          queued, logged, or sent to Not Just You.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Hook adapters authenticate to the localhost receiver with a separate
          random local credential kept in the private local config. That local
          credential is not sent to or stored by the Not Just You service.
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
        <h2 className="text-base font-semibold text-slate-950">Not stored</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Not Just You does not store prompt text, provider request or response
          bodies, provider request or response headers, API keys, cookies, source
          files, diffs, clipboard content, exact IP addresses, account emails,
          machine names, or local usernames.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold text-slate-950">
          Source separation
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Community reports, official provider status, and installed-client
          signals remain separate in storage and API contracts. The dashboard
          can summarize recent problems together, but it keeps source breakdown
          visible.
        </p>
      </section>
    </SiteShell>
  );
}
