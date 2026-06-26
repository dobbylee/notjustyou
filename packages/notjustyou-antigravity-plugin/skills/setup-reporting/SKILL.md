---
name: setup-reporting
description: Set up or disable Not Just You anonymous metadata-only Antigravity failure reporting through bundled MCP setup tools after explicit user confirmation.
argument-hint: "enable | disable"
allowed-tools: mcp__plugin_notjustyou_status__get_reporting_setup_state mcp__plugin_notjustyou_status__enable_reporting mcp__plugin_notjustyou_status__disable_reporting
disallowed-tools: Bash Read Grep Glob Edit Write MultiEdit NotebookRead NotebookEdit WebFetch WebSearch
---

# Not Just You Reporting Setup

Use this skill only when the user asks to enable, configure, set up, disable, or turn off Not Just You reporting for Antigravity.

Before enabling reporting, explain that:

- Reporting is optional and off until the user opts in.
- It sends anonymous metadata-only Antigravity `Stop` error signals through the local Not Just You receiver.
- Antigravity hook events are reduced to an allowlisted local envelope only after local hook reporting opt-in exists.
- It does not send prompts, messages, command args, shell output, tool input or result bodies, file paths, file contents, transcript paths, artifact paths, headers, API keys, cookies, account emails, machine names, workspace identifiers, or local usernames.
- It is best-effort installed-client reporting, not guaranteed outage detection.

Never read, print, quote, summarize, or display the local Not Just You config
file. Never reveal `collectorToken`, collector token values, `collectorId`, or
raw config JSON in any response. If the user asks to inspect setup state, call
`mcp__plugin_notjustyou_status__get_reporting_setup_state` and summarize only:
configured, enabled, selected surface, source, local hook opt-in state, and
whether other Not Just You hook surfaces are enabled.

Ask which Antigravity surface the user wants to enable or disable for this
request. Do not enable or disable unrequested non-Antigravity surfaces. Enabling
one Antigravity surface replaces any other active Antigravity surface because
the Antigravity hook cannot safely distinguish multiple configured Antigravity
service ids:

- `antigravity-cli` for Antigravity CLI.
- `antigravity` for the Antigravity desktop app.
- `antigravity-ide` for Antigravity IDE.

Ask for explicit confirmation before enabling or disabling reporting.

If the user confirms enablement, call:

`mcp__plugin_notjustyou_status__enable_reporting` with the selected
`surface` and `confirmed: true`.

If the user confirms disabling reporting, call:

`mcp__plugin_notjustyou_status__disable_reporting` with the selected
`surface` and `confirmed: true`.

If the user asks whether reporting is configured or enabled, call:

`mcp__plugin_notjustyou_status__get_reporting_setup_state` with the selected
`surface`.

If the setup MCP tools are unavailable, tell the user the fallback commands are:

```bash
npx -y @notjustyou/cli@0.3.4 enable antigravity-cli --quiet
npx -y @notjustyou/cli@0.3.4 enable antigravity --quiet
npx -y @notjustyou/cli@0.3.4 enable antigravity-ide --quiet
npx -y @notjustyou/cli@0.3.4 disable antigravity-cli --quiet
npx -y @notjustyou/cli@0.3.4 disable antigravity --quiet
npx -y @notjustyou/cli@0.3.4 disable antigravity-ide --quiet
```

Do not use Bash, setup, register, hook receiver, curl, npm install, file reads, or any other command from this skill.
Do not suggest `cat`, `jq`, `less`, `grep`, `sed`, `open`, or any command that
prints `~/.config/notjustyou/config.json`.
