# Not Just You

Not Just You is a privacy-safe status board for AI tools. It helps users see whether a problem is isolated to them or showing up across a wider surface.

The current MVP is a public dashboard with anonymous community reports and official provider status badges. Planned installed-client signals will stay opt-in and metadata-only.

## Use Not Just You

Use the public dashboard at `https://notjustyou.dev`.

Use the read-only CLI from a terminal:

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

The CLI and MCP server read public status summaries only. They do not submit reports or installed-client signals, and they do not require collector credentials.

## Project Status

Current:

- Anonymous `Slow`, `Error`, and `Down` community reports
- Recent 10 minute community report summaries
- Official status badges for mapped provider surfaces
- Opt-in installed-client signal APIs for metadata-only problem signals
- Dashboard source breakdown for community reports, installed signals, and official status
- Read-only MCP status lookup
- Redis-backed counters and short dedupe windows
- No account or login requirement

Planned:

- API middleware collectors for OpenAI API, Claude API, and Gemini API

Browser extensions, MCP monitor collectors, WebSocket transport, durable event warehouses, and vendor-specific hook collectors are later work.

## Privacy Boundary

Not Just You should collect the smallest metadata needed to show service-level status.

Currently collected:

- Service id
- Report option: `Slow`, `Error`, or `Down`
- Installed-client symptom category
- Installed-client status code, duration, short error code, client version, and coarse region hint when submitted
- Random installed-client installation id, stored only through server-side derived hashes for aggregation
- Minute-bucketed counters
- Short-lived same-service dedupe fingerprint. Request metadata can be processed to create this hash, but raw IP, user agent, and language values are not stored.
- Aggregate button click counters
- Vercel Web Analytics page views and referrers

Not collected:

- Prompt text
- Request or response bodies
- Headers
- API keys
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

Run the MCP server from a workspace checkout:

```bash
pnpm --filter @notjustyou/mcp build
NOTJUSTYOU_BASE_URL=http://localhost:3000 node packages/notjustyou-mcp/dist/index.js
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

Baseline checks:

```bash
pnpm lint
pnpm test
pnpm run build
```

Commit and PR titles should describe the actual change without Conventional Commit prefixes or internal phase names.

## License

MIT
