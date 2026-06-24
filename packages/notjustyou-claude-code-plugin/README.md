# Not Just You Claude Code Plugin

Plugin for Claude Code, including the Claude Code CLI and the Code tab in the
Claude Desktop app.

## What It Provides

- A `/notjustyou:status` skill for AI service status checks.
- A bundled read-only Not Just You MCP server configuration.
- Public status lookups for community reports, installed-client signal aggregates, and official status summaries.
- Opt-in metadata-only local hook reporting for Claude Code failure events.

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

## Optional Local Hook Reporting

During plugin setup, enable anonymous Claude Code failure reporting only if you
want metadata-only failure events to contribute to Not Just You. When enabled,
the plugin starts the local reporting setup path automatically on session start.

```bash
njy enable claude-code
```

That command registers an anonymous `cli_hook` collector, saves the token only
in the local Not Just You config file, and starts the localhost receiver in
send mode. To turn reporting off:

```bash
njy disable claude-code
```

The plugin hook forwards only normalized metadata to the localhost receiver. It
does not call public `/api/signals` directly, and install-only status lookup does
not enable reporting.

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

The status skill reads public aggregate status APIs through `@notjustyou/mcp`
and does not send signals or require collector credentials.

It does not collect prompt text, request or response bodies, headers, API keys, cookies, source files, diffs, clipboard content, exact IP addresses, account emails, machine names, or local usernames.

Optional hook reporting sends only metadata-only failure signals through the
local Not Just You receiver when local hook opt-in is enabled.
