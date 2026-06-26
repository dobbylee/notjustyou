# Not Just You

Not Just You is a privacy-safe status board for AI tools. It helps users see whether a problem is isolated to them or showing up across a wider surface.

The current MVP is a public dashboard with anonymous community reports, official provider status badges, and opt-in metadata-only installed-client signals.

## Use Not Just You

### Dashboard

Use the public dashboard at [notjustyou.dev](https://notjustyou.dev).

### CLI Status Checks

Install the published CLI for terminal status lookup:

```bash
npm install -g @notjustyou/cli
njy status
njy status openai-api
njy status openai-api --watch
```

### API Middleware Reporting

Set up an opt-in SDK collector when you want your own OpenAI, Anthropic, or
Gemini API wrapper to contribute metadata-only failure signals:

```bash
njy setup --service openai-api
npm install @notjustyou/sdk-js
```

Repeat `--service` for `openai-api`, `anthropic-claude-api`, or
`google-gemini-api` as needed. See
[packages/notjustyou-sdk-js](packages/notjustyou-sdk-js) for wrapper usage and
diagnostics.

### MCP For AI Clients

Use the MCP server with AI clients that support stdio MCP tools:

```bash
npm install -g @notjustyou/mcp
```

Add `notjustyou-mcp` as a stdio MCP server in your AI client. Status tools read
public summaries only. Setup tools can enable or disable supported local
reporting after explicit confirmation, but they do not submit signals directly.
See [packages/notjustyou-mcp](packages/notjustyou-mcp) for configuration.

### Claude Code Plugin

Use the Claude Code plugin for status lookups inside Claude Code:

```text
/plugin marketplace add dobbylee/notjustyou
/plugin install notjustyou@notjustyou
```

Then start a new Claude Code session and ask a status question, or invoke the
status skill directly:

```text
Is Claude Code down?
/notjustyou:status anthropic-claude-code
```

The Claude Code plugin supports conversational status lookup and optional
best-effort local hook reporting after explicit opt-in. It sends only normalized
failure metadata through the local receiver.

### Cursor Plugin

Cursor support is available as a package while marketplace distribution is
pending. The plugin provides status lookup and explicit opt-in reporting setup
through bundled MCP tools. It must currently be installed into Cursor's local
plugin directory. See
[packages/notjustyou-cursor-plugin](packages/notjustyou-cursor-plugin) for
manual install instructions.

### Antigravity Plugin

Antigravity support is available as a plugin package for Antigravity CLI and
the Antigravity desktop app. Install the published package by unpacking it and
passing the plugin directory to `agy plugin install`, then ask an Antigravity
status question. See
[packages/notjustyou-antigravity-plugin](packages/notjustyou-antigravity-plugin)
for details.

The Antigravity plugin supports status lookup and optional local hook reporting
after explicit opt-in.

### Codex Plugin

Use the Codex plugin for status lookups inside Codex:

```bash
codex plugin marketplace add dobbylee/notjustyou
codex plugin add notjustyou@notjustyou
```

Then start a new Codex thread and ask for a status check or invoke
`$notjustyou:status openai-api`.

The Codex plugin is status-only. Automatic Codex reporting is not available.

## Project Status

Current:

- Dashboard with anonymous community reports, official status badges, and source breakdown
- CLI and MCP status lookup
- Opt-in installed-client signal APIs for metadata-only problem signals
- Node SDK middleware for OpenAI API, Claude API, and Gemini API
- Claude Code and Cursor plugins with opt-in local hook reporting
- Codex status-only plugin and Antigravity plugin with opt-in local hook reporting
- No account or login requirement

Browser extensions are not part of the current release.

## Privacy Boundary

Not Just You should collect the smallest metadata needed to show service-level status.

Collected or processed:

- Community report service id and `Slow`, `Error`, or `Down` option
- Official provider status summaries
- Opt-in installed-client failure metadata such as symptom, status code,
  duration, short error code, client version, and coarse region hint
- Collector setup, heartbeat, minute counter, and short-lived dedupe metadata
- Aggregate page and interaction analytics such as page views, referrers, and
  button-click counters

Local hook reporting is opt-in. A local adapter may process vendor hook payloads
in memory, but only normalized metadata is sent to `/api/signals`.

Not stored, queued, logged, or sent:

- Prompt text, messages, commands, shell output, tool input or result bodies
- Provider request or response bodies and headers
- API keys, cookies, or exact IP addresses
- Source files, diffs, file paths, clipboard content, transcript paths
- Account emails, machine names, local usernames, or workspace identifiers

Raw collector tokens are saved only in the local Not Just You config by
`njy setup` and sent only as bearer auth to the configured Not Just You API.
They are not printed or stored server-side as raw tokens.

The dashboard keeps community reports, official status, and installed-client
signals visibly separate even when it shows a unified recent problem summary.

See [docs/architecture.md](docs/architecture.md) and [docs/signals.md](docs/signals.md) for the durable design notes.

## Current Surfaces

- Anthropic: Claude Code, Claude.ai, Claude Cowork, Claude API
- OpenAI: Codex CLI, Codex App, ChatGPT, OpenAI API
- Google: Antigravity CLI, Antigravity, Antigravity IDE, Gemini Web, Gemini API
- Cursor: Cursor IDE, Cursor CLI

## Official Status Mapping

- Anthropic: Statuspage components for Claude Code, claude.ai, Claude Cowork, and Claude API
- OpenAI: Statuspage components for CLI, App, Conversations, and Chat Completions
- Google: Workspace Gemini for Gemini Web, Cloud Vertex Gemini API for Gemini API
- Cursor: Statuspage components for IDE and CLI
- Antigravity CLI, Antigravity, and Antigravity IDE stay unmapped until there is a reliable official source

Unmapped or uncertain official status surfaces omit the official badge.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR. Developer setup, self-hosting, and public API details are in [docs/development.md](docs/development.md).

## License

MIT
