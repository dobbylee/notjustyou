---
name: setup-reporting
description: Enable or disable Not Just You metadata-only Claude Code failure reporting through the bundled MCP setup tools.
---

# Set Up Not Just You Reporting

Use this command when the user asks to enable, configure, set up, disable, or turn off Not Just You reporting for Claude Code.

First explain:

- Reporting is optional and off until the user opts in.
- It sends anonymous metadata-only Claude Code failure signals through the local Not Just You receiver.
- It does not send prompts, messages, request or response bodies, headers, API keys, cookies, source files, diffs, clipboard content, exact IP addresses, account emails, machine names, or local usernames.
- It is best-effort installed-client reporting, not guaranteed outage detection.

Ask for explicit confirmation before enabling or disabling reporting.

If the user confirms enablement, call:

`mcp__plugin_notjustyou_status__enable_reporting` with
`surface: "claude-code"` and `confirmed: true`.

If the user confirms disabling reporting, call:

`mcp__plugin_notjustyou_status__disable_reporting` with
`surface: "claude-code"` and `confirmed: true`.

If the setup MCP tools are unavailable, show the fallback commands:

```bash
npx -y @notjustyou/cli@0.3.1 enable claude-code
npx -y @notjustyou/cli@0.3.1 disable claude-code
```

Do not run shell commands from this command file.
