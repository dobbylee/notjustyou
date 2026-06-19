import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchStatusData, normalizeBaseUrl } from "@/packages/notjustyou-cli/src/api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchStatusData", () => {
  it("reads public status summaries without collector credentials", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/api/summary")) {
        return jsonResponse({
          windowMinutes: 10,
          updatedAt: "2026-06-19T01:00:00.000Z",
          services: [],
        });
      }

      if (url.endsWith("/api/signals/summary")) {
        return jsonResponse({
          windowMinutes: 10,
          updatedAt: "2026-06-19T01:00:00.000Z",
          services: [],
        });
      }

      if (url.endsWith("/api/official")) {
        return jsonResponse({
          updatedAt: "2026-06-19T01:00:00.000Z",
          services: [],
        });
      }

      throw new Error(`Unhandled URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchStatusData("http://localhost:3000/")).resolves.toMatchObject({
      community: {
        windowMinutes: 10,
      },
      installedSignals: {
        windowMinutes: 10,
      },
      official: {
        services: [],
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/summary",
      expect.objectContaining({
        cache: "no-store",
      }),
    );
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("authorization");
  });

  it("treats official status as optional", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/api/official")) {
          return new Response("unavailable", {
            status: 503,
          });
        }

        return jsonResponse({
          windowMinutes: 10,
          updatedAt: "2026-06-19T01:00:00.000Z",
          services: [],
        });
      }),
    );

    await expect(fetchStatusData("http://localhost:3000")).resolves.toMatchObject({
      official: null,
    });
  });

  it("treats installed signal status as optional", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/api/signals/summary")) {
          return new Response("unavailable", {
            status: 503,
          });
        }

        if (url.endsWith("/api/official")) {
          return jsonResponse({
            updatedAt: "2026-06-19T01:00:00.000Z",
            services: [],
          });
        }

        return jsonResponse({
          windowMinutes: 10,
          updatedAt: "2026-06-19T01:00:00.000Z",
          services: [],
        });
      }),
    );

    await expect(fetchStatusData("http://localhost:3000")).resolves.toMatchObject({
      installedSignals: null,
      official: {
        services: [],
      },
    });
  });
});

describe("normalizeBaseUrl", () => {
  it("trims trailing slashes", () => {
    expect(normalizeBaseUrl("http://localhost:3000///")).toBe(
      "http://localhost:3000",
    );
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
  });
}
