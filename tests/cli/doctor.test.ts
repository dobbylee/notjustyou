import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeConfig } from "@/packages/notjustyou-cli/src/config";
import { isPrivateConfigModeAcceptable, main } from "@/packages/notjustyou-cli/src/index";

const originalConfigPath = process.env.NOTJUSTYOU_CONFIG_PATH;

beforeEach(() => {
  process.env.NOTJUSTYOU_CONFIG_PATH = join(
    mkdtempSync(join(tmpdir(), "njy-doctor-test-")),
    "config.json",
  );
});

afterEach(() => {
  process.env.NOTJUSTYOU_CONFIG_PATH = originalConfigPath;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CLI doctor", () => {
  it("does not require POSIX owner/group mode semantics on Windows", () => {
    expect(isPrivateConfigModeAcceptable(0o666, "win32")).toBe(true);
    expect(isPrivateConfigModeAcceptable(0o666, "linux")).toBe(false);
  });
  it("checks public status and collector token readiness", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    writeConfig({
      baseUrl: "http://localhost:3000",
      collectorId: "col_test",
      collectorToken: "njy_secret",
      source: "api_middleware",
      serviceIds: ["openai-api"],
      clientName: "notjustyou-cli",
      clientVersion: "0.1.0",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/api/summary")) {
          return jsonResponse({
            windowMinutes: 10,
            updatedAt: "2026-06-21T00:00:00.000Z",
            services: [],
          });
        }

        if (url.endsWith("/api/signals/summary")) {
          return jsonResponse({
            windowMinutes: 10,
            updatedAt: "2026-06-21T00:00:00.000Z",
            services: [],
          });
        }

        if (url.endsWith("/api/official")) {
          return jsonResponse({
            updatedAt: "2026-06-21T00:00:00.000Z",
            services: [],
          });
        }

        if (url.endsWith("/api/collectors/heartbeat")) {
          return jsonResponse({
            ok: true,
          });
        }

        throw new Error(`Unhandled URL: ${url}`);
      }),
    );

    await expect(
      main(["doctor", "--base-url", "http://localhost:3000"]),
    ).resolves.toBe(0);

    expect(log.mock.calls.flat().join("\n")).toContain("OK signal auth readiness");
  });

  it("does not send collector tokens when the doctor base URL differs from config", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    writeConfig({
      baseUrl: "https://notjustyou.dev",
      collectorId: "col_test",
      collectorToken: "njy_secret",
      source: "api_middleware",
      serviceIds: ["openai-api"],
      clientName: "notjustyou-cli",
      clientVersion: "0.1.0",
    });
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain("http://localhost:3000");

      if (url.endsWith("/api/summary")) {
        return jsonResponse({
          windowMinutes: 10,
          updatedAt: "2026-06-21T00:00:00.000Z",
          services: [],
        });
      }

      if (url.endsWith("/api/signals/summary")) {
        return jsonResponse({
          windowMinutes: 10,
          updatedAt: "2026-06-21T00:00:00.000Z",
          services: [],
        });
      }

      if (url.endsWith("/api/official")) {
        return jsonResponse({
          updatedAt: "2026-06-21T00:00:00.000Z",
          services: [],
        });
      }

      throw new Error(`Unhandled URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      main(["doctor", "--base-url", "http://localhost:3000"]),
    ).resolves.toBe(1);
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/collectors/heartbeat"),
      expect.anything(),
    );
    expect(log.mock.calls.flat().join("\n")).toContain(
      "FAIL signal auth readiness (base URL differs from local config)",
    );
  });

  it("reports status failure and missing config", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 503 })),
    );

    await expect(
      main(["doctor", "--base-url", "http://localhost:3000"]),
    ).resolves.toBe(1);

    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("FAIL public status endpoints");
    expect(output).toContain("FAIL local config");
  });

  it("reports malformed config instead of crashing or marking it ready", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    writeFileSync(process.env.NOTJUSTYOU_CONFIG_PATH!, JSON.stringify({}));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          windowMinutes: 10,
          updatedAt: "2026-06-21T00:00:00.000Z",
          services: [],
        }),
      ),
    );

    await expect(
      main(["doctor", "--base-url", "http://localhost:3000"]),
    ).resolves.toBe(1);

    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("FAIL local config");
    expect(output).not.toContain("OK collector allowlist");
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
  });
}
