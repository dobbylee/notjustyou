import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Privacy notes for Not Just You.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="text-sm font-medium text-blue-700 hover:text-blue-900"
      >
        Not Just You
      </Link>

      <article className="mt-8">
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
          <h2 className="text-base font-semibold text-slate-950">Analytics</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Vercel Web Analytics may be used to understand page views, referrers,
            and basic traffic patterns. Report behavior is measured through API
            responses and aggregate counters.
          </p>
        </section>
      </article>
    </main>
  );
}
