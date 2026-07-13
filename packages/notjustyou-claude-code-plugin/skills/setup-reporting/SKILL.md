---
description: Set up or disable Not Just You anonymous metadata-only Claude Code failure reporting through the bundled MCP setup tools after explicit user confirmation.
argument-hint: "enable | disable"
allowed-tools: mcp__plugin_notjustyou_status__get_reporting_setup_state mcp__plugin_notjustyou_status__enable_reporting mcp__plugin_notjustyou_status__disable_reporting
disallowed-tools: Bash Read Grep Glob Edit Write MultiEdit NotebookRead NotebookEdit WebFetch WebSearch
---

# Not Just You Reporting Setup

Use this skill only when the user asks to enable, configure, set up, disable, or turn off Not Just You reporting for Claude Code.

Before enabling reporting, explain that:

- Reporting is optional and off until the user opts in.
- It sends anonymous metadata-only Claude Code failure signals through the local Not Just You receiver.
- It does not send prompts, messages, request or response bodies, headers, API keys, cookies, source files, diffs, clipboard content, exact IP addresses, account emails, machine names, or local usernames.
- It is best-effort installed-client reporting, not guaranteed outage detection.

Never read, print, quote, summarize, or display the local Not Just You config
file. Never reveal `collectorToken`, collector token values, `collectorId`, or
raw config JSON in any response. If the user asks to inspect setup state, call
`mcp__plugin_notjustyou_status__get_reporting_setup_state` and summarize only:
configured, enabled, selected surface, source, local hook opt-in state, and
whether other Not Just You hook surfaces are enabled.

Ask for explicit confirmation before enabling or disabling reporting.

If the user confirms enablement, call:

`mcp__plugin_notjustyou_status__enable_reporting` with
`surface: "claude-code"` and `confirmed: true`.

If the user confirms disabling reporting, call:

`mcp__plugin_notjustyou_status__disable_reporting` with
`surface: "claude-code"` and `confirmed: true`.

If the setup MCP tools are unavailable, tell the user the fallback commands are:

```bash
npx -y @notjustyou/cli@0.3.6 enable claude-code --quiet
npx -y @notjustyou/cli@0.3.6 disable claude-code --quiet
```

Do not use Bash, setup, register, hook receiver, curl, npm install, file reads, or any other command from this skill.
Do not suggest `cat`, `jq`, `less`, `grep`, `sed`, `open`, or any command that
prints `~/.config/notjustyou/config.json`.
