---
name: setup-reporting
description: Set up or disable Not Just You anonymous metadata-only Antigravity failure reporting through bundled MCP setup tools after explicit user confirmation.
argument-hint: "enable | disable"
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

Ask which Antigravity surface the user wants to enable:

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

If the setup MCP tools are unavailable, tell the user the fallback commands are:

```bash
npx -y @notjustyou/cli@0.3.2 enable antigravity-cli
npx -y @notjustyou/cli@0.3.2 enable antigravity
npx -y @notjustyou/cli@0.3.2 enable antigravity-ide
npx -y @notjustyou/cli@0.3.2 disable antigravity-cli
npx -y @notjustyou/cli@0.3.2 disable antigravity
npx -y @notjustyou/cli@0.3.2 disable antigravity-ide
```

Do not use Bash, setup, register, hook receiver, curl, npm install, file reads, or any other command from this skill.
