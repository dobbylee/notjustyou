"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
} from "lucide-react";
import {
  DocsSectionNav,
  type DocsSectionNavItem,
} from "@/components/docs-section-nav";
import { CATALOG, PROVIDERS } from "@/lib/catalog";

const GITHUB_URL = "https://github.com/dobbylee/notjustyou";

const docsSections = [
  {
    id: "docs-cli",
    label: "CLI",
  },
  {
    id: "docs-mcp",
    label: "MCP",
  },
  {
    id: "docs-plugins",
    label: "Plugins",
  },
  {
    id: "docs-sdk",
    label: "SDK",
  },
  {
    id: "docs-surfaces",
    label: "Supported surfaces",
  },
  {
    id: "docs-privacy",
    label: "Privacy boundary",
  },
  {
    id: "docs-packages",
    label: "Package docs",
  },
] as const satisfies readonly DocsSectionNavItem[];

const packageLinks = [
  {
    label: "CLI",
    href: `${GITHUB_URL}/tree/main/packages/notjustyou-cli`,
  },
  {
    label: "MCP server",
    href: `${GITHUB_URL}/tree/main/packages/notjustyou-mcp`,
  },
  {
    label: "SDK",
    href: `${GITHUB_URL}/tree/main/packages/notjustyou-sdk-js`,
  },
  {
    label: "Claude Code plugin",
    href: `${GITHUB_URL}/tree/main/packages/notjustyou-claude-code-plugin`,
  },
  {
    label: "Cursor plugin",
    href: `${GITHUB_URL}/tree/main/packages/notjustyou-cursor-plugin`,
  },
  {
    label: "Antigravity plugin",
    href: `${GITHUB_URL}/tree/main/packages/notjustyou-antigravity-plugin`,
  },
  {
    label: "Codex plugin",
    href: `${GITHUB_URL}/tree/main/packages/notjustyou-codex-plugin`,
  },
];

const servicesByProvider = PROVIDERS.map((provider) => ({
  provider,
  services: CATALOG.filter((service) => service.providerId === provider.id),
}));

