---
name: status
description: Check Not Just You public AI service status for OpenAI, Anthropic Claude, Google Gemini, Cursor, and related coding surfaces. Use when the user asks if an AI service is down, degraded, rate limited, or showing recent problem signals.
allowed-tools: mcp__plugin_notjustyou_status__list_surfaces mcp__plugin_notjustyou_status__get_surface_status mcp__plugin_notjustyou_status__get_recent_signals mcp__plugin_notjustyou_status__explain_privacy
disallowed-tools: Read Grep Glob Bash Edit Write MultiEdit NotebookRead NotebookEdit WebFetch WebSearch
---

# Not Just You Status

Use the bundled Not Just You MCP tools to answer status questions from public aggregate sources only.

When the user names a specific service id, call `get_surface_status` for that `serviceId`.

When the user names a provider or asks what is affected, call `list_surfaces` and filter by provider when useful.

When the user asks about recent installed-client reports for one surface, call `get_recent_signals`.

When the user asks what the status skill reads or sends, call `explain_privacy`.
Never read, print, quote, summarize, or display the local Not Just You config
file. Never reveal `collectorToken`, collector token values, `collectorId`, or
raw config JSON in any response. Reporting setup state must be checked only by
the setup-reporting skill or bundled setup MCP tools, and answers must be a
summary, not config contents.
If the user asks about hook reporting, explain that optional Cursor hooks can
forward only an allowlisted local hook envelope to a local receiver after local
reporting opt-in. The local adapter derives metadata-only signals without
receiving raw prompts, commands, outputs, file paths, emails, transcript paths,
or tool bodies.
Hooks do not call public `/api/signals` directly.
Describe hook reporting as best-effort installed-client reporting, not
guaranteed outage detection.
If the user asks to set up, enable, disable, or configure reporting, route them
to the `setup-reporting` skill instead of running commands from this status
skill.

Keep manual community reports, installed-client signals, and official status separate in the answer. Do not infer a vendor-wide outage from one source alone.

This status skill must not submit signals, register collectors, read prompts, inspect files, inspect diffs, read headers, read API keys, or collect account, machine, or user identifiers.
