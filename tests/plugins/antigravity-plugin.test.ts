import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { previewPayload } from "@/packages/notjustyou-cli/src/privacy";

const pluginRoot = join(process.cwd(), "packages/notjustyou-antigravity-plugin");

describe("Antigravity plugin", () => {
  it("declares an Antigravity plugin manifest", () => {
    const manifest = readJson("plugin.json");

    expect(manifest).toMatchObject({
      name: "notjustyou",
      description:
        "Not Just You AI service status lookup and opt-in local hook reporting for Antigravity.",
    });
    expect(manifest.name).toMatch(/^[a-zA-Z0-9-_]+$/);
  });

  it("bundles the setup-capable MCP server", () => {
    const mcpConfig = readJson("mcp_config.json");

    expect(mcpConfig).toEqual({
      mcpServers: {
        status: {
          command: "npx",
          args: ["-y", "@notjustyou/mcp@0.2.5"],
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
      readFileSync(join(pluginRoot, "hooks.json"), "utf8"),
      readFileSync(join(pluginRoot, "hooks/forward-local-hook.mjs"), "utf8"),
    ].join("\n");
    const serializedPlugin = [
      readFileSync(join(pluginRoot, "plugin.json"), "utf8"),
      readFileSync(join(pluginRoot, "mcp_config.json"), "utf8"),
      hookImplementation,
      readFileSync(join(pluginRoot, "skills/status/SKILL.md"), "utf8"),
      readFileSync(join(pluginRoot, "skills/setup-reporting/SKILL.md"), "utf8"),
      readFileSync(join(pluginRoot, "README.md"), "utf8"),
    ].join("\n");
    const hooks = readJson("hooks.json");

    expect(rootEntries).toContain("hooks.json");
    expect(rootEntries).toContain("hooks");
    expect(hooks).toHaveProperty("notjustyou-antigravity-reporting");
    expect(hooks["notjustyou-antigravity-reporting"]).toHaveProperty("Stop");
    expect(hooks["notjustyou-antigravity-reporting"].Stop[0].command).toBe(
      "node ./hooks/forward-local-hook.mjs Stop",
    );
    expect(serializedPlugin).toContain("http://127.0.0.1:8765/hook");
    expect(hookImplementation).not.toContain("submit_signal");
    expect(hookImplementation).not.toContain("/api/signals");
    expect(hookImplementation).not.toContain("collectorToken");
  });

  it("creates raw Antigravity stop envelopes for the local adapter", async () => {
    const { toRawAntigravityHookEnvelope } = await importHookModule();
    const forwarded = toRawAntigravityHookEnvelope(
      {
        terminationReason: "error",
        error: "raw error for alice@example.com",
        fullyIdle: true,
        conversationId: "ec33ebf9-0cba-4100-8142-c61503f6c587",
        workspacePaths: ["/Users/alice/private-project"],
        transcriptPath: "/Users/alice/.gemini/antigravity-cli/transcript.jsonl",
        artifactDirectoryPath: "/Users/alice/.gemini/antigravity-cli/artifacts",
      },
      "Stop",
      "google-antigravity-cli",
    );

    expect(forwarded).toMatchObject({
      rawHook: "antigravity",
      payload: {
        hook_event_name: "Stop",
        service_id: "google-antigravity-cli",
        termination_reason: "error",
        has_error: true,
        fully_idle: true,
      },
    });
    expect(JSON.stringify(forwarded)).not.toContain("alice@example.com");
    expect(JSON.stringify(forwarded)).not.toContain("/Users/alice");
    expect(JSON.stringify(forwarded)).not.toContain("raw error");
    expect(previewPayload(forwarded)).toEqual({
      ok: true,
      kind: "hook",
      payload: {
        serviceId: "google-antigravity-cli",
        source: "cli_hook",
        symptom: "error",
        errorCode: "antigravity_agent_error",
      },
    });
  });

  it("does not create local envelopes for non-error or non-idle Antigravity stops", async () => {
    const { toRawAntigravityHookEnvelope } = await importHookModule();

    expect(toRawAntigravityHookEnvelope(
      {
        terminationReason: "model_stop",
        fullyIdle: true,
      },
      "Stop",
      "google-antigravity-cli",
    )).toBeNull();

    expect(toRawAntigravityHookEnvelope(
      {
        terminationReason: "error",
        fullyIdle: false,
      },
      "Stop",
      "google-antigravity-cli",
    )).toBeNull();

    expect(toRawAntigravityHookEnvelope(
      {
        terminationReason: "error",
        fullyIdle: "true",
      },
      "Stop",
      "google-antigravity-cli",
    )).toBeNull();

    expect(toRawAntigravityHookEnvelope(
      {
        terminationReason: "error",
        fullyIdle: true,
        toolCall: {
          args: {
            command: "do not forward",
          },
        },
      },
      "PreToolUse",
      "google-antigravity-cli",
    )).toBeNull();
  });

  it("checks local Antigravity opt-in config before hook forwarding can read raw input", async () => {
    const { getConfiguredAntigravityServiceId } = await importHookModule();
    const configPath = join(
      mkdtempSync(join(tmpdir(), "njy-antigravity-plugin-")),
      "config.json",
    );

    expect(
      getConfiguredAntigravityServiceId({
        NOTJUSTYOU_CONFIG_PATH: configPath,
      }),
    ).toBeNull();

    writeFileSync(
      configPath,
      JSON.stringify({
        configVersion: 1,
        baseUrl: "https://notjustyou.dev",
        collectorId: "col_test",
        collectorToken: "njy_secret",
        source: "cli_hook",
        serviceIds: ["google-antigravity-cli"],
        clientName: "notjustyou-cli",
        clientVersion: "0.3.5",
        localHookSignalOptIn: true,
      }),
    );

    expect(
      getConfiguredAntigravityServiceId({
        NOTJUSTYOU_CONFIG_PATH: configPath,
      }),
    ).toBe("google-antigravity-cli");
  });

  it("does not choose an Antigravity service when multiple Antigravity surfaces are configured", async () => {
    const { getConfiguredAntigravityServiceId } = await importHookModule();
    const configPath = join(
      mkdtempSync(join(tmpdir(), "njy-antigravity-plugin-ambiguous-")),
      "config.json",
    );

    writeFileSync(
      configPath,
      JSON.stringify({
        configVersion: 1,
        baseUrl: "https://notjustyou.dev",
        collectorId: "col_test",
        collectorToken: "njy_secret",
        source: "cli_hook",
        serviceIds: ["google-antigravity-cli", "google-antigravity-ide"],
        clientName: "notjustyou-cli",
        clientVersion: "0.3.5",
        localHookSignalOptIn: true,
      }),
    );

    expect(
      getConfiguredAntigravityServiceId({
        NOTJUSTYOU_CONFIG_PATH: configPath,
      }),
    ).toBeNull();
  });

  it("does not print raw hook payloads when receiver forwarding is unavailable", () => {
    const configPath = join(
      mkdtempSync(join(tmpdir(), "njy-antigravity-plugin-missing-")),
      "config.json",
    );
    writeFileSync(
      configPath,
      JSON.stringify({
        configVersion: 1,
        baseUrl: "https://notjustyou.dev",
        collectorId: "col_test",
        collectorToken: "njy_secret",
        source: "cli_hook",
        serviceIds: ["google-antigravity-cli"],
        clientName: "notjustyou-cli",
        clientVersion: "0.3.5",
        localHookSignalOptIn: true,
      }),
    );

    const result = runHookScript("hooks/forward-local-hook.mjs", {
      terminationReason: "error",
      error: "raw error for alice@example.com",
      fullyIdle: true,
      workspacePaths: ["/Users/alice/private-project"],
      transcriptPath: "/Users/alice/.gemini/antigravity-cli/transcript.jsonl",
    }, "Stop", configPath);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(JSON.stringify({ decision: "" }));
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain("alice@example.com");
    expect(result.stdout).not.toContain("/Users/alice");
    expect(result.stdout).not.toContain("raw error");
  });

  it("does not read or print hook input when local Antigravity opt-in is missing", () => {
    const configPath = join(
      mkdtempSync(join(tmpdir(), "njy-antigravity-plugin-disabled-")),
      "config.json",
    );
    writeFileSync(
      configPath,
      JSON.stringify({
        configVersion: 1,
        baseUrl: "https://notjustyou.dev",
        collectorId: "col_test",
        collectorToken: "njy_secret",
        source: "cli_hook",
        serviceIds: ["google-antigravity-cli"],
        clientName: "notjustyou-cli",
        clientVersion: "0.3.5",
        localHookSignalOptIn: false,
      }),
    );

    const result = runHookScript("hooks/forward-local-hook.mjs", {
      terminationReason: "error",
      error: "raw error for alice@example.com",
      fullyIdle: true,
      workspacePaths: ["/Users/alice/private-project"],
      transcriptPath: "/Users/alice/.gemini/antigravity-cli/transcript.jsonl",
    }, "Stop", configPath);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(JSON.stringify({ decision: "" }));
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain("alice@example.com");
    expect(result.stdout).not.toContain("/Users/alice");
    expect(result.stdout).not.toContain("raw error");
  });

  it("limits the status skill to Not Just You read-only MCP tools", () => {
    const skill = readFileSync(join(pluginRoot, "skills/status/SKILL.md"), "utf8");

    expect(skill).toContain("name: status");
    expect(skill).toContain("mcp__plugin_notjustyou_status__list_surfaces");
    expect(skill).toContain("mcp__plugin_notjustyou_status__get_surface_status");
    expect(skill).toContain("mcp__plugin_notjustyou_status__get_recent_signals");
    expect(skill).toContain("mcp__plugin_notjustyou_status__explain_privacy");
    expect(skill).toContain("This status skill must not submit signals");
    expect(skill).toContain("setup-reporting");
  });

  it("includes a confirmation-gated reporting setup skill", () => {
    const skill = readFileSync(
      join(pluginRoot, "skills/setup-reporting/SKILL.md"),
      "utf8",
    );

    expect(skill).toContain("Ask for explicit confirmation before enabling or disabling reporting");
    expect(skill).toContain("allowed-tools: mcp__plugin_notjustyou_status__get_reporting_setup_state mcp__plugin_notjustyou_status__enable_reporting mcp__plugin_notjustyou_status__disable_reporting");
    expect(skill).toContain("mcp__plugin_notjustyou_status__enable_reporting");
    expect(skill).toContain("mcp__plugin_notjustyou_status__disable_reporting");
    expect(skill).toContain("antigravity-cli");
    expect(skill).toContain("antigravity-ide");
    expect(skill).toContain("confirmed: true");
    expect(skill).toContain("npx -y @notjustyou/cli@0.3.5 enable antigravity-cli --quiet");
    expect(skill).toContain("Do not use Bash, setup, register, hook receiver");
  });

  it("publishes hooks and setup skill in the package contents", () => {
    const packageJson = readJson("package.json");

    expect(packageJson.files).toContain("hooks");
    expect(packageJson.files).toContain("skills");
    expect(packageJson.private).not.toBe(true);
    expect(packageJson.publishConfig).toEqual({
      access: "public",
    });
  });

  it("documents published package installation for Antigravity", () => {
    const readme = readFileSync(join(pluginRoot, "README.md"), "utf8");

    expect(readme).toContain("npm pack @notjustyou/antigravity-plugin@0.2.3");
    expect(readme).toContain("agy plugin install");
    expect(readme).toContain("Do not use `npm install -g`");
    expect(readme).toContain("preserving other already-enabled Claude Code or Cursor reporting surfaces");
    expect(readme).toContain("Within the Antigravity family, choose one active surface at a time");
    expect(readme).toContain("njy enable antigravity-cli --quiet");
  });

  it("forbids local config and collector credential disclosure in skills", () => {
    const statusSkill = readFileSync(join(pluginRoot, "skills/status/SKILL.md"), "utf8");
    const setupSkill = readFileSync(
      join(pluginRoot, "skills/setup-reporting/SKILL.md"),
      "utf8",
    );
    const skills = `${statusSkill}\n${setupSkill}`;

    expect(skills).toContain("Never read, print, quote, summarize, or display");
    expect(skills).toContain("Never reveal `collectorToken`");
    expect(skills).toContain("raw config JSON");
    expect(setupSkill).toContain("mcp__plugin_notjustyou_status__get_reporting_setup_state");
    expect(setupSkill).toContain("Do not suggest `cat`, `jq`, `less`, `grep`, `sed`, `open`");
    expect(setupSkill).not.toContain("enable antigravity-cli\n");
  });
});

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(join(pluginRoot, relativePath), "utf8"));
}

async function importHookModule() {
  return import(pathToFileURL(join(pluginRoot, "hooks/forward-local-hook.mjs")).href);
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
