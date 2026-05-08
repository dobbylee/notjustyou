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
    <div className="flex gap-2 overflow-x-auto border-b border-slate-200">
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          onClick={() => onSelect(provider.id)}
          className={clsx(
            "h-11 shrink-0 border-b-2 px-3 text-sm font-medium transition-colors",
            provider.id === selectedProviderId
              ? "border-slate-950 text-slate-950"
              : "border-transparent text-slate-500 hover:text-slate-950",
          )}
        >
          {provider.name}
        </button>
      ))}
    </div>
  );
}
