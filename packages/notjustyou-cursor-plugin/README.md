# Not Just You Cursor Plugin

Plugin for Cursor IDE surfaces.

## What It Provides

- A Not Just You status skill for AI service status checks.
- A bundled Not Just You MCP server configuration for status lookup and explicit local reporting setup.
- Public status lookups for community reports, installed-client signal aggregates, and official status summaries.
- Optional metadata-only local hook reporting for coarse Cursor agent error events.

## Install

Cursor marketplace distribution is not available yet. Until then, install the
plugin from a local checkout.

From the Not Just You repository:

```bash
mkdir -p ~/.cursor/plugins/local
ln -s "$(pwd)/packages/notjustyou-cursor-plugin" ~/.cursor/plugins/local/notjustyou
```

Then restart Cursor or run **Developer: Reload Window**.

## Optional Local Hook Reporting

Install-only status lookup does not enable reporting. Cursor hook reporting is
best-effort and only works when you explicitly opt in to local hook reporting
with a Not Just You `cli_hook` collector for `cursor-ide`.
You can ask the plugin to set up Not Just You reporting; the `setup-reporting`
skill explains the privacy boundary and asks for confirmation before calling
the bundled setup MCP tool.

```bash
njy enable cursor
```

That command registers an anonymous `cli_hook` collector, saves the token only
in the local Not Just You config file, and starts the localhost receiver in
send mode. Keep the receiver running while you want automatic Cursor reports.
If the setup MCP tool is unavailable and you installed the CLI from npm but do
not have `njy` on your `PATH`, use:

```bash
npx -y @notjustyou/cli@0.3.1 enable cursor
```

To turn reporting off:

```bash
njy disable cursor
```

The plugin hook does not call public `/api/signals` directly. It forwards only
an allowlisted Cursor `stop` or `sessionEnd` local envelope to the localhost
receiver. The local adapter derives metadata-only `cursor-ide` signals without
receiving raw prompts, commands, outputs, file paths, emails, transcript paths,
or tool bodies.

Reporting is not a guaranteed outage detector. It can share coarse Cursor agent
or session errors that reach local hooks, but it cannot report cases where
Cursor never starts, hooks are disabled, the local receiver is not configured,
or the user's network cannot reach Not Just You.

## Privacy Boundary

The status skill reads public aggregate status APIs through `@notjustyou/mcp`.
The setup MCP tools can write local reporting config after explicit
confirmation, but they do not submit signals directly or print collector
tokens.

It does not send prompt text, request or response bodies, headers, API keys,
cookies, source files, diffs, clipboard content, exact IP addresses, account
emails, machine names, or local usernames.

Optional hook reporting sends only metadata-only failure signals through the
local Not Just You receiver when local hook opt-in is enabled. Raw Cursor hook
payloads are reduced by the plugin before forwarding; prompts, commands,
outputs, file paths, emails, transcript paths, and tool bodies are not stored,
queued, logged, or sent to Not Just You.
