import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of use for Not Just You.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <SiteShell active="terms" maxWidth="3xl" mainClassName="pb-10 pt-8">
      <h1 className="text-3xl font-semibold text-slate-950">Terms of Use</h1>
      <p className="mt-4 text-sm leading-6 text-slate-600">
        Effective August 21, 2026. By using Not Just You, you agree to these
        terms. If you do not agree, do not use the service.
      </p>

      <TermsSection title="Service purpose">
        Not Just You provides informational status summaries for AI services
        using official provider status, aggregate community reports, and
        aggregate opt-in installed-client signals. These sources have different
        trust levels and remain separately identified.
      </TermsSection>

      <TermsSection title="No availability guarantee">
        Status information can be delayed, incomplete, unavailable, or
        incorrect. Not Just You does not guarantee that a service is operational
        or unavailable, identify a root cause, or predict a recovery time. You
        remain responsible for decisions made using the information.
      </TermsSection>

      <TermsSection title="Acceptable use">
        Do not abuse reporting or status interfaces, attempt to overwhelm or
        disrupt the service, bypass safeguards, submit unlawful material, or use
        Not Just You to interfere with another service or user.
      </TermsSection>

      <TermsSection title="Privacy">
        Use of the service is also governed by the Not Just You privacy notice.
        Status tools are read-only and do not require an account. Optional local
        reporting remains a separate, explicit opt-in flow. Read the{" "}
        <a
          href="/privacy"
          className="font-semibold text-slate-700 underline underline-offset-4 hover:text-slate-950"
        >
          privacy notice
        </a>
        .
      </TermsSection>

      <TermsSection title="Open source and third parties">
        Not Just You is open source under the repository license. Third-party AI
        services, status pages, package registries, and client platforms have
        their own terms and policies. Not Just You does not control those
        services.
      </TermsSection>

      <TermsSection title="Changes and availability">
        The service and these terms may change over time. Features may be
        modified, suspended, or discontinued. Material changes will be reflected
        by updating this page and its effective date.
      </TermsSection>

      <TermsSection title="Support">
        Report service or policy questions through the public{" "}
        <a
          href="https://github.com/dobbylee/notjustyou/issues"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-slate-700 underline underline-offset-4 hover:text-slate-950"
        >
          GitHub issue tracker
        </a>
        . Do not include secrets, credentials, private prompts, or personal data
        in an issue.
      </TermsSection>
    </SiteShell>
  );
}

function TermsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{children}</p>
    </section>
  );
}
