import type { ReactNode } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { Star } from "lucide-react";
import { HomeLogoLink } from "@/components/home-logo-link";

type ActiveSection = "home" | "dashboard" | "docs" | "privacy";
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
            "mx-auto grid w-full items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6 lg:px-8",
            maxWidthClassNames[maxWidth],
          )}
          style={{
            gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
          }}
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
            className="inline-flex items-center gap-2 justify-self-end whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 border border-slate-200 bg-white/60 hover:bg-white/85 shadow-sm backdrop-blur"
          >
            <Star aria-hidden="true" className="h-4 w-4 text-amber-500" />
            GitHub
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
        <Link
          href="/privacy"
          className="col-start-3 justify-self-end text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25"
        >
          Privacy
        </Link>
      </footer>
    </div>
  );
}
