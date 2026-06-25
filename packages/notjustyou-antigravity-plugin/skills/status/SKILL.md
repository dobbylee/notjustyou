---
name: status
description: Check Not Just You public AI service status for OpenAI, Anthropic Claude, Google Gemini, Cursor, Antigravity, and related coding surfaces.
---

# Not Just You Status

Use the bundled Not Just You MCP tools to answer status questions from public aggregate sources only.

When the user names a specific service id, call `get_surface_status` for that `serviceId`.

When the user names a provider or asks what is affected, call `list_surfaces` and filter by provider when useful.

When the user asks about recent installed-client reports for one surface, call `get_recent_signals`.

When the user asks what the status skill reads or sends, call `explain_privacy`.

Keep manual community reports, installed-client signals, and official status separate in the answer. Do not infer a vendor-wide outage from one source alone.

If the user asks about Antigravity reporting, explain that this plugin is status-only. Antigravity hook reporting is deferred until a local allowlist adapter can turn raw hook input into coarse service-level metadata without storing, logging, queuing, or sending raw hook payloads.

This status skill must not submit signals, register collectors, read prompts, inspect files, inspect diffs, read headers, read API keys, read transcript files, or collect account, machine, workspace, file path, or user identifiers.
