import { describe, expect, it } from "vitest";
import { getGoogleProductStatus, type GoogleStatusIncident } from "@/lib/official/google";
import {
  findStatuspageComponent,
  findStatuspageComponents,
  getStatuspageProviderAdvisories,
  getWorstStatuspageComponent,
} from "@/lib/official/statuspage";
import type { OfficialProviderStatus } from "@/lib/official/types";

describe("official status helpers", () => {
  it("matches Statuspage components by name", () => {
    const status: OfficialProviderStatus = {
      providerId: "cursor",
      overall: "operational",
      source: "official",
      updatedAt: "2026-05-09T00:00:00.000Z",
      components: [
        {
          id: "cursor-ide",
          name: "IDE",
          status: "operational",
          updatedAt: "2026-05-09T00:00:00.000Z",
        },
      ],
    };

    expect(findStatuspageComponent(status, "ide")?.name).toBe("IDE");
  });

  it("matches the Cursor Grok Bot component by name", () => {
    const status: OfficialProviderStatus = {
      providerId: "cursor",
      overall: "operational",
      source: "official",
      updatedAt: "2026-09-02T00:00:00.000Z",
      components: [
        {
          id: "cursor-grok-bot",
          name: "Grok Bot",
          status: "operational",
          updatedAt: "2026-09-02T00:00:00.000Z",
        },
      ],
    };

    expect(findStatuspageComponent(status, "grok bot")?.name).toBe("Grok Bot");
  });

  it("matches Claude official components by name", () => {
    const status: OfficialProviderStatus = {
      providerId: "anthropic",
      overall: "operational",
      source: "official",
      updatedAt: "2026-05-09T00:00:00.000Z",
      components: [
        {
          id: "claude-ai",
          name: "claude.ai",
          status: "operational",
          updatedAt: "2026-05-09T00:00:00.000Z",
        },
        {
          id: "claude-cowork",
          name: "Claude Cowork",
          status: "operational",
          updatedAt: "2026-05-09T00:00:00.000Z",
        },
      ],
    };

    expect(findStatuspageComponent(status, "claude.ai")?.status).toBe(
      "operational",
    );
    expect(findStatuspageComponent(status, "Claude Cowork")?.status).toBe(
      "operational",
    );
  });

  it("matches OpenAI official components by name", () => {
    const status: OfficialProviderStatus = {
      providerId: "openai",
      overall: "operational",
      source: "official",
      updatedAt: "2026-05-09T00:00:00.000Z",
      components: [
        {
          id: "openai-app",
          name: "Codex in ChatGPT Desktop",
          status: "operational",
          updatedAt: "2026-05-09T00:00:00.000Z",
        },
        {
          id: "openai-conversations",
          name: "Conversations",
          status: "operational",
          updatedAt: "2026-05-09T00:00:00.000Z",
        },
        {
          id: "openai-chatgpt-work",
          name: "ChatGPT Work",
          status: "operational",
          updatedAt: "2026-09-02T00:00:00.000Z",
        },
        {
          id: "openai-chat-completions",
          name: "Chat Completions",
          status: "operational",
          updatedAt: "2026-05-09T00:00:00.000Z",
        },
        {
          id: "openai-responses",
          name: "Responses",
          status: "degraded",
          updatedAt: "2026-05-09T00:01:00.000Z",
        },
      ],
    };

    expect(
      findStatuspageComponent(status, "Codex in ChatGPT Desktop")?.status,
    ).toBe("operational");
    expect(findStatuspageComponent(status, "Conversations")?.status).toBe(
      "operational",
    );
    expect(findStatuspageComponent(status, "ChatGPT Work")?.status).toBe(
      "operational",
    );
    expect(findStatuspageComponent(status, "Chat Completions")?.status).toBe(
      "operational",
    );
    const apiComponents = findStatuspageComponents(status, [
      "Chat Completions",
      "Responses",
    ]);
    expect(apiComponents).toHaveLength(2);
    expect(getWorstStatuspageComponent(apiComponents ?? [])?.name).toBe(
      "Responses",
    );
  });

  it("preserves active provider advisories without assigning them to a component", () => {
    expect(
      getStatuspageProviderAdvisories(
        "openai",
        {
          incidents: [
            {
              id: "provider-advisory",
              name: "Enterprise access advisory",
              status: "identified",
              impact: "none",
              updated_at: "2026-07-18T00:01:00.000Z",
              components: [],
            },
            {
              id: "component-incident",
              name: "Responses errors",
              status: "investigating",
              impact: "minor",
              components: [{ id: "openai-responses" }],
            },
            {
              id: "resolved-provider-advisory",
              name: "Resolved advisory",
              status: "resolved",
              impact: "none",
              components: [],
            },
          ],
        },
        "2026-07-18T00:00:00.000Z",
      ),
    ).toEqual([
      {
        providerId: "openai",
        id: "provider-advisory",
        name: "Enterprise access advisory",
        status: "identified",
        impact: "none",
        updatedAt: "2026-07-18T00:01:00.000Z",
      },
    ]);
  });

  it("maps active Google service disruptions to degraded", () => {
    const incidents: GoogleStatusIncident[] = [
      {
        id: "incident-1",
        created: "2026-05-09T00:00:00+00:00",
        affected_products: [{ id: "gemini", title: "Gemini" }],
        most_recent_update: {
          when: "2026-05-09T00:30:00+00:00",
          status: "SERVICE_DISRUPTION",
        },
      },
    ];

    expect(
      getGoogleProductStatus(
        "gemini",
        incidents,
        new Date("2026-05-09T01:00:00.000Z"),
      ),
    ).toEqual({
      overall: "degraded",
      updatedAt: "2026-05-09T00:30:00+00:00",
    });
  });

  it("ignores resolved Google incidents", () => {
    const incidents: GoogleStatusIncident[] = [
      {
        id: "incident-1",
        created: "2026-05-08T00:00:00+00:00",
        end: "2026-05-08T01:00:00+00:00",
        affected_products: [{ id: "gemini", title: "Gemini" }],
        most_recent_update: {
          when: "2026-05-08T01:00:00+00:00",
          status: "AVAILABLE",
        },
      },
    ];

    expect(
      getGoogleProductStatus(
        "gemini",
        incidents,
        new Date("2026-05-09T01:00:00.000Z"),
      ).overall,
    ).toBe("operational");
  });
});
