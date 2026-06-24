# Not Just You

Not Just You is a privacy-safe status board for AI tools. It helps users see whether a problem is isolated to them or showing up across a wider surface.

The current MVP is a public dashboard with anonymous community reports, official provider status badges, and opt-in metadata-only installed-client signals.

## Use Not Just You

Use the public dashboard at `https://notjustyou.dev`.

Use the published CLI for status lookup:

```bash
npm install -g @notjustyou/cli
njy status
njy status openai-api
njy status openai-api --watch
```

Expected quick check:

```bash
njy --help
njy status openai-api
```

Set up an opt-in SDK collector for API middleware signals:

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

Use the MCP server with AI clients that support stdio MCP tools:

```bash
npm install -g @notjustyou/mcp
```

Example MCP client configuration:

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

MCP tools:

- `list_surfaces`
- `get_surface_status`
- `get_recent_signals`
- `explain_privacy`
- `get_reporting_setup_state`
- `enable_reporting`
- `disable_reporting`

Status MCP tools read public status summaries only. Setup MCP tools can enable
or disable local hook reporting after explicit user confirmation, but they do
not submit signals directly. The CLI can also register an anonymous collector
for opt-in SDK or local hook use, but it does not submit reports or
installed-client signals by itself.

Use the Claude Code plugin for status lookups inside Claude Code surfaces:

```text
/plugin marketplace add dobbylee/notjustyou
/plugin install notjustyou@notjustyou
/notjustyou:status openai-api
```

During plugin setup, you can opt in to anonymous Claude Code failure reporting.
If enabled, the plugin starts the local Not Just You setup path for you and
reports only normalized failure metadata through a localhost receiver. This is
best-effort installed-client reporting: it can share failures that Claude Code
itself reaches and emits as local failure events, but it is not a guaranteed
outage detector.

Use the Codex plugin for status lookups inside Codex surfaces:

```bash
codex plugin marketplace add dobbylee/notjustyou
codex plugin add notjustyou@notjustyou
```

Then start a new Codex thread and ask for a status check or invoke `$notjustyou:status openai-api`.

The Claude Code plugin does not call public `/api/signals` directly. Public
sending requires explicit reporting opt-in and the local receiver path. The
Codex plugin remains status-only because current Codex hook and telemetry
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
- Cursor plugin package foundation with status lookup and opt-in local hook
  forwarding; marketplace distribution is pending
- Codex status-only plugin; automatic Codex reporting is deferred until a
  reliable service-failure classifier exists
- Node SDK core for OpenAI API, Claude API, and Gemini API metadata-only middleware signals
- SDK retry, backoff, and local coalescing
- Redis-backed counters and short dedupe windows
- No account or login requirement

Browser extensions, MCP monitor collectors, WebSocket transport, durable event warehouses, and broader vendor-specific collectors are later work. Codex hook collection is intentionally deferred until local raw hook payloads can be classified into reliable service-level metadata without storing or sending prompt, command, tool input, or tool output content.

## Privacy Boundary

Not Just You should collect the smallest metadata needed to show service-level status.

Currently collected:

- Service id
- Report option: `Slow`, `Error`, or `Down`
- Installed-client symptom category
- Installed-client status code, duration, short error code, configured collector client version, and coarse region hint when submitted
- Opt-in local hook failure metadata after receiver normalization
- Random installed-client installation id, stored locally by the SDK; server aggregation stores only derived hashes
- Anonymous collector registration metadata: collector id, allowed source, allowed services, client name/version, registration time, and revocation time when applicable
- Collector heartbeat metadata: collector id, derived installation hash, client version, and last seen time
- Minute-bucketed counters
- Short-lived same-service dedupe fingerprint. Request metadata can be processed to create this hash, but raw IP, user agent, and language values are not stored.
- Aggregate button click counters
- Vercel Web Analytics page views and referrers

Collector auth:

- Raw collector tokens are saved locally by `njy setup` and are not printed.
- Installed-client signal submission uses the collector token as Not Just You authorization.
- Server-side token lookup uses derived token data; raw collector tokens are not stored.

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
