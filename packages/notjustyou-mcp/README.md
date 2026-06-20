# @notjustyou/mcp

Read-only MCP server for Not Just You AI service status lookup.

## Install

```bash
npm install -g @notjustyou/mcp
```

You can also run it from a workspace checkout:

```bash
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

All tools are read-only. This package does not expose a signal submission tool and does not require collector credentials.

## Privacy Boundary

The MCP server reads public status summaries only:

- `/api/summary`
- `/api/signals/summary`
- `/api/official`

It does not collect prompt text, request or response bodies, headers, API keys, cookies, source files, diffs, clipboard content, exact IP addresses, account emails, or machine/user names.
