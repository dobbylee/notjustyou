"use client";

import { clsx } from "clsx";
import type { Provider, ProviderId } from "@/lib/catalog";

interface ProviderTabsProps {
  providers: readonly Provider[];
  selectedProviderId: ProviderId;
  onSelect: (providerId: ProviderId) => void;
}

export function ProviderTabs({
  providers,
  selectedProviderId,
  onSelect,
}: ProviderTabsProps) {
  return (
    <div className="flex gap-6 overflow-x-auto border-b border-slate-200 pb-px">
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          aria-pressed={provider.id === selectedProviderId}
          onClick={() => onSelect(provider.id)}
          className={clsx(
            "relative h-12 shrink-0 text-base font-semibold tracking-tight transition-colors duration-200 focus-visible:outline-none",
            provider.id === selectedProviderId
              ? "font-semibold text-slate-900"
              : "font-semibold text-slate-500 hover:text-slate-800",
          )}
        >
          {provider.name}
          {provider.id === selectedProviderId && (
            <span
              className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-slate-900"
              style={{ transform: "translateY(1px)" }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
