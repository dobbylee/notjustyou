/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProviderTabs } from "@/components/provider-tabs";
import { PROVIDERS } from "@/lib/catalog";

describe("ProviderTabs", () => {
  it("renders providers, marks the selected provider, and reports selections", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <ProviderTabs
        providers={PROVIDERS}
        selectedProviderId="openai"
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole("button", { name: "OpenAI", pressed: true }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Google", pressed: false }))
      .toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Google" }));

    expect(onSelect).toHaveBeenCalledWith("google");
  });
});
