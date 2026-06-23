# Not Just You Status Claude Code Plugin

Status-only plugin for Claude Code, including the Claude Code CLI and the
Code tab in the Claude Desktop app.

## What It Provides

- A `/notjustyou:status` skill for AI service status checks.
- A bundled read-only Not Just You MCP server configuration.
- Public status lookups for community reports, installed-client signal aggregates, and official status summaries.

## Install

After the marketplace and npm package are published:

```text
/plugin marketplace add dobbylee/notjustyou
/plugin install notjustyou@notjustyou
/reload-plugins
```

Then run:

```text
/notjustyou:status openai-api
```

In the Claude Desktop app, use the Code tab's plugin manager to add the
marketplace, install the plugin, and enable it. This plugin is for Claude Code
surfaces, not the general Claude chat tab.

## Local Test

```bash
claude --plugin-dir ./packages/notjustyou-claude-code-plugin
```

Then run:

```text
/notjustyou:status openai-api
```

## Privacy Boundary

This plugin is status-only. It reads public aggregate status APIs through `@notjustyou/mcp` and does not send signals or require collector credentials.

It does not collect prompt text, request or response bodies, headers, API keys, cookies, source files, diffs, clipboard content, exact IP addresses, account emails, machine names, or local usernames.

Hook-based signal collection is intentionally not included in this plugin release.
