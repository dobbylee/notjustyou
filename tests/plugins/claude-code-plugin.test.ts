import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pluginRoot = join(process.cwd(), "packages/notjustyou-claude-code-plugin");
const marketplaceRoot = join(process.cwd(), ".claude-plugin");

describe("Claude Code status plugin", () => {
  it("declares a status-only Claude Code plugin manifest", () => {
    const manifest = readJson(".claude-plugin/plugin.json");

    expect(manifest).toMatchObject({
      name: "notjustyou",
      description:
        "Adds a read-only Not Just You status skill and MCP status tools for Claude Code surfaces.",
      version: "0.1.0",
      license: "MIT",
    });
    expect(manifest.name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("bundles the published read-only MCP server", () => {
    const mcpConfig = readJson(".mcp.json");

    expect(mcpConfig).toEqual({
      mcpServers: {
        status: {
          command: "npx",
          args: ["-y", "@notjustyou/mcp@0.1.0"],
          env: {
            NOTJUSTYOU_BASE_URL: "https://notjustyou.dev",
          },
        },
      },
    });
  });

  it("keeps the first release free of hooks and signal submission paths", () => {
    const rootEntries = readdirSync(pluginRoot);
    const serializedPlugin = [
      readFileSync(join(pluginRoot, ".claude-plugin/plugin.json"), "utf8"),
      readFileSync(join(pluginRoot, ".mcp.json"), "utf8"),
      readFileSync(join(pluginRoot, "skills/status/SKILL.md"), "utf8"),
      readFileSync(join(pluginRoot, "README.md"), "utf8"),
    ].join("\n");

    expect(rootEntries).not.toContain("hooks");
    expect(serializedPlugin).not.toContain("submit_signal");
    expect(serializedPlugin).not.toContain("/api/signals");
    expect(serializedPlugin).not.toContain("collectorToken");
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
    expect(skill).toContain("This status-only plugin must not submit signals");
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
            version: "0.1.0",
          },
        },
      ],
    });
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