export function DocsContent() {
  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="min-w-0">
        <DocsSectionNav items={docsSections} />
        <nav
          aria-label="Docs sections"
          className="flex min-w-0 gap-2 overflow-x-auto pb-3 lg:hidden"
        >
          {docsSections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="shrink-0 rounded-md border border-slate-200 bg-white/65 px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur transition-colors hover:bg-white/85 hover:text-slate-950"
            >
              {section.label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <section id="docs-cli" className="scroll-mt-24">
          <SectionTitle
            title="CLI"
            body="Use the CLI for quick status checks and explicit local reporting setup."
          />
          <article className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
            <CodeBlock
              code={`npm install -g @notjustyou/cli
njy status
njy status anthropic-claude-code
njy status openai-api --watch`}
            />
          </article>
        </section>

        <section id="docs-mcp" className="mt-12 scroll-mt-24">
          <SectionTitle
            title="MCP"
            body="Register the stdio MCP server in clients that support MCP tools."
          />
          <article className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
            <CodeBlock code="npm install -g @notjustyou/mcp" />
          </article>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Configure `notjustyou-mcp` as a stdio server in your client. The MCP
            tools read public status summaries and can guide explicit local
            reporting setup where supported.
          </p>
        </section>

        <section id="docs-plugins" className="mt-12 scroll-mt-24">
          <SectionTitle
            title="Plugins"
            body="Plugins keep status lookup close to the AI client you are already using."
          />
          <div className="mt-4 grid gap-4">
            <article className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="font-bold text-slate-950">Claude Code</h3>
              <CodeBlock
                compact
                code={`/plugin marketplace add dobbylee/notjustyou
/plugin install notjustyou@notjustyou`}
              />
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="font-bold text-slate-950">Codex</h3>
              <CodeBlock
                compact
                code={`codex plugin marketplace add dobbylee/notjustyou
codex plugin add notjustyou@notjustyou`}
              />
            </article>
          </div>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Cursor and Antigravity plugins are published as packages and currently
            use manual local plugin installation. Package READMEs remain the source
            of truth for client-specific setup.
          </p>
        </section>

        <section id="docs-sdk" className="mt-12 scroll-mt-24">
          <SectionTitle
            title="SDK"
            body="Wrap AI provider calls to contribute opt-in metadata-only failure signals."
          />
          <article className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
            <CodeBlock
              code={`njy setup --service openai-api
npm install @notjustyou/sdk-js`}
            />
          </article>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Supported SDK service ids are `openai-api`, `anthropic-claude-api`,
            and `google-gemini-api`.
          </p>
        </section>

        <section id="docs-surfaces" className="mt-12 scroll-mt-24">
          <SectionTitle
            title="Supported surfaces"
            body="Surface ids are stable identifiers for dashboard lookup, CLI commands, MCP tools, and SDK setup."
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {servicesByProvider.map(({ provider, services }) => (
              <article
                key={provider.id}
                className="rounded-lg border border-slate-200 bg-white p-5"
              >
                <h3 className="text-lg font-bold text-slate-950">
                  {provider.name}
                </h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {services.map((service) => (
                    <li key={service.id} className="flex flex-col gap-0.5">
                      <span className="font-semibold text-slate-800">
                        {service.name}
                      </span>
                      <code className="text-xs text-slate-500">{service.id}</code>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section id="docs-privacy" className="mt-12 scroll-mt-24">
          <SectionTitle
            title="Privacy boundary"
            body="Not Just You collects service-level status metadata, not user content."
          />
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-base leading-7 text-emerald-950">
            It does not store prompt text, request or response bodies, headers,
            API keys, cookies, source files, diffs, file paths, clipboard
            content, exact IP addresses, account emails, machine names, local
            usernames, or workspace identifiers.
          </div>
        </section>

        <section id="docs-packages" className="mt-12 scroll-mt-24">
          <SectionTitle
            title="Package docs"
            body="Detailed package setup remains in the package README files."
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {packageLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white/65 p-4 text-sm font-bold text-slate-800 shadow-sm backdrop-blur transition-colors hover:border-slate-300 hover:bg-white/85 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25"
              >
                {item.label}
                <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" />
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-950">{title}</h2>
      <p className="mt-1 text-base leading-7 text-slate-600">{body}</p>
    </div>
  );
}

function CodeBlock({ code, compact = false }: { code: string; compact?: boolean }) {
  const [copiedLine, setCopiedLine] = useState<number | null>(null);
  const lines = code.split("\n");

  async function copyLine(line: string, lineIndex: number) {
    if (!navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(line);
    } catch {
      return;
    }

    setCopiedLine(lineIndex);
    window.setTimeout(() => {
      setCopiedLine((current) => (current === lineIndex ? null : current));
    }, 1200);
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-left font-mono leading-6 text-slate-800 ${
        compact ? "text-xs" : "text-sm"
      }`}
    >
      {lines.map((line, lineIndex) => {
        const canCopy = line.trim().length > 0;
        const isCopied = copiedLine === lineIndex;

        return (
          <div
            key={`${line}-${lineIndex}`}
            className="flex min-h-9 items-center border-b border-slate-200/70 last:border-b-0"
          >
            <code
              className={`min-w-0 flex-1 overflow-x-auto px-4 py-2 ${
                compact
                  ? "whitespace-pre-wrap break-all sm:whitespace-pre sm:break-normal"
                  : "whitespace-pre"
              }`}
            >
              {line || " "}
            </code>
            {canCopy && (
              <button
                type="button"
                aria-label={`Copy line: ${line}`}
                onClick={() => void copyLine(line, lineIndex)}
                className="mr-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white/65 text-slate-500 shadow-sm backdrop-blur transition-colors hover:bg-white/90 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25"
              >
                {isCopied ? (
                  <Check aria-hidden="true" className="h-3.5 w-3.5" />
                ) : (
                  <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
