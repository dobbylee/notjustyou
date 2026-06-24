import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { previewPayload } from "@/packages/notjustyou-cli/src/privacy";

const pluginRoot = join(process.cwd(), "packages/notjustyou-claude-code-plugin");
const marketplaceRoot = join(process.cwd(), ".claude-plugin");

describe("Claude Code status plugin", () => {
  it("declares a Claude Code plugin manifest", () => {
    const manifest = readJson(".claude-plugin/plugin.json");

    expect(manifest).toMatchObject({
      name: "notjustyou",
      description:
        "Adds Not Just You status tools and optional local hook reporting for Claude Code surfaces.",
      version: "0.3.2",
      license: "MIT",
      userConfig: {
        enableReporting: {
          type: "boolean",
          default: false,
        },
      },
    });
    expect(manifest.name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("bundles the published status and setup MCP server", () => {
    const mcpConfig = readJson(".mcp.json");

    expect(mcpConfig).toEqual({
      mcpServers: {
        status: {
          command: "npx",
          args: ["-y", "@notjustyou/mcp@0.2.1"],
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
      readFileSync(join(pluginRoot, "hooks/setup-reporting.mjs"), "utf8"),
    ].join("\n");
    const serializedPlugin = [
      readFileSync(join(pluginRoot, ".claude-plugin/plugin.json"), "utf8"),
      readFileSync(join(pluginRoot, ".mcp.json"), "utf8"),
      readFileSync(join(pluginRoot, "commands/setup-reporting.md"), "utf8"),
      hookImplementation,
      readFileSync(join(pluginRoot, "skills/status/SKILL.md"), "utf8"),
      readFileSync(join(pluginRoot, "skills/setup-reporting/SKILL.md"), "utf8"),
      readFileSync(join(pluginRoot, "README.md"), "utf8"),
    ].join("\n");
    const hooks = readJson("hooks/hooks.json");

    expect(rootEntries).toContain("hooks");
    expect(hooks.hooks).toHaveProperty("SessionStart");
    expect(hooks.hooks).toHaveProperty("StopFailure");
    expect(hooks.hooks).not.toHaveProperty("PostToolUseFailure");
    expect(serializedPlugin).toContain("http://127.0.0.1:8765/hook");
    expect(hookImplementation).toContain("${user_config.enableReporting}");
    expect(hookImplementation).toContain("@notjustyou/cli@0.3.1");
    expect(hookImplementation).toContain("enable\", \"claude-code\"");
    expect(hookImplementation).not.toContain("submit_signal");
    expect(hookImplementation).not.toContain("/api/signals");
    expect(hookImplementation).not.toContain("collectorToken");
  });

  it("normalizes Claude Code hook input without forwarding raw sensitive fields", () => {
    const result = runHookScript("hooks/forward-local-hook.mjs", {
      session_id: "abc123",
      transcript_path: "/Users/alice/.claude/projects/transcript.jsonl",
      cwd: "/Users/alice/project",
      hook_event_name: "StopFailure",
      error: "rate_limit",
      error_details: "429 Too Many Requests for alice@example.com",
      last_assistant_message: "API Error: Rate limit reached",
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload).toEqual({
      serviceId: "anthropic-claude-code",
      surface: "claude-code",
      eventName: "StopFailure",
      symptom: "rate_limited",
      errorCode: "claude_rate_limit",
      clientVersion: "0.3.1",
    });
    expect(previewPayload(payload)).toMatchObject({
      ok: true,
      kind: "hook",
    });
    expect(result.stdout).not.toContain("alice@example.com");
    expect(result.stdout).not.toContain("/Users/alice");
    expect(result.stdout).not.toContain("429 Too Many Requests");
  });

  it("limits the status skill to Not Just You read-only MCP tools", () => {
    const skill = readFileSync(join(pluginRoot, "skills/status/SKILL.md"), "utf8");

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
    expect(skill).toContain("optional Claude Code");
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
    expect(skill).toContain("mcp__plugin_notjustyou_status__enable_reporting");
    expect(skill).toContain("mcp__plugin_notjustyou_status__disable_reporting");
    expect(skill).toContain('surface: "claude-code"');
    expect(skill).toContain("confirmed: true");
    expect(skill).toContain("npx -y @notjustyou/cli@0.3.1 enable claude-code");
    expect(skill).toContain("npx -y @notjustyou/cli@0.3.1 disable claude-code");
    expect(skill).toContain("If the user confirms disabling reporting");
    expect(skill).toContain("metadata-only Claude Code failure signals");
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
    expect(command).toContain("npx -y @notjustyou/cli@0.3.1 enable claude-code");
    expect(command).toContain("Do not run shell commands from this command file.");
  });

  it("publishes the plugin through the Not Just You marketplace catalog", () => {
    const marketplace = JSON.parse(
      readFileSync(join(marketplaceRoot, "marketplace.json"), "utf8"),
    );
    const packageJson = JSON.parse(readFileSync(join(pluginRoot, "package.json"), "utf8"));

    expect(marketplace).toMatchObject({
      name: "notjustyou",
      plugins: [
        {
          name: "notjustyou",
            source: {
              source: "npm",
              package: "@notjustyou/claude-code-plugin",
            version: "0.3.2",
          },
        },
      ],
    });
    expect(marketplace.plugins[0].description).toContain(
      "opt-in local hook reporting",
    );
    expect(marketplace.plugins[0].name).toBe(readJson(".claude-plugin/plugin.json").name);
    expect(marketplace.plugins[0].source.package).toBe(packageJson.name);
    expect(marketplace.plugins[0].source.version).toBe(packageJson.version);
    expect(packageJson.private).not.toBe(true);
    expect(packageJson.publishConfig).toEqual({
      access: "public",
    });
  });
});

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(join(pluginRoot, relativePath), "utf8"));
}

function runHookScript(relativePath: string, input: unknown) {
  return spawnSync("node", [join(pluginRoot, relativePath)], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env: {
      ...process.env,
      NOTJUSTYOU_HOOK_DRY_RUN: "1",
    },
  });
}
