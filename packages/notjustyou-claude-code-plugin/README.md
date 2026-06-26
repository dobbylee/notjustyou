# Not Just You Claude Code Plugin

Plugin for Claude Code, including the Claude Code CLI and the Code tab in the
Claude Desktop app.

## What It Provides

- A `/notjustyou:status` skill for AI service status checks.
- A bundled Not Just You MCP server configuration for status lookup and explicit local reporting setup.
- Public status lookups for community reports, installed-client signal aggregates, and official status summaries.
- Opt-in metadata-only local hook reporting for Claude Code failure events.

## Install

Install from Claude Code:

```text
/plugin marketplace add dobbylee/notjustyou
/plugin install notjustyou@notjustyou
```

Then start a new Claude Code session and ask a status question, or invoke the
status skill directly:

```text
Is Claude Code down?
/notjustyou:status anthropic-claude-code
```

## Optional Local Hook Reporting

During plugin setup, enable anonymous Claude Code failure reporting only if you
want metadata-only failure events to contribute to Not Just You. When enabled,
the plugin starts the local reporting setup path automatically on session start.
You can also ask the plugin to set up Not Just You reporting; the
`setup-reporting` skill explains the privacy boundary and asks for confirmation
before calling the bundled setup MCP tool.

```bash
njy enable claude-code --quiet
```

That command registers an anonymous `cli_hook` collector, saves the token only
in the local Not Just You config file, and starts the localhost receiver in
send mode while preserving other already-enabled Not Just You hook reporting
surfaces. To turn Claude Code reporting off:

```bash
njy disable claude-code --quiet
```

The plugin hook forwards only normalized metadata to the localhost receiver. It
does not call public `/api/signals` directly, and install-only status lookup does
not enable reporting.

Reporting is best-effort. It can share Claude Code failures that reach a local
failure hook, but it cannot report cases where Claude Code never starts, the
plugin or hook is not trusted, the local receiver is not configured, or the
user's network cannot reach Not Just You.

In the Claude Desktop app, use the Code tab's plugin manager to add the
marketplace, install the plugin, and enable it. This plugin is for Claude Code
surfaces, not the general Claude chat tab.

## Local Test

```bash
claude --plugin-dir ./packages/notjustyou-claude-code-plugin
```

Then ask a status question, or invoke the status skill directly:

```text
Is Claude Code down?
/notjustyou:status anthropic-claude-code
```

## Privacy Boundary

The status skill reads public aggregate status APIs through `@notjustyou/mcp`.
The setup MCP tools can write local reporting config after explicit
confirmation, but they do not submit signals directly or print collector
tokens or collector ids.

It does not collect prompt text, request or response bodies, headers, API keys, cookies, source files, diffs, clipboard content, exact IP addresses, account emails, machine names, or local usernames.

Optional hook reporting sends only metadata-only failure signals through the
local Not Just You receiver when local hook opt-in is enabled. It is not a
guaranteed outage detector.
