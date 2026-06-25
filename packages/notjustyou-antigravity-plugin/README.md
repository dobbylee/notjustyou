# Not Just You Antigravity Plugin

Status-only plugin for Antigravity CLI, Antigravity, and Antigravity IDE.

## What It Provides

- A Not Just You status skill for AI service status checks.
- A bundled read-only Not Just You MCP server configuration.
- Public status lookups for community reports, installed-client signal aggregates, and official status summaries.

## Install

From a workspace checkout:

```bash
agy plugin install /path/to/notjustyou/packages/notjustyou-antigravity-plugin
```

Then start Antigravity CLI or open the Antigravity desktop app and ask a status
question:

```text
Is Antigravity CLI down?
```

You can also ask about a specific Not Just You service id:

```text
Check Not Just You status for google-antigravity-cli.
```

## Manual Plugin Locations

Antigravity can also discover manually placed plugins.

Workspace level:

```text
.agents/plugins/notjustyou/
```

Global Antigravity 2.0 or IDE level:

```text
~/.gemini/config/plugins/notjustyou/
```

Antigravity CLI stages installed plugins under:

```text
~/.gemini/antigravity-cli/plugins/notjustyou/
```

## Privacy Boundary

This plugin is status-only. It uses the read-only `@notjustyou/mcp@0.1.0`
status tools and does not send signals or require collector credentials.

It does not collect prompt text, request or response bodies, headers, API keys,
cookies, source files, diffs, clipboard content, transcript files, exact IP
addresses, account emails, machine names, workspace paths, file paths, or local
usernames.

Hook-based signal collection is intentionally not included in this plugin
release. Current Antigravity hook input can include conversation ids, workspace
paths, transcript paths, artifact paths, tool arguments, and error strings. A
future Antigravity reporting flow must use explicit opt-in and a local allowlist
adapter that derives coarse metadata without storing, logging, queuing, or
sending raw hook payloads.
