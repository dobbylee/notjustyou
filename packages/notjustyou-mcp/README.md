# @notjustyou/mcp

MCP server for Not Just You AI service status lookup and explicit local
reporting setup.

## Install

```bash
npm install -g @notjustyou/mcp
```

You can also run it from a workspace checkout:

```bash
pnpm --filter @notjustyou/cli build
pnpm --filter @notjustyou/mcp build
NOTJUSTYOU_BASE_URL=http://localhost:3000 node packages/notjustyou-mcp/dist/index.js
```

## MCP Client Configuration

```json
{
  "mcpServers": {
    "notjustyou": {
      "command": "notjustyou-mcp",
      "env": {
        "NOTJUSTYOU_BASE_URL": "https://notjustyou.dev"
      }
    }
  }
}
```

For local development, set `NOTJUSTYOU_BASE_URL` to your local app URL:

```json
{
  "mcpServers": {
    "notjustyou-local": {
      "command": "node",
      "args": ["packages/notjustyou-mcp/dist/index.js"],
      "env": {
        "NOTJUSTYOU_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

## Tools

- `list_surfaces`
- `get_surface_status`
- `get_recent_signals`
- `explain_privacy`
- `get_reporting_setup_state`
- `enable_reporting`
- `disable_reporting`

Status tools are read-only and do not require collector credentials.
The setup tools are local-only write tools: after explicit user confirmation,
they can register a `cli_hook` collector, save the token in the local Not Just
You config file, and start the localhost hook receiver for supported surfaces.
Supported reporting surfaces are `claude-code`, `cursor`,
`antigravity-cli`, `antigravity`, and `antigravity-ide`.

This package does not expose a signal submission tool. Automatic reports still
flow through supported local hooks, the localhost receiver, and the
metadata-only normalizer.

## Request Failures

This installed stdio package gives each request to the public Not Just You APIs
a 10-second deadline covering response headers and body, with no automatic
retry.

`list_surfaces` and `get_surface_status` fetch community, installed-signal, and
official summaries concurrently. They preserve available source data when
another source fails, and report a tool execution error if all three fail.
`get_recent_signals` depends on the installed-signal summary and reports a tool
execution error if that request fails. Timeouts follow these same rules.

Local reporting setup uses the CLI's API request deadline for registration.
The deadline does not limit AI provider calls and is not a session timeout for
the separate public `/mcp` endpoint.

## Privacy Boundary

The MCP server reads public status summaries:

- `/api/summary`
- `/api/signals/summary`
- `/api/official`

The setup tools may write local config and store a collector token locally after
user confirmation. They do not print collector tokens, expose collector ids or
local config paths, or submit signals directly. Setup tool results are scoped to
the requested surface and do not list other enabled hook service ids.

It does not collect prompt text, request or response bodies, headers, API keys,
cookies, source files, diffs, clipboard content, exact IP addresses, account
emails, or machine/user names.
