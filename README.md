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

Repeat `--service` for each API the app wraps. Supported SDK service ids are `openai-api`, `anthropic-claude-api`, and `google-gemini-api`.

`setup` registers an anonymous collector, saves the collector token only in the local Not Just You config file, and runs a lightweight readiness check. The token is not printed. SDK collectors reuse this local config.

For OpenAI, Anthropic, and Gemini API calls from one local collector config:

```bash
njy setup --service openai-api --service anthropic-claude-api --service google-gemini-api
```

See [packages/notjustyou-sdk-js](packages/notjustyou-sdk-js) for the `recordAiCall` wrapper, slow-call settings, retry behavior, and diagnostics.

### MCP For AI Clients

Use the MCP server with AI clients that support stdio MCP tools:

```bash
npm install -g @notjustyou/mcp
```

The MCP server lets compatible AI clients answer status questions
conversationally, such as "Is Claude Code down?" or "Show recent Cursor
signals." It also exposes explicit local reporting setup tools for supported
plugins after user confirmation.

After installing the package, add `notjustyou-mcp` as a stdio MCP server in
your AI client.

Status MCP tools read public status summaries only. Setup MCP tools can enable
or disable local hook reporting after explicit user confirmation, but they do
not submit signals directly. See [packages/notjustyou-mcp](packages/notjustyou-mcp)
for MCP client configuration and the full tool list.

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

The plugin bundles MCP status tools, so Claude Code can answer conversationally
from public community reports, installed-client signal aggregates, and official
status summaries. During plugin setup, you can opt in to anonymous Claude Code
failure reporting. If enabled, the plugin starts the local Not Just You setup
path for you and reports only normalized failure metadata through a localhost
receiver. This is best-effort installed-client reporting, not a guaranteed
outage detector.

The Claude Code plugin does not call public `/api/signals` directly. Public
sending requires explicit reporting opt-in and the local receiver path.

### Cursor Plugin

Cursor support is available as a package while marketplace distribution is
pending. The plugin provides status lookup and explicit opt-in reporting setup
through bundled MCP tools, but it must currently be installed into Cursor's
local plugin directory. See
[packages/notjustyou-cursor-plugin](packages/notjustyou-cursor-plugin) for
manual install instructions.

### Codex Plugin

Use the Codex plugin for status lookups inside Codex:

```bash
codex plugin marketplace add dobbylee/notjustyou
codex plugin add notjustyou@notjustyou
```

Then start a new Codex thread and ask for a status check or invoke `$notjustyou:status openai-api`.

The Codex plugin remains status-only because current Codex hook and telemetry
surfaces do not yet provide a reliable service-failure classifier.

## Project Status

Current:

- Anonymous `Slow`, `Error`, and `Down` community reports
- Recent 10 minute community report summaries
- Official status badges for mapped provider surfaces
- Opt-in installed-client signal APIs for metadata-only problem signals
- Dashboard source breakdown for community reports, installed signals, and official status
- MCP status lookup with explicit local reporting setup tools
- Claude Code status plugin with opt-in local hook reporting
- Cursor plugin package with status lookup and opt-in local hook reporting
- Codex status-only plugin; automatic Codex reporting is deferred until a
  reliable service-failure classifier exists
- Node SDK core for OpenAI API, Claude API, and Gemini API metadata-only middleware signals
- No account or login requirement

Browser extensions and broader vendor-specific collectors are not part of the current release.

## Privacy Boundary

Not Just You should collect the smallest metadata needed to show service-level status.

Currently collected:

- Service id and community report option: `Slow`, `Error`, or `Down`
- Official status summaries from provider status pages
- Installed-client symptom category and small metadata such as status code,
  duration, short error code, client version, and coarse region hint when
  submitted
- Opt-in local hook failure metadata after local normalization
- Random installed-client installation id, stored locally; server aggregation
  stores only derived hashes
- Anonymous collector setup metadata: collector id, allowed source, allowed
  services, client name/version, registration time, and revocation time when
  applicable
- Collector heartbeat metadata: collector id, derived installation hash, client
  version, and last seen time
- Minute-bucketed counters
- Short-lived same-service dedupe fingerprint. Request metadata can be
  processed to create this hash, but raw IP, user agent, and language values
  are not stored.
- Aggregate site interaction and page analytics, including Vercel Web
  Analytics page views and referrers

Raw collector tokens are saved locally by `njy setup` and are not printed.
Server-side token lookup uses derived token data; raw collector tokens are not
stored.

Local hook processing:

- If a user opts in to local hook reporting, a local adapter may receive vendor
  hook payloads in memory to derive a metadata-only signal.
- Raw vendor payload fields such as prompts, commands, outputs, file paths,
  emails, transcript paths, headers, cookies, and tokens are not stored,
  queued, logged, or sent to Not Just You.
- The public `/api/signals` endpoint accepts only normalized metadata.

Not collected:

- Prompt text
- Provider request or response bodies
- Provider request or response headers
- Provider API keys
- Cookies
- Source files or diffs
- Clipboard content
- Exact IP addresses
- Account emails
- Machine names or local usernames

Manual community reports, official status, and installed-client signals remain separate in storage and API contracts. The dashboard may show a unified recent problem summary, but it must keep source breakdown visible.

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
