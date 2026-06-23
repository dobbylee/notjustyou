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

Use the read-only MCP server with AI clients that support stdio MCP tools:

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

The MCP server reads public status summaries only. The CLI can also register an anonymous collector for opt-in SDK use, but it does not submit reports or installed-client signals by itself.

## Project Status

Current:

- Anonymous `Slow`, `Error`, and `Down` community reports
- Recent 10 minute community report summaries
- Official status badges for mapped provider surfaces
- Opt-in installed-client signal APIs for metadata-only problem signals
- Dashboard source breakdown for community reports, installed signals, and official status
- Read-only MCP status lookup
- Node SDK core for OpenAI API, Claude API, and Gemini API metadata-only middleware signals
- SDK retry, backoff, and local coalescing
- Redis-backed counters and short dedupe windows
- No account or login requirement

Browser extensions, MCP monitor collectors, WebSocket transport, durable event warehouses, and vendor-specific hook collectors are later work.

## Privacy Boundary

Not Just You should collect the smallest metadata needed to show service-level status.

Currently collected:

- Service id
- Report option: `Slow`, `Error`, or `Down`
- Installed-client symptom category
- Installed-client status code, duration, short error code, configured collector client version, and coarse region hint when submitted
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

## Develop Or Self-Host

Use this section if you are contributing, running a fork locally, or deploying your own instance.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript 6 with `ES2025`
- Tailwind CSS 4
- Redis via `REDIS_URL`
- Vercel Web Analytics for traffic only
- Vitest

## Requirements

- Node `>=20.9.0`
- pnpm `10.30.3`
- Redis

The package manager is pinned in `package.json`.

## Local Development

```bash
pnpm install
cp .env.example .env.local
docker compose up -d redis
pnpm dev
```

Open `http://localhost:3000`.

Redis is required for local development. Without `REDIS_URL`, the app fails fast instead of falling back to process memory.

## Environment

Create `.env.local` from `.env.example`.

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
ANALYTICS_READ_TOKEN=replace-me
NOTJUSTYOU_SIGNAL_SECRET=replace-with-local-random-secret
```

`.env.local` is ignored by git. Keep local and production secrets out of the repository.

## Redis

Redis is required at runtime. The app does not use an in-memory fallback.

Local development uses Docker Compose with `redis:8.2.5-alpine`:

```bash
docker compose up -d redis
```

Production can use Upstash Redis by setting `REDIS_URL` to the TLS Redis connection string:

```bash
REDIS_URL=rediss://default:<PASSWORD>@<DATABASE>.upstash.io:6379
```

If Redis is unavailable, report APIs return `503` instead of silently dropping data.

## Deployment

Set these environment variables in production:

```bash
NEXT_PUBLIC_APP_URL=https://notjustyou.dev
REDIS_URL=rediss://default:<PASSWORD>@<DATABASE>.upstash.io:6379
ANALYTICS_READ_TOKEN=<LONG_RANDOM_TOKEN>
NOTJUSTYOU_SIGNAL_SECRET=<LONG_RANDOM_SECRET>
```

The app is designed for Vercel. Enable Vercel Web Analytics if you want traffic and referrer data.

## Scripts

```bash
pnpm dev     # start local dev server
pnpm build   # production build
pnpm start   # start production server after build
pnpm lint    # eslint
pnpm test    # vitest
```

Run the CLI from a workspace checkout:

```bash
pnpm --filter @notjustyou/cli build
node packages/notjustyou-cli/dist/index.js status --base-url http://localhost:3000
node packages/notjustyou-cli/dist/index.js status openai-api --base-url http://localhost:3000
node packages/notjustyou-cli/dist/index.js status openai-api --watch
```

Advanced CLI diagnostics:

```bash
node packages/notjustyou-cli/dist/index.js register --source api_middleware --service openai-api --base-url http://localhost:3000
node packages/notjustyou-cli/dist/index.js doctor --base-url http://localhost:3000
node packages/notjustyou-cli/dist/index.js payload-preview --fixture ./signal.json
```

Repeat `--service` when one local collector config should allow multiple API SDK adapters:

```bash
node packages/notjustyou-cli/dist/index.js register --source api_middleware --service openai-api --service anthropic-claude-api --service google-gemini-api --base-url http://localhost:3000
```

Run the MCP server from a workspace checkout:

```bash
pnpm --filter @notjustyou/mcp build
NOTJUSTYOU_BASE_URL=http://localhost:3000 node packages/notjustyou-mcp/dist/index.js
```

Build the SDK package from a workspace checkout:

```bash
pnpm --filter @notjustyou/sdk-js build
```

## Public API Surface

- `/` status board
- `/privacy` privacy notes
- `/api/summary` recent 10 minute community report summary
- `/api/report` report submission with 3 minute same-service dedupe
- `/api/clicks` aggregate button click counters, with token-protected reads
- `/api/official` official service surface status summary
- `/api/collectors/register` anonymous installed-client collector registration
- `/api/collectors/heartbeat` installed-client collector heartbeat
- `/api/signals` metadata-only installed-client signal submission
- `/api/signals/summary` installed-client signal summary
- `/api/health` app and Redis health check
- `/api/monitoring` token-protected aggregate operational summary

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

Commit and PR titles should describe the actual change without Conventional Commit prefixes or internal phase names.

## License

MIT
