# Development Guide

This guide is for contributors, fork maintainers, and self-hosted deployments.
For contribution workflow and review rules, read [CONTRIBUTING.md](../CONTRIBUTING.md).

## Stack

- Next.js 16 App Router
- React 19
- TypeScript 6 with `ES2025`
- Tailwind CSS 4
- Redis via `REDIS_URL`
- Vercel Web Analytics for traffic only
- Vitest

## Requirements

- Node 24 for the app runtime and repository-level development. The repository
  includes `.nvmrc` with `24`.
- Package manifests in this checkout allow Node `>=22 <25` where packages are
  designed to run outside the app.
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

Local hook receiver checks:

```bash
node packages/notjustyou-cli/dist/index.js enable claude-code --base-url http://localhost:3000
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
