---
name: setup-reporting
description: Enable or disable Not Just You metadata-only Cursor failure reporting through the bundled MCP setup tools.
---

# Set Up Not Just You Reporting

Use this command when the user asks to enable, configure, set up, disable, or turn off Not Just You reporting for Cursor.

First explain:

- Reporting is optional and off until the user opts in.
- It sends anonymous metadata-only Cursor `stop` and `sessionEnd` error signals through the local Not Just You receiver.
- Cursor hook events are reduced to an allowlisted local envelope only after `cursor-ide` hook reporting opt-in exists.
- It does not send prompts, commands, outputs, tool input or result bodies, file paths, file contents, headers, API keys, cookies, account emails, machine names, or local usernames.
- It is best-effort installed-client reporting, not guaranteed outage detection.

Ask for explicit confirmation before enabling or disabling reporting.

If the user confirms enablement, call:

`mcp__plugin_notjustyou_status__enable_reporting` with `surface: "cursor"` and
`confirmed: true`.

If the user confirms disabling reporting, call:

`mcp__plugin_notjustyou_status__disable_reporting` with `surface: "cursor"` and
`confirmed: true`.

If the setup MCP tools are unavailable, show the fallback commands:

```bash
npx -y @notjustyou/cli@0.3.0 enable cursor
npx -y @notjustyou/cli@0.3.0 disable cursor
```

Do not run shell commands from this command file.
