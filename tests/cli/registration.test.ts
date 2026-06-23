import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readConfig } from "@/packages/notjustyou-cli/src/config";
import { main, parseCliArgs } from "@/packages/notjustyou-cli/src/index";

const originalConfigPath = process.env.NOTJUSTYOU_CONFIG_PATH;

beforeEach(() => {
  process.env.NOTJUSTYOU_CONFIG_PATH = join(
    mkdtempSync(join(tmpdir(), "njy-registration-test-")),
    "config.json",
  );
});

afterEach(() => {
  process.env.NOTJUSTYOU_CONFIG_PATH = originalConfigPath;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CLI setup and registration", () => {
  it("defaults setup to api_middleware and openai-api", () => {
    expect(parseCliArgs(["setup"])).toMatchObject({
      command: "setup",
      source: "api_middleware",
      service: undefined,
    });
  });

  it("registers a collector, writes config, and does not print the raw token", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/collectors/register")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          source: "api_middleware",
          serviceIds: ["openai-api"],
          clientName: "notjustyou-cli",
          clientVersion: "0.2.0",
        });

        return jsonResponse({
          collectorId: "col_test",
          collectorToken: "njy_raw_secret",
          expiresAt: null,
        });
      }

      throw new Error(`Unhandled URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      main([
        "register",
        "--source",
        "api_middleware",
        "--service",
        "openai-api",
        "--base-url",
        "http://localhost:3000",
      ]),
    ).resolves.toBe(0);

    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Collector registered.");
    expect(output).toContain("Token: saved locally; raw token is not printed.");
    expect(output).not.toContain("njy_raw_secret");
    expect(readConfig()?.clientVersion).toBe("0.2.0");
  });

  it("registers multiple API middleware services when --service is repeated", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/collectors/register")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          source: "api_middleware",
          serviceIds: ["openai-api", "anthropic-claude-api", "google-gemini-api"],
        });

        return jsonResponse({
          collectorId: "col_multi",
          collectorToken: "njy_raw_secret",
          expiresAt: null,
        });
      }

      throw new Error(`Unhandled URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      main([
        "register",
        "--source",
        "api_middleware",
        "--service",
        "openai-api",
        "--service",
        "anthropic-claude-api",
        "--service",
        "google-gemini-api",
        "--base-url",
        "http://localhost:3000",
      ]),
    ).resolves.toBe(0);

    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Allowed services: openai-api, anthropic-claude-api, google-gemini-api");
    expect(output).not.toContain("njy_raw_secret");
  });

  it("deduplicates repeated service allowlist values", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/collectors/register")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          serviceIds: ["openai-api", "anthropic-claude-api"],
        });

        return jsonResponse({
          collectorId: "col_dedupe",
          collectorToken: "njy_raw_secret",
          expiresAt: null,
        });
      }

      throw new Error(`Unhandled URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      main([
        "register",
        "--service",
        "openai-api",
        "--service",
        "openai-api",
        "--service",
        "anthropic-claude-api",
      ]),
    ).resolves.toBe(0);
  });

  it("runs setup with registration, config write, doctor checks, and next steps", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/api/collectors/register")) {
          return jsonResponse({
            collectorId: "col_setup",
            collectorToken: "njy_setup_secret",
            expiresAt: null,
          });
        }

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
      main(["setup", "--base-url", "http://localhost:3000"]),
    ).resolves.toBe(0);

    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("OK public status endpoints");
    expect(output).toContain("OK signal auth readiness");
    expect(output).toContain("Setup complete.");
    expect(output).toContain("Next: configure the SDK collector");
    expect(output).not.toContain("njy_setup_secret");
  });

  it("does not print setup success when doctor checks fail", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/api/collectors/register")) {
          return jsonResponse({
            collectorId: "col_setup",
            collectorToken: "njy_setup_secret",
            expiresAt: null,
          });
        }

        return new Response("unavailable", {
          status: 503,
        });
      }),
    );

    await expect(
      main(["setup", "--base-url", "http://localhost:3000"]),
    ).rejects.toThrow("doctor checks did not pass");

    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("FAIL public status endpoints");
    expect(output).not.toContain("Setup complete.");
    expect(output).not.toContain("Next: configure the SDK collector");
  });

  it("rejects unsupported source and service before calling the server", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(main(["register", "--source", "manual_report"])).rejects.toThrow(
      "Unsupported source",
    );
    await expect(main(["register", "--service", "missing-service"])).rejects.toThrow(
      "Unsupported service",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
  });
}
