import { describe, expect, it } from "vitest";
import { CATALOG, PROVIDERS } from "@/lib/catalog";

describe("catalog", () => {
  it("has unique service ids", () => {
    const ids = CATALOG.map((service) => service.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only references known providers", () => {
    const providerIds = new Set(PROVIDERS.map((provider) => provider.id));

    expect(CATALOG.every((service) => providerIds.has(service.providerId))).toBe(true);
  });

  it("keeps official status refs on the owning provider", () => {
    expect(
      CATALOG.every(
        (service) =>
          !service.officialStatusRef ||
          service.officialStatusRef.providerId === service.providerId,
      ),
    ).toBe(true);
  });

  it("uses the fixed report options for every service", () => {
    expect(
      CATALOG.every((service) =>
        service.reportOptions.join(",") === "slow,error,down",
      ),
    ).toBe(true);
  });

  it("maps OpenAI surfaces to official status components", () => {
    const officialComponentByServiceId = new Map(
      CATALOG.filter((service) => service.providerId === "openai").map((service) => [
        service.id,
        service.officialStatusRef?.kind === "statuspage_component"
          ? service.officialStatusRef.componentName
          : null,
      ]),
    );

    expect(officialComponentByServiceId).toEqual(
      new Map([
        ["openai-codex-cli", "CLI"],
        ["openai-codex-app", "App"],
        ["openai-chatgpt", "Conversations"],
        ["openai-api", "Chat Completions"],
      ]),
    );
    expect(officialComponentByServiceId.has("openai-codex-desktop")).toBe(false);
    expect(officialComponentByServiceId.has("openai-chatgpt-web")).toBe(false);
    expect(officialComponentByServiceId.has("openai-chatgpt-desktop")).toBe(false);
  });

  it("keeps the Google service catalog organized by current surfaces", () => {
    expect(
      CATALOG.filter((service) => service.providerId === "google").map((service) => ({
        id: service.id,
        name: service.name,
        surfaceType: service.surfaceType,
      })),
    ).toEqual([
      {
        id: "google-antigravity-cli",
        name: "Antigravity CLI",
        surfaceType: "cli",
      },
      {
        id: "google-antigravity",
        name: "Antigravity",
        surfaceType: "app",
      },
      {
        id: "google-antigravity-ide",
        name: "Antigravity IDE",
        surfaceType: "ide",
      },
      {
        id: "google-gemini-web",
        name: "Gemini Web",
        surfaceType: "web",
      },
      {
        id: "google-gemini-api",
        name: "Gemini API",
        surfaceType: "api",
      },
    ]);
  });
});
