import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pluginRoot = join(process.cwd(), "packages/notjustyou-codex-plugin");
const marketplaceRoot = join(process.cwd(), ".agents/plugins");

describe("Codex status plugin", () => {
  it("declares a status-only Codex plugin manifest", () => {
    const manifest = readJson(".codex-plugin/plugin.json");

    expect(manifest).toMatchObject({
      name: "notjustyou",
      description:
        "Adds a read-only Not Just You status skill and MCP status tools for Codex surfaces.",
      version: "0.1.1",
      license: "MIT",
      skills: "./skills/",
      mcpServers: "./.mcp.json",
      interface: {
        displayName: "Not Just You",
        shortDescription: "Read-only AI service status for Codex.",
        developerName: "Not Just You",
        category: "Developer Tools",
      },
    });
    expect(manifest.name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(manifest.interface.defaultPrompt).toHaveLength(1);
  });

  it("bundles the published read-only MCP server", () => {
    const mcpConfig = readJson(".mcp.json");

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

  it("keeps Codex free of hooks and signal submission paths until a safe classifier exists", () => {
    const rootEntries = readdirSync(pluginRoot);
    const serializedPlugin = [
      readFileSync(join(pluginRoot, ".codex-plugin/plugin.json"), "utf8"),
      readFileSync(join(pluginRoot, ".mcp.json"), "utf8"),
      readFileSync(join(pluginRoot, "skills/status/SKILL.md"), "utf8"),
      readFileSync(join(pluginRoot, "README.md"), "utf8"),
    ].join("\n");

    expect(rootEntries).not.toContain("hooks");
    expect(serializedPlugin).not.toContain("submit_signal");
    expect(serializedPlugin).not.toContain("/api/signals");
    expect(serializedPlugin).not.toContain("collectorToken");
  });

  it("documents only Codex surfaces that support plugins", () => {
    const readme = readFileSync(join(pluginRoot, "README.md"), "utf8");

    expect(readme).toContain("Codex CLI and ChatGPT desktop app surfaces");
    expect(readme).not.toContain("IDE extension");
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
    expect(skill).toContain("This status-only plugin must not submit signals");
  });

  it("publishes the plugin through the Not Just You Codex marketplace catalog", () => {
    const marketplace = JSON.parse(
      readFileSync(join(marketplaceRoot, "marketplace.json"), "utf8"),
    );
    const packageJson = JSON.parse(readFileSync(join(pluginRoot, "package.json"), "utf8"));

    expect(marketplace).toMatchObject({
      name: "notjustyou",
      interface: {
        displayName: "Not Just You",
      },
      plugins: [
        {
          name: "notjustyou",
          source: {
            source: "local",
            path: "./packages/notjustyou-codex-plugin",
          },
          policy: {
            installation: "AVAILABLE",
            authentication: "ON_INSTALL",
          },
          category: "Developer Tools",
        },
      ],
    });
    expect(marketplace.plugins[0].name).toBe(readJson(".codex-plugin/plugin.json").name);
    expect(packageJson.private).not.toBe(true);
    expect(packageJson.publishConfig).toEqual({
      access: "public",
    });
  });
});

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(join(pluginRoot, relativePath), "utf8"));
}
