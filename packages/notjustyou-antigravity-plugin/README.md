# Not Just You Antigravity Plugin

Plugin for Antigravity CLI, Antigravity, and Antigravity IDE.

## What It Provides

- A Not Just You status skill for AI service status checks.
- A bundled Not Just You MCP server configuration for status lookup and explicit local reporting setup.
- Public status lookups for community reports, installed-client signal aggregates, and official status summaries.
- Optional metadata-only local hook reporting for coarse Antigravity `Stop` error events.

## Install

From a workspace checkout:

```bash
agy plugin install /path/to/notjustyou/packages/notjustyou-antigravity-plugin
```

Then start Antigravity CLI or open the Antigravity desktop app and ask a status
question:

```text
Is Antigravity CLI down?
```

You can also ask about a specific Not Just You service id:

```text
Check Not Just You status for google-antigravity-cli.
```

## Manual Plugin Locations

Antigravity can also discover manually placed plugins.

Workspace level:

```text
.agents/plugins/notjustyou/
```

Global Antigravity 2.0 or IDE level:

```text
~/.gemini/config/plugins/notjustyou/
```

Antigravity CLI stages installed plugins under:

```text
~/.gemini/antigravity-cli/plugins/notjustyou/
```

## Privacy Boundary

Install-only status lookup does not enable reporting. Antigravity hook reporting
is optional and requires explicit setup through the bundled setup MCP tools or
CLI fallback.

It does not collect prompt text, request or response bodies, headers, API keys,
cookies, source files, diffs, clipboard content, transcript files, exact IP
addresses, account emails, machine names, workspace paths, file paths, or local
usernames.

Antigravity hook input can include conversation ids, workspace paths, transcript
paths, artifact paths, tool arguments, and error strings. This plugin checks
local opt-in config before reading hook stdin. After opt-in, the hook script
forwards only an allowlisted local envelope to the localhost Not Just You
receiver:

- `hook_event_name`
- `service_id`
- `termination_reason`
- `has_error`
- `fully_idle`
- `client_version`

Raw Antigravity hook payloads are not stored, logged, queued, or sent to Not
Just You. Public `/api/signals` is reached only through the local receiver after
collector-token, source, service, and opt-in readiness checks pass.

## Reporting Setup

Ask Antigravity to set up Not Just You reporting; the `setup-reporting` skill
explains the privacy boundary and asks for confirmation before enabling or
disabling reporting.

Fallback CLI commands:

```bash
njy enable antigravity-cli
njy enable antigravity
njy enable antigravity-ide
njy disable antigravity-cli
njy disable antigravity
njy disable antigravity-ide
```

Keep the local hook receiver running while you want automatic Antigravity
reports.
