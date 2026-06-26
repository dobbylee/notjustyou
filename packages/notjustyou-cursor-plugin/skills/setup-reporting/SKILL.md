---
description: Set up or disable Not Just You anonymous metadata-only Cursor failure reporting through the bundled MCP setup tools after explicit user confirmation.
argument-hint: "enable | disable"
allowed-tools: mcp__plugin_notjustyou_status__get_reporting_setup_state mcp__plugin_notjustyou_status__enable_reporting mcp__plugin_notjustyou_status__disable_reporting
disallowed-tools: Bash Read Grep Glob Edit Write MultiEdit NotebookRead NotebookEdit WebFetch WebSearch
---

# Not Just You Reporting Setup

Use this skill only when the user asks to enable, configure, set up, disable, or turn off Not Just You reporting for Cursor.

Before enabling reporting, explain that:

- Reporting is optional and off until the user opts in.
- It sends anonymous metadata-only Cursor `stop` and `sessionEnd` error signals through the local Not Just You receiver.
- Cursor hook events are reduced to an allowlisted local envelope only after `cursor-ide` hook reporting opt-in exists.
- It does not send prompts, commands, outputs, tool input or result bodies, file paths, file contents, headers, API keys, cookies, account emails, machine names, or local usernames.
- It is best-effort installed-client reporting, not guaranteed outage detection.

Never read, print, quote, summarize, or display the local Not Just You config
file. Never reveal `collectorToken`, collector token values, `collectorId`, or
raw config JSON in any response. If the user asks to inspect setup state, call
`mcp__plugin_notjustyou_status__get_reporting_setup_state` and summarize only:
configured, enabled, selected surface, source, local hook opt-in state, and
whether other Not Just You hook surfaces are enabled.

Ask for explicit confirmation before enabling or disabling reporting.

If the user confirms enablement, call:

`mcp__plugin_notjustyou_status__enable_reporting` with `surface: "cursor"` and
`confirmed: true`.

If the user confirms disabling reporting, call:

`mcp__plugin_notjustyou_status__disable_reporting` with `surface: "cursor"` and
`confirmed: true`.

If the setup MCP tools are unavailable, tell the user the fallback commands are:

```bash
npx -y @notjustyou/cli@0.3.5 enable cursor --quiet
npx -y @notjustyou/cli@0.3.5 disable cursor --quiet
```

Do not use Bash, setup, register, hook receiver, curl, npm install, file reads, or any other command from this skill.
Do not suggest `cat`, `jq`, `less`, `grep`, `sed`, `open`, or any command that
prints `~/.config/notjustyou/config.json`.
