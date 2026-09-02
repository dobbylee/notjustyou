import type { ReactNode } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { HomeLogoLink } from "@/components/home-logo-link";

type ActiveSection = "home" | "dashboard" | "docs" | "privacy" | "terms";
type MaxWidth = "3xl" | "5xl" | "6xl";

interface SiteShellProps {
  active: ActiveSection;
  children: ReactNode;
  maxWidth?: MaxWidth;
  mainClassName?: string;
}

const GITHUB_URL = "https://github.com/dobbylee/notjustyou";

const maxWidthClassNames: Record<MaxWidth, string> = {
  "3xl": "max-w-3xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
};

const navItems = [
  {
    key: "dashboard",
    href: "/#dashboard",
    label: "Dashboard",
  },
  {
    key: "docs",
    href: "/#docs",
    label: "Docs",
  },
] as const;

export function SiteShell({
  active,
  children,
  maxWidth = "5xl",
  mainClassName,
}: SiteShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-transparent text-slate-900 font-sans">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/70 backdrop-blur-md">
        <div
          className={clsx(
            "mx-auto grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1.1fr)] items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6 lg:px-8",
            maxWidthClassNames[maxWidth],
          )}
        >
          <HomeLogoLink />

          <nav
            aria-label="Primary navigation"
            className="flex items-center justify-center gap-1 p-1"
          >
            {navItems.map((item) => {
              const isActive = item.key === active;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={clsx(
                    "inline-flex h-9 items-center rounded-md px-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25",
                    isActive
                      ? "text-slate-950"
                      : "text-slate-600 hover:text-slate-950",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="inline-flex h-9 items-center justify-center gap-2 justify-self-end whitespace-nowrap rounded-md border border-slate-200 bg-white/60 px-2 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur transition-colors hover:bg-white/85 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 sm:px-3"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="h-4 w-4 fill-current"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.81c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            <span className="sr-only sm:not-sr-only">GitHub</span>
          </a>
        </div>
      </header>

      <main
        className={clsx(
          "mx-auto w-full flex-1 px-4 sm:px-6 lg:px-8",
          maxWidthClassNames[maxWidth],
          mainClassName,
        )}
      >
        {children}
      </main>

      <footer
        className={clsx(
          "mx-auto grid w-full items-center border-t border-slate-200/60 px-4 py-6 text-sm text-slate-500 sm:px-6 lg:px-8 bg-white/10 backdrop-blur-sm",
          maxWidthClassNames[maxWidth],
        )}
        style={{
          gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
        }}
      >
        <span className="col-start-2 font-semibold text-slate-400">
          © 2026 Not Just You
        </span>
        <div className="col-start-3 flex items-center gap-3 justify-self-end">
          <Link
            href="/privacy"
            className="text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25"
          >
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}
