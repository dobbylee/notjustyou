"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";

export interface DocsSectionNavItem {
  id: string;
  label: string;
}

interface DocsSectionNavProps {
  items: readonly DocsSectionNavItem[];
}

export function DocsSectionNav({ items }: DocsSectionNavProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  useEffect(() => {
    if (!items.length) {
      return;
    }

    function syncActiveSection() {
      const scrollPosition = window.scrollY + window.innerHeight;
      const pageBottom = document.documentElement.scrollHeight - 24;

      if (scrollPosition >= pageBottom) {
        setActiveId(items[items.length - 1]?.id ?? "");
        return;
      }

      const markerPosition = window.scrollY + Math.min(window.innerHeight * 0.35, 240);
      const nextActiveId = items.reduce((currentId, item) => {
        const section = document.getElementById(item.id);

        if (!section) {
          return currentId;
        }

        return section.offsetTop <= markerPosition ? item.id : currentId;
      }, items[0]?.id ?? "");

      if (nextActiveId) {
        setActiveId(nextActiveId);
      }
    }

    window.addEventListener("scroll", syncActiveSection, {
      passive: true,
    });
    window.addEventListener("resize", syncActiveSection);
    syncActiveSection();

    return () => {
      window.removeEventListener("scroll", syncActiveSection);
      window.removeEventListener("resize", syncActiveSection);
    };
  }, [items]);

  return (
    <nav
      aria-label="Docs sections"
      className="sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto py-1 pr-2 lg:block"
    >
      <div className="space-y-1 border-l border-slate-200 py-1 pl-3">
        {items.map((item) => {
          const isActive = activeId === item.id;

          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={isActive ? "true" : undefined}
              onClick={() => setActiveId(item.id)}
              className={clsx(
                "block rounded-md border px-3 py-2 text-sm font-semibold shadow-sm backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25",
                isActive
                  ? "border-blue-200 bg-blue-50/80 text-blue-950 shadow-blue-100/60"
                  : "border-transparent bg-white/35 text-slate-500 hover:border-slate-200 hover:bg-white/70 hover:text-slate-950",
              )}
            >
              {item.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
