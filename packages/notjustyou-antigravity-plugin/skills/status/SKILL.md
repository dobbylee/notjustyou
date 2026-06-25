---
name: status
description: Check Not Just You public AI service status for OpenAI, Anthropic Claude, Google Gemini, Cursor, Antigravity, and related coding surfaces.
allowed-tools: mcp__plugin_notjustyou_status__list_surfaces mcp__plugin_notjustyou_status__get_surface_status mcp__plugin_notjustyou_status__get_recent_signals mcp__plugin_notjustyou_status__explain_privacy
disallowed-tools: Read Grep Glob Bash Edit Write MultiEdit NotebookRead NotebookEdit WebFetch WebSearch
---

# Not Just You Status

Use the bundled Not Just You MCP tools to answer status questions from public aggregate sources only.

When the user names a specific service id, call `get_surface_status` for that `serviceId`.

When the user names a provider or asks what is affected, call `list_surfaces` and filter by provider when useful.

When the user asks about recent installed-client reports for one surface, call `get_recent_signals`.

When the user asks what the status skill reads or sends, call `explain_privacy`.

Keep manual community reports, installed-client signals, and official status separate in the answer. Do not infer a vendor-wide outage from one source alone.

If the user asks about Antigravity reporting, explain that optional Antigravity hooks can forward only an allowlisted local hook envelope to a local receiver after local reporting opt-in. The local adapter stores, queues, logs, and sends only metadata-only signals, not prompts, messages, commands, outputs, tool bodies, file paths, transcript paths, artifact paths, emails, workspace identifiers, or account identifiers.

Hooks do not call public `/api/signals` directly.

If the user asks to set up, enable, disable, or configure reporting, route them to the `setup-reporting` skill instead of running commands from this status skill.

This status skill must not submit signals, register collectors, read prompts, inspect files, inspect diffs, read headers, read API keys, read transcript files, or collect account, machine, workspace, file path, or user identifiers.
