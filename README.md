# Not Just You

Real-time community signal for AI tools. The MVP is a single status board where users can check recent reports and submit `Slow`, `Error`, or `Down` without signing in.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript 6 with `ES2025`
- Tailwind CSS 4
- Redis via `REDIS_URL` with Docker Compose locally
- Vercel Web Analytics for traffic only
- Vitest

## Requirements

- Node `>=20.9.0`
- pnpm `10.30.3`

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

If Redis is unavailable, report APIs return `503` instead of silently dropping to process memory.

## Deployment

Set these environment variables in production:

```bash
NEXT_PUBLIC_APP_URL=https://notjustyou.dev
REDIS_URL=rediss://default:<PASSWORD>@<DATABASE>.upstash.io:6379
ANALYTICS_READ_TOKEN=<LONG_RANDOM_TOKEN>
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

## App Surface

- `/` status board
- `/privacy` privacy notes
- `/api/summary` recent 10 minute community report summary
- `/api/report` report submission with 3 minute same-service dedupe
- `/api/clicks` aggregate button click counters, with token-protected reads
- `/api/official` official service surface status summary

## MVP Behavior

- Provider tabs
- Product surface cards
- `Slow`, `Error`, `Down` reports
- Recent 10 minute report counts
- Community state from absolute report counts
- Same-service dedupe for 3 minutes per fingerprint
- 5 second polling when visible
- 30 second polling when hidden
- Optimistic report updates
- Aggregate Redis counters for report button, provider tab, refresh, and copy clicks
- Surface-level official status adapters for Claude, Cursor, Gemini Web, Gemini API, and mapped OpenAI surfaces
- Unmapped or uncertain official status surfaces omit the official badge

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

## Privacy Notes

- No account or login is required.
- Reports are stored in Redis as service/status counters in minute buckets.
- Button clicks are stored in Redis as aggregate counters in hourly buckets.
- Same-service dedupe uses a short-lived fingerprint derived from request metadata.
- Vercel Web Analytics is used for page views and referrers only.
- A minimal `/privacy` page explains what the MVP stores.

## Contributing

- Run `pnpm lint`, `pnpm test`, and `pnpm build` before opening a pull request.
- Service surfaces live in `lib/catalog.ts`.
- Report options are intentionally limited to `Slow`, `Error`, and `Down`.
- Keep official status and community reports separate in UI and API changes.

## License

MIT
