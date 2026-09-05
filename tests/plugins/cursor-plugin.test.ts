import { createTempDir } from "@/tests/helpers/temp-dir";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { previewPayload } from "@/packages/notjustyou-cli/src/privacy";

const pluginRoot = join(process.cwd(), "packages/notjustyou-cursor-plugin");
const marketplaceRoot = join(process.cwd(), ".cursor-plugin");

describe("Cursor status plugin", () => {
  it("declares a Cursor plugin manifest", () => {
    const manifest = readJson(".cursor-plugin/plugin.json");

    expect(manifest).toMatchObject({
      name: "notjustyou",
      displayName: "Not Just You",
      description:
        "Adds Not Just You status tools and optional local hook reporting for Cursor surfaces.",
      version: "0.1.5",
      license: "MIT",
    });
    expect(manifest.name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("bundles the published status and setup MCP server", () => {
    const mcpConfig = readJson("mcp.json");

    expect(mcpConfig).toEqual({
      mcpServers: {
        status: {
          command: "npx",
          args: ["-y", "@notjustyou/mcp@0.2.7"],
          env: {
            NOTJUSTYOU_BASE_URL: "https://notjustyou.dev",
          },
        },
      },
    });
  });

  it("bundles hooks that only target the local receiver", () => {
    const rootEntries = readdirSync(pluginRoot);
    const hookImplementation = [
      readFileSync(join(pluginRoot, "hooks/hooks.json"), "utf8"),
      readFileSync(join(pluginRoot, "hooks/forward-local-hook.mjs"), "utf8"),
    ].join("\n");
    const serializedPlugin = [
      readFileSync(join(pluginRoot, ".cursor-plugin/plugin.json"), "utf8"),
      readFileSync(join(pluginRoot, "mcp.json"), "utf8"),
      readFileSync(join(pluginRoot, "commands/setup-reporting.md"), "utf8"),
      hookImplementation,
      readFileSync(join(pluginRoot, "skills/status/SKILL.md"), "utf8"),
      readFileSync(join(pluginRoot, "skills/setup-reporting/SKILL.md"), "utf8"),
      readFileSync(join(pluginRoot, "README.md"), "utf8"),
    ].join("\n");
    const hooks = readJson("hooks/hooks.json");

    expect(rootEntries).toContain("hooks");
    expect(hooks.version).toBe(1);
    expect(hooks.hooks).toHaveProperty("stop");
    expect(hooks.hooks).toHaveProperty("sessionEnd");
    expect(hooks.hooks).not.toHaveProperty("afterShellExecution");
    expect(hooks.hooks).not.toHaveProperty("afterMCPExecution");
    expect(hooks.hooks.stop[0].command).toBe(
      'node "${CURSOR_PLUGIN_ROOT}/hooks/forward-local-hook.mjs" stop',
    );
    expect(hooks.hooks.sessionEnd[0].command).toBe(
      'node "${CURSOR_PLUGIN_ROOT}/hooks/forward-local-hook.mjs" sessionEnd',
    );
    expect(serializedPlugin).toContain("http://127.0.0.1:8765/hook");
    expect(hookImplementation).toContain("x-notjustyou-receiver-token");
    expect(hookImplementation).not.toContain("NOTJUSTYOU_HOOK_DRY_RUN");
    expect(hookImplementation).not.toContain("submit_signal");
    expect(hookImplementation).not.toContain("/api/signals");
    expect(hookImplementation).not.toContain("collectorToken");
  });

  it("creates raw Cursor stop/sessionEnd envelopes for the local adapter", async () => {
    const { toRawCursorHookEnvelope } = await importHookModule();
    const forwarded = toRawCursorHookEnvelope({
      status: "error",
      cursor_version: "1.7.2",
      user_email: "alice@example.com",
      workspace_roots: ["/Users/alice/private-project"],
      transcript_path: "/Users/alice/.cursor/transcript.json",
      prompt: "do not collect this prompt",
      output: "do not collect this output",
    }, "stop");

    expect(forwarded).toMatchObject({
      rawHook: "cursor",
      payload: {
        hook_event_name: "stop",
        status: "error",
      },
    });
    expect(JSON.stringify(forwarded)).not.toContain("alice@example.com");
    expect(JSON.stringify(forwarded)).not.toContain("/Users/alice");
    expect(JSON.stringify(forwarded)).not.toContain("do not collect");
    expect(previewPayload(forwarded)).toEqual({
      ok: true,
      kind: "hook",
      payload: {
        serviceId: "cursor-ide",
        source: "cli_hook",
        symptom: "error",
        errorCode: "cursor_agent_error",
        clientVersion: "1.7.2",
      },
    });
  });

  it("checks local cursor-ide opt-in config before hook forwarding can read raw input", async () => {
    const { isCursorReportingConfigured } = await importHookModule();
    const configPath = join(createTempDir("njy-cursor-plugin-"), "config.json");

    expect(
      isCursorReportingConfigured({
        NOTJUSTYOU_CONFIG_PATH: configPath,
      }),
    ).toBe(false);

    writeFileSync(
      configPath,
      JSON.stringify({
        configVersion: 1,
        baseUrl: "https://notjustyou.dev",
        collectorId: "col_test",
        collectorToken: "njy_secret",
        source: "cli_hook",
        serviceIds: ["cursor-ide"],
        clientName: "notjustyou-cli",
        clientVersion: "0.3.6",
        localHookSignalOptIn: true,
        localReceiverToken: "receiver-secret-token",
      }),
    );

    expect(
      isCursorReportingConfigured({
        NOTJUSTYOU_CONFIG_PATH: configPath,
      }),
    ).toBe(true);
  });

  it("ignores raw Cursor events that are outside the failure-only adapter scope", async () => {
    const { toRawCursorHookEnvelope } = await importHookModule();

    expect(
      toRawCursorHookEnvelope(
        {
          command: "npm test",
          output: "raw shell output",
        },
        "afterShellExecution",
      ),
    ).toBeNull();
  });

  it("does not print raw hook payloads when receiver forwarding is unavailable", () => {
    const configPath = join(
      createTempDir("njy-cursor-plugin-missing-"),
      "config.json",
    );
    const result = runHookScript("hooks/forward-local-hook.mjs", {
      status: "error",
      user_email: "alice@example.com",
      prompt: "do not collect",
    }, "stop", configPath);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("limits the status skill to Not Just You read-only MCP tools", () => {
    const skill = readFileSync(join(pluginRoot, "skills/status/SKILL.md"), "utf8");

    expect(skill).toContain("name: status");
    expect(skill).toContain("mcp__plugin_notjustyou_status__list_surfaces");
    expect(skill).toContain(
      "mcp__plugin_notjustyou_status__get_surface_status",
    );
    expect(skill).toContain(
      "mcp__plugin_notjustyou_status__get_recent_signals",
    );
    expect(skill).toContain(
      "mcp__plugin_notjustyou_status__explain_privacy",
    );
    expect(skill).toContain(
      "disallowed-tools: Read Grep Glob Bash Edit Write MultiEdit NotebookRead NotebookEdit WebFetch WebSearch",
    );
    expect(skill).toContain("This status skill must not submit signals");
    expect(skill).toContain("optional Cursor hooks");
    expect(skill).toContain("setup-reporting");
  });

  it("includes a confirmation-gated reporting setup skill", () => {
    const skill = readFileSync(
      join(pluginRoot, "skills/setup-reporting/SKILL.md"),
      "utf8",
    );

    expect(skill).toContain(
      "disallowed-tools: Bash Read Grep Glob Edit Write MultiEdit NotebookRead NotebookEdit WebFetch WebSearch",
    );
    expect(skill).toContain("Ask for explicit confirmation before enabling or disabling reporting");
    expect(skill).toContain("allowed-tools: mcp__plugin_notjustyou_status__get_reporting_setup_state mcp__plugin_notjustyou_status__enable_reporting mcp__plugin_notjustyou_status__disable_reporting");
    expect(skill).toContain("mcp__plugin_notjustyou_status__enable_reporting");
    expect(skill).toContain("mcp__plugin_notjustyou_status__disable_reporting");
    expect(skill).toContain('surface: "cursor"');
    expect(skill).toContain("confirmed: true");
    expect(skill).toContain("npx -y @notjustyou/cli@0.3.7 enable cursor");
    expect(skill).toContain("npx -y @notjustyou/cli@0.3.7 disable cursor");
    expect(skill).toContain("Never reveal `collectorToken`");
    expect(skill).toContain("raw config JSON");
    expect(skill).toContain("Do not suggest `cat`, `jq`, `less`, `grep`, `sed`, `open`");
    expect(skill).toContain("If the user confirms disabling reporting");
    expect(skill).toContain("metadata-only Cursor");
    expect(skill).toContain("Do not use Bash, setup, register, hook receiver");
  });

  it("includes a reporting setup command for discoverability", () => {
    const command = readFileSync(
      join(pluginRoot, "commands/setup-reporting.md"),
      "utf8",
    );
    const packageJson = JSON.parse(readFileSync(join(pluginRoot, "package.json"), "utf8"));

    expect(packageJson.files).toContain("commands");
    expect(command).toContain("name: setup-reporting");
    expect(command).toContain("Ask for explicit confirmation before enabling or disabling reporting");
    expect(command).toContain("mcp__plugin_notjustyou_status__enable_reporting");
    expect(command).toContain("mcp__plugin_notjustyou_status__disable_reporting");
    expect(command).toContain("npx -y @notjustyou/cli@0.3.7 enable cursor");
    expect(command).toContain("Never reveal `collectorToken`");
    expect(command).toContain("raw config JSON");
    expect(command).toContain("Do not run shell commands from this command file.");
  });

  it("publishes the plugin through the Not Just You Cursor marketplace catalog", () => {
    const marketplace = JSON.parse(
      readFileSync(join(marketplaceRoot, "marketplace.json"), "utf8"),
    );
    const packageJson = JSON.parse(readFileSync(join(pluginRoot, "package.json"), "utf8"));

    expect(marketplace).toMatchObject({
      name: "notjustyou",
      plugins: [
        {
          name: "notjustyou",
          source: "packages/notjustyou-cursor-plugin",
          version: "0.1.5",
          category: "Developer Tools",
        },
      ],
    });
    expect(marketplace.plugins[0].name).toBe(readJson(".cursor-plugin/plugin.json").name);
    expect(packageJson.private).not.toBe(true);
    expect(packageJson.publishConfig).toEqual({
      access: "public",
    });
  });

  it("distinguishes Cursor Marketplace availability from this plugin's listing state", () => {
    const readme = readFileSync(join(pluginRoot, "README.md"), "utf8");

    expect(readme).toContain("Not Just You is not yet listed on the Cursor Marketplace");
    expect(readme).toContain("listings require Cursor review");
    expect(readme).not.toContain("marketplace distribution is not available yet");
  });
});

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(join(pluginRoot, relativePath), "utf8"));
}

function runHookScript(
  relativePath: string,
  input: unknown,
  hookEventName: string,
  configPath: string,
) {
  return spawnSync("node", [join(pluginRoot, relativePath), hookEventName], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env: {
      ...process.env,
      NOTJUSTYOU_CONFIG_PATH: configPath,
      NOTJUSTYOU_HOOK_RECEIVER_URL: "http://127.0.0.1:9/hook",
    },
  });
}

async function importHookModule() {
  return import(
    `${pathToFileURL(join(pluginRoot, "hooks/forward-local-hook.mjs")).href}?t=${Date.now()}`
  ) as Promise<{
    toRawCursorHookEnvelope: (
      input: unknown,
      hookEventName?: string,
    ) => unknown;
    isLocalReceiverUrl: (value: string) => boolean;
    isCursorReportingConfigured: (env?: Record<string, string>) => boolean;
  }>;
}
