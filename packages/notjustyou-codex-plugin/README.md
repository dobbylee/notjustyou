# Not Just You Status Codex Plugin

Status-only plugin for Codex CLI, IDE extension, and app surfaces.

## What It Provides

- A `$notjustyou:status` skill for AI service status checks.
- A bundled read-only Not Just You MCP server configuration.
- Public status lookups for community reports, installed-client signal aggregates, and official status summaries.

## Install

Add the Not Just You marketplace, then install the plugin:

```bash
codex plugin marketplace add dobbylee/notjustyou
codex plugin add notjustyou@notjustyou
```

Start a new Codex thread, then ask for a status check or invoke:

```text
$notjustyou:status openai-api
```

## Local Test

From a workspace checkout:

```bash
codex plugin marketplace add /path/to/notjustyou
codex plugin add notjustyou@notjustyou
```

Start a new Codex thread, then invoke:

```text
$notjustyou:status openai-api
```

## Privacy Boundary

This plugin is status-only. It reads public aggregate status APIs through `@notjustyou/mcp` and does not send signals or require collector credentials.

It does not collect prompt text, request or response bodies, headers, API keys, cookies, source files, diffs, clipboard content, exact IP addresses, account emails, machine names, or local usernames.

Hook-based signal collection is intentionally not included in this plugin release.
