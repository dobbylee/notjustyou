import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readConfig, writeConfig } from "@/packages/notjustyou-cli/src/config";
import { main, parseCliArgs } from "@/packages/notjustyou-cli/src/index";
import { REPORTING_SURFACES } from "@/packages/notjustyou-cli/src/reporting-setup";

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
  it("uses the current Antigravity 2.0 display name", () => {
    expect(REPORTING_SURFACES.antigravity.displayName).toBe("Antigravity 2.0");
  });

  it("defaults setup to api_middleware and openai-api", () => {
    expect(parseCliArgs(["setup"])).toMatchObject({
      command: "setup",
      source: "api_middleware",
      service: undefined,
      enableLocalHooks: false,
    });
  });

  it("registers a collector, writes config, and does not print collector credentials", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/collectors/register")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          source: "api_middleware",
          serviceIds: ["openai-api"],
          clientName: "notjustyou-cli",
          clientVersion: "0.3.6",
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
    expect(output).not.toContain("col_test");
    expect(output).not.toContain("njy_raw_secret");
    expect(readConfig()?.clientVersion).toBe("0.3.6");
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
    expect(output).not.toContain("col_multi");
    expect(output).not.toContain("njy_raw_secret");
  });

  it("registers explicit local hook opt-in for cli_hook collectors", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/collectors/register")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          source: "cli_hook",
          serviceIds: ["anthropic-claude-code"],
        });

        return jsonResponse({
          collectorId: "col_hooks",
          collectorToken: "njy_raw_secret",
          expiresAt: null,
        });
      }

      throw new Error(`Unhandled URL: ${url}`);
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      main([
        "register",
        "--source",
        "cli_hook",
        "--service",
        "anthropic-claude-code",
        "--enable-local-hooks",
      ]),
    ).resolves.toBe(0);

    expect(readConfig()).toMatchObject({
      source: "cli_hook",
      serviceIds: ["anthropic-claude-code"],
      localHookSignalOptIn: true,
      localReceiverToken: expect.any(String),
    });
  });

  it("rejects local hook opt-in for Codex until a safe hook event is available", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      main([
        "register",
        "--source",
        "cli_hook",
        "--service",
        "openai-codex-cli",
        "--enable-local-hooks",
      ]),
    ).rejects.toThrow(
      "--enable-local-hooks currently supports anthropic-claude-code, cursor-ide, google-antigravity-cli, google-antigravity, and google-antigravity-ide only.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("registers Cursor local hook opt-in for the raw local adapter", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/collectors/register")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          source: "cli_hook",
          serviceIds: ["cursor-ide"],
        });

        return jsonResponse({
          collectorId: "col_cursor",
          collectorToken: "njy_raw_secret",
          expiresAt: null,
        });
      }

      throw new Error(`Unhandled URL: ${url}`);
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      main([
        "register",
        "--source",
        "cli_hook",
        "--service",
        "cursor-ide",
        "--enable-local-hooks",
      ]),
    ).resolves.toBe(0);

    expect(readConfig()).toMatchObject({
      source: "cli_hook",
      serviceIds: ["cursor-ide"],
      localHookSignalOptIn: true,
      localReceiverToken: expect.any(String),
    });
  });

  it("rejects multiple Antigravity services in lower-level local hook registration", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      main([
        "register",
        "--source",
        "cli_hook",
        "--service",
        "google-antigravity-cli",
        "--service",
        "google-antigravity-ide",
        "--enable-local-hooks",
      ]),
    ).rejects.toThrow(
      "--enable-local-hooks supports only one Antigravity service at a time.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(readConfig()).toBeNull();
  });

  it("enables Claude Code reporting with one command", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/collectors/register")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          source: "cli_hook",
          serviceIds: ["anthropic-claude-code"],
          clientName: "notjustyou-cli",
          clientVersion: "0.3.6",
        });

        return jsonResponse({
          collectorId: "col_claude",
          collectorToken: "njy_raw_secret",
          expiresAt: null,
        });
      }

      throw new Error(`Unhandled URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      main([
        "enable",
        "claude-code",
        "--base-url",
        "http://localhost:3000",
        "--skip-receiver",
      ]),
    ).resolves.toBe(0);

    expect(readConfig()).toMatchObject({
      source: "cli_hook",
      serviceIds: ["anthropic-claude-code"],
      localHookSignalOptIn: true,
      clientVersion: "0.3.6",
    });
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Claude Code reporting enabled.");
    expect(output).toContain("Local hook receiver: skipped");
    expect(output).not.toContain("njy_raw_secret");
  });

  it("migrates an enabled legacy hook config to local receiver authentication", async () => {
    writeConfig({
      baseUrl: "http://localhost:3000",
      collectorId: "col_legacy",
      collectorToken: "njy_legacy_secret",
      source: "cli_hook",
      serviceIds: ["anthropic-claude-code"],
      clientName: "notjustyou-cli",
      clientVersion: "0.3.4",
      localHookSignalOptIn: true,
    });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/api/collectors/register")) {
        return jsonResponse({
          collectorId: "col_migrated",
          collectorToken: "njy_migrated_secret",
          expiresAt: null,
        });
      }
      throw new Error(`Unhandled URL: ${url}`);
    }));

    await expect(main(["enable", "claude-code", "--skip-receiver", "--quiet"]))
      .resolves.toBe(0);
    expect(readConfig()).toMatchObject({
      collectorId: "col_migrated",
      localHookSignalOptIn: true,
      localReceiverToken: expect.any(String),
    });
  });

  it("rejects a preview receiver instead of reporting send readiness", async () => {
    writeConfig({
      baseUrl: "http://localhost:3000",
      collectorId: "col_hook",
      collectorToken: "njy_hook_secret",
      source: "cli_hook",
      serviceIds: ["anthropic-claude-code"],
      clientName: "notjustyou-cli",
      clientVersion: "0.3.6",
      localHookSignalOptIn: true,
      localReceiverToken: "receiver-secret-token",
    });
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "http://127.0.0.1:8765/health") {
        return jsonResponse({
          ok: true,
          name: "notjustyou-hook-receiver",
          mode: "preview",
        });
      }
      throw new Error(`Unhandled URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(main(["enable", "claude-code", "--quiet"])).rejects.toThrow(
      "Local hook receiver is running in preview mode. Stop it before enabling reporting.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reuses an authenticated send receiver without spawning another one", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    writeConfig({
      baseUrl: "http://localhost:3000",
      collectorId: "col_hook",
      collectorToken: "njy_hook_secret",
      source: "cli_hook",
      serviceIds: ["anthropic-claude-code"],
      clientName: "notjustyou-cli",
      clientVersion: "0.3.6",
      localHookSignalOptIn: true,
      localReceiverToken: "receiver-secret-token",
    });
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "http://127.0.0.1:8765/health") {
        return jsonResponse({
          ok: true,
          name: "notjustyou-hook-receiver",
          mode: "send",
        });
      }
      throw new Error(`Unhandled URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(main(["enable", "claude-code"])).resolves.toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(log.mock.calls.flat().join("\n")).toContain(
      "Local hook receiver: already running",
    );
  });

  it("enables Cursor reporting with one command", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/collectors/register")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          source: "cli_hook",
          serviceIds: ["cursor-ide"],
          clientName: "notjustyou-cli",
          clientVersion: "0.3.6",
        });

        return jsonResponse({
          collectorId: "col_cursor",
          collectorToken: "njy_raw_secret",
          expiresAt: null,
        });
      }

      throw new Error(`Unhandled URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      main([
        "enable",
        "cursor",
        "--base-url",
        "http://localhost:3000",
        "--skip-receiver",
      ]),
    ).resolves.toBe(0);

    expect(readConfig()).toMatchObject({
      source: "cli_hook",
      serviceIds: ["cursor-ide"],
      localHookSignalOptIn: true,
      clientVersion: "0.3.6",
    });
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Cursor reporting enabled.");
    expect(output).toContain("Local hook receiver: skipped");
    expect(output).not.toContain("njy_raw_secret");
  });

  it("enables Antigravity CLI reporting with one command", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/collectors/register")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          source: "cli_hook",
          serviceIds: ["google-antigravity-cli"],
          clientName: "notjustyou-cli",
          clientVersion: "0.3.6",
        });

        return jsonResponse({
          collectorId: "col_antigravity",
          collectorToken: "njy_raw_secret",
          expiresAt: null,
        });
      }

      throw new Error(`Unhandled URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      main([
        "enable",
        "antigravity-cli",
        "--base-url",
        "http://localhost:3000",
        "--skip-receiver",
      ]),
    ).resolves.toBe(0);

    expect(readConfig()).toMatchObject({
      source: "cli_hook",
      serviceIds: ["google-antigravity-cli"],
      localHookSignalOptIn: true,
      clientVersion: "0.3.6",
    });
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Antigravity CLI reporting enabled.");
    expect(output).toContain("Local hook receiver: skipped");
    expect(output).not.toContain("njy_raw_secret");
  });

  it("uses the Antigravity 2.0 name when enabling app reporting", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/collectors/register")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          source: "cli_hook",
          serviceIds: ["google-antigravity"],
          clientName: "notjustyou-cli",
          clientVersion: "0.3.6",
        });

        return jsonResponse({
          collectorId: "col_antigravity_app",
          collectorToken: "njy_raw_secret",
          expiresAt: null,
        });
      }

      throw new Error(`Unhandled URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      main([
        "enable",
        "antigravity",
        "--base-url",
        "http://localhost:3000",
        "--skip-receiver",
      ]),
    ).resolves.toBe(0);

    expect(readConfig()).toMatchObject({
      source: "cli_hook",
      serviceIds: ["google-antigravity"],
      localHookSignalOptIn: true,
    });
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Antigravity 2.0 reporting enabled.");
    expect(output).not.toContain("njy_raw_secret");
  });

  it("does not overwrite an existing non-hook collector config", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    writeConfig({
      baseUrl: "http://localhost:3000",
      collectorId: "col_api",
      collectorToken: "njy_api_secret",
      source: "api_middleware",
      serviceIds: ["openai-api"],
      clientName: "notjustyou-cli",
      clientVersion: "0.3.6",
    });

    await expect(
      main(["enable", "claude-code", "--skip-receiver"]),
    ).rejects.toThrow("Existing config uses a different collector source");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(readConfig()).toMatchObject({
      source: "api_middleware",
      serviceIds: ["openai-api"],
    });
  });

  it("does not broaden an existing cli_hook config with unsupported local hook services", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    writeConfig({
      baseUrl: "http://localhost:3000",
      collectorId: "col_mixed",
      collectorToken: "njy_mixed_secret",
      source: "cli_hook",
      serviceIds: ["anthropic-claude-code", "openai-codex-cli"],
      clientName: "notjustyou-cli",
      clientVersion: "0.3.6",
      localHookSignalOptIn: true,
    });

    await expect(
      main(["enable", "claude-code", "--skip-receiver"]),
    ).rejects.toThrow(
      "Existing cli_hook config includes unsupported local hook service openai-codex-cli",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(readConfig()).toMatchObject({
      serviceIds: ["anthropic-claude-code", "openai-codex-cli"],
      localHookSignalOptIn: true,
    });
  });

  it("adds a supported reporting surface without disabling existing surfaces", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    writeConfig({
      baseUrl: "http://localhost:3000",
      collectorId: "col_cursor",
      collectorToken: "njy_cursor_secret",
      source: "cli_hook",
      serviceIds: ["cursor-ide"],
      clientName: "notjustyou-cli",
      clientVersion: "0.3.6",
      localHookSignalOptIn: true,
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/collectors/register")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          source: "cli_hook",
          serviceIds: ["cursor-ide", "google-antigravity-cli"],
          clientName: "notjustyou-cli",
          clientVersion: "0.3.6",
        });

        return jsonResponse({
          collectorId: "col_cursor_antigravity",
          collectorToken: "njy_new_secret",
          expiresAt: null,
        });
      }

      throw new Error(`Unhandled URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      main(["enable", "antigravity-cli", "--skip-receiver"]),
    ).resolves.toBe(0);
    expect(readConfig()).toMatchObject({
      collectorId: "col_cursor_antigravity",
      serviceIds: ["cursor-ide", "google-antigravity-cli"],
      localHookSignalOptIn: true,
      clientVersion: "0.3.6",
    });
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Antigravity CLI reporting enabled.");
    expect(output).toContain("Allowed services: cursor-ide, google-antigravity-cli");
    expect(output).not.toContain("njy_cursor_secret");
    expect(output).not.toContain("njy_new_secret");
  });

  it("supports Claude Code, Cursor, and one Antigravity surface together", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    writeConfig({
      baseUrl: "http://localhost:3000",
      collectorId: "col_claude_cursor",
      collectorToken: "njy_claude_cursor_secret",
      source: "cli_hook",
      serviceIds: ["anthropic-claude-code", "cursor-ide"],
      clientName: "notjustyou-cli",
      clientVersion: "0.3.6",
      localHookSignalOptIn: true,
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/collectors/register")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          source: "cli_hook",
          serviceIds: [
            "anthropic-claude-code",
            "cursor-ide",
            "google-antigravity-cli",
          ],
          clientName: "notjustyou-cli",
          clientVersion: "0.3.6",
        });

        return jsonResponse({
          collectorId: "col_claude_cursor_antigravity",
          collectorToken: "njy_tri_surface_secret",
          expiresAt: null,
        });
      }

      throw new Error(`Unhandled URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      main(["enable", "antigravity-cli", "--skip-receiver"]),
    ).resolves.toBe(0);

    expect(readConfig()).toMatchObject({
      collectorId: "col_claude_cursor_antigravity",
      serviceIds: [
        "anthropic-claude-code",
        "cursor-ide",
        "google-antigravity-cli",
      ],
      localHookSignalOptIn: true,
    });
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain(
      "Allowed services: anthropic-claude-code, cursor-ide, google-antigravity-cli",
    );
    expect(output).not.toContain("njy_claude_cursor_secret");
    expect(output).not.toContain("njy_tri_surface_secret");
  });

  it("replaces another Antigravity surface instead of configuring two ambiguous Antigravity hooks", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    writeConfig({
      baseUrl: "http://localhost:3000",
      collectorId: "col_antigravity_cli",
      collectorToken: "njy_antigravity_cli_secret",
      source: "cli_hook",
      serviceIds: ["cursor-ide", "google-antigravity-cli"],
      clientName: "notjustyou-cli",
      clientVersion: "0.3.6",
      localHookSignalOptIn: true,
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/collectors/register")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          source: "cli_hook",
          serviceIds: ["cursor-ide", "google-antigravity-ide"],
          clientName: "notjustyou-cli",
          clientVersion: "0.3.6",
        });

        return jsonResponse({
          collectorId: "col_cursor_antigravity_ide",
          collectorToken: "njy_replaced_secret",
          expiresAt: null,
        });
      }

      throw new Error(`Unhandled URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      main(["enable", "antigravity-ide", "--skip-receiver"]),
    ).resolves.toBe(0);

    expect(readConfig()).toMatchObject({
      collectorId: "col_cursor_antigravity_ide",
      serviceIds: ["cursor-ide", "google-antigravity-ide"],
      localHookSignalOptIn: true,
    });
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Antigravity IDE reporting enabled.");
    expect(output).not.toContain("google-antigravity-cli");
    expect(output).not.toContain("njy_antigravity_cli_secret");
    expect(output).not.toContain("njy_replaced_secret");
  });

  it("normalizes stale configs that already include multiple Antigravity services", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    writeConfig({
      baseUrl: "http://localhost:3000",
      collectorId: "col_ambiguous_antigravity",
      collectorToken: "njy_ambiguous_secret",
      source: "cli_hook",
      serviceIds: [
        "cursor-ide",
        "google-antigravity-cli",
        "google-antigravity-ide",
      ],
      clientName: "notjustyou-cli",
      clientVersion: "0.3.6",
      localHookSignalOptIn: true,
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/collectors/register")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          source: "cli_hook",
          serviceIds: ["cursor-ide", "google-antigravity-cli"],
          clientName: "notjustyou-cli",
          clientVersion: "0.3.6",
        });

        return jsonResponse({
          collectorId: "col_normalized_antigravity",
          collectorToken: "njy_normalized_secret",
          expiresAt: null,
        });
      }

      throw new Error(`Unhandled URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      main(["enable", "antigravity-cli", "--skip-receiver"]),
    ).resolves.toBe(0);

    expect(readConfig()).toMatchObject({
      collectorId: "col_normalized_antigravity",
      serviceIds: ["cursor-ide", "google-antigravity-cli"],
      localHookSignalOptIn: true,
    });
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Antigravity CLI reporting enabled.");
    expect(output).not.toContain("google-antigravity-ide");
    expect(output).not.toContain("njy_ambiguous_secret");
    expect(output).not.toContain("njy_normalized_secret");
  });

  it("does not print config path, collector id, or token in quiet enable output", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/api/collectors/register")) {
        return jsonResponse({
          collectorId: "col_quiet",
          collectorToken: "njy_quiet_secret",
          expiresAt: null,
        });
      }

      throw new Error(`Unhandled URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      main([
        "enable",
        "antigravity-cli",
        "--base-url",
        "http://localhost:3000",
        "--skip-receiver",
        "--quiet",
      ]),
    ).resolves.toBe(0);

    const output = log.mock.calls.flat().join("\n");
    expect(output).toBe("");
    expect(output).not.toContain(process.env.NOTJUSTYOU_CONFIG_PATH ?? "");
    expect(output).not.toContain("col_quiet");
    expect(output).not.toContain("njy_quiet_secret");
  });

  it("replaces a disabled cli_hook config for another service when enabling reporting", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    writeConfig({
      baseUrl: "http://localhost:3000",
      collectorId: "col_cursor",
      collectorToken: "njy_cursor_secret",
      source: "cli_hook",
      serviceIds: ["cursor-ide"],
      clientName: "notjustyou-cli",
      clientVersion: "0.3.6",
      localHookSignalOptIn: false,
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/collectors/register")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          source: "cli_hook",
          serviceIds: ["google-antigravity-cli"],
          clientName: "notjustyou-cli",
          clientVersion: "0.3.6",
        });

        return jsonResponse({
          collectorId: "col_antigravity",
          collectorToken: "njy_new_secret",
          expiresAt: null,
        });
      }

      throw new Error(`Unhandled URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      main(["enable", "antigravity-cli", "--skip-receiver"]),
    ).resolves.toBe(0);

    expect(readConfig()).toMatchObject({
      collectorId: "col_antigravity",
      source: "cli_hook",
      serviceIds: ["google-antigravity-cli"],
      localHookSignalOptIn: true,
      clientVersion: "0.3.6",
    });
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Antigravity CLI reporting enabled.");
    expect(output).not.toContain("njy_cursor_secret");
    expect(output).not.toContain("njy_new_secret");
  });

  it("disables Claude Code hook sending without printing the token", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    writeConfig({
      baseUrl: "http://localhost:3000",
      collectorId: "col_hook",
      collectorToken: "njy_hook_secret",
      source: "cli_hook",
      serviceIds: ["anthropic-claude-code"],
      clientName: "notjustyou-cli",
      clientVersion: "0.3.6",
      localHookSignalOptIn: true,
    });

    await expect(main(["disable", "claude-code"])).resolves.toBe(0);

    expect(readConfig()).toMatchObject({
      source: "cli_hook",
      localHookSignalOptIn: false,
    });
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Claude Code reporting disabled.");
    expect(output).not.toContain("njy_hook_secret");
  });

  it("disables Cursor hook sending without printing the token", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    writeConfig({
      baseUrl: "http://localhost:3000",
      collectorId: "col_cursor",
      collectorToken: "njy_cursor_secret",
      source: "cli_hook",
      serviceIds: ["cursor-ide"],
      clientName: "notjustyou-cli",
      clientVersion: "0.3.6",
      localHookSignalOptIn: true,
    });

    await expect(main(["disable", "cursor"])).resolves.toBe(0);

    expect(readConfig()).toMatchObject({
      source: "cli_hook",
      serviceIds: ["cursor-ide"],
      localHookSignalOptIn: false,
    });
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Cursor reporting disabled.");
    expect(output).not.toContain("njy_cursor_secret");
  });

  it("does not disable a different reporting surface config", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    writeConfig({
      baseUrl: "http://localhost:3000",
      collectorId: "col_claude",
      collectorToken: "njy_claude_secret",
      source: "cli_hook",
      serviceIds: ["anthropic-claude-code"],
      clientName: "notjustyou-cli",
      clientVersion: "0.3.6",
      localHookSignalOptIn: true,
    });

    await expect(main(["disable", "cursor"])).resolves.toBe(0);

    expect(readConfig()).toMatchObject({
      source: "cli_hook",
      serviceIds: ["anthropic-claude-code"],
      localHookSignalOptIn: true,
    });
    expect(log.mock.calls.flat().join("\n")).toContain(
      "Cursor reporting is not enabled for this config.",
    );
  });

  it("does not re-enable disabled multi-surface hook configs when disabling one surface", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    writeConfig({
      baseUrl: "http://localhost:3000",
      collectorId: "col_disabled",
      collectorToken: "njy_disabled_secret",
      source: "cli_hook",
      serviceIds: ["anthropic-claude-code", "cursor-ide"],
      clientName: "notjustyou-cli",
      clientVersion: "0.3.6",
      localHookSignalOptIn: false,
    });

    await expect(main(["disable", "cursor"])).resolves.toBe(0);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(readConfig()).toMatchObject({
      collectorId: "col_disabled",
      serviceIds: ["anthropic-claude-code", "cursor-ide"],
      localHookSignalOptIn: false,
    });
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Cursor reporting is not enabled for this config.");
    expect(output).not.toContain("njy_disabled_secret");
  });

  it("disables only the requested surface in a multi-surface hook config", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    writeConfig({
      baseUrl: "http://localhost:3000",
      collectorId: "col_mixed",
      collectorToken: "njy_mixed_secret",
      source: "cli_hook",
      serviceIds: ["anthropic-claude-code", "cursor-ide"],
      clientName: "notjustyou-cli",
      clientVersion: "0.3.6",
      localHookSignalOptIn: true,
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/collectors/register")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          source: "cli_hook",
          serviceIds: ["anthropic-claude-code"],
          clientName: "notjustyou-cli",
          clientVersion: "0.3.6",
        });

        return jsonResponse({
          collectorId: "col_claude_only",
          collectorToken: "njy_rotated_secret",
          expiresAt: null,
        });
      }

      throw new Error(`Unhandled URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(main(["disable", "cursor"])).resolves.toBe(0);
    expect(readConfig()).toMatchObject({
      collectorId: "col_claude_only",
      serviceIds: ["anthropic-claude-code"],
      localHookSignalOptIn: true,
    });
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Cursor reporting disabled.");
    expect(output).toContain("Remaining allowed services: anthropic-claude-code");
    expect(output).not.toContain("njy_mixed_secret");
    expect(output).not.toContain("njy_rotated_secret");
  });

  it("rejects unknown reporting surfaces", async () => {
    await expect(main(["enable", "codex", "--skip-receiver"])).rejects.toThrow(
      "Supported reporting surfaces: claude-code, cursor, antigravity-cli, antigravity, antigravity-ide.",
    );
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
    expect(output).not.toContain("col_setup");
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
    await expect(
      main(["register", "--source", "api_middleware", "--enable-local-hooks"]),
    ).rejects.toThrow("--enable-local-hooks requires --source cli_hook.");
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
