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
pnpm dev         # start local dev server
pnpm build       # production build, including CLI/MCP/SDK packages
pnpm start       # start production server after build
pnpm lint        # eslint
pnpm test        # app, package, and plugin tests
pnpm verify      # lint, tests, and production build
pnpm test:redis  # separate integration suite; requires Docker
```

## Verification

`pnpm verify` runs the baseline commands owned by `AGENTS.md` in order and stops
on failure. `pnpm test` includes app, CLI, MCP, SDK, and plugin tests. The Redis
integration suite runs separately through `pnpm test:redis` and is not included
in `pnpm verify`. The build compiles CLI before MCP because MCP consumes the CLI
reporting-setup export.

| Changed surface | Focused checks in addition to the baseline |
| --- | --- |
| API/privacy/storage | Relevant route and `tests/signals`/Redis tests; test malformed input and failure paths |
| Redis Lua or atomic writes | `pnpm test:redis` (requires Docker); mocks or Lua text assertions alone do not prove execution/atomicity |
| Dashboard | Relevant component tests; inspect affected desktop/mobile behavior in a browser |
| CLI/MCP/SDK | Relevant package tests and build; check packed artifacts when exports or packaging change |
| Plugins | Relevant `tests/plugins` tests; validate manifest, hooks, and pinned consumer versions |
| Harness/docs | Check references and public/private boundaries; keep baseline unless an agreed narrower check applies |

`pnpm test:redis` starts and removes its own Redis container on a random loopback
port with persistence disabled. It never reads `REDIS_URL` or uses an existing
Redis instance. The first run downloads `redis:8.2.5-alpine` if the image is not
already available. Docker/image availability failures fail this check explicitly.

Tests must use synthetic data, mock external network calls, and isolate local
configuration. Use `tests/helpers/temp-dir.ts` for automatically cleaned temporary
directories and `vi.stubEnv` for environment overrides. Restore fake timers and
close local servers in teardown, including failure paths. Prefer controlled
promises or fake time over arbitrary sleeps. Loopback permission failures are
environment blockers, not successful integration checks. Never use a developer's
running server or production Redis as a test fixture.

Dependency audit results are time-specific. Run `pnpm audit` to include build
and test dependencies, or `pnpm audit --prod` to inspect runtime dependencies
only. Record registry/network failures explicitly; passing tests are not a
dependency vulnerability assessment.

## Remote MCP

`POST /mcp` exposes the public, authentication-free status-only MCP server used
for Plugins Directory review. It uses stateless Streamable HTTP and advertises
only four read-only tools. Local reporting setup remains available only through
the separately installed stdio MCP package.

The application applies per-client and per-instance one-minute request budgets
using the trusted Vercel address boundary. Before enabling the endpoint in
production, also configure and verify a Vercel Firewall rate-limit rule for
`/mcp`; the in-process budget is defense in depth, not a distributed global
limit.

`GET /mcp` and `DELETE /mcp` return method-not-allowed responses because the
remote server does not keep sessions or provide a standalone SSE stream.

Submission metadata, prompts, test cases, and approval-gated prerequisites are
kept in [plugin-directory-submission.md](plugin-directory-submission.md).

## Workspace Packages

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
pnpm --filter @notjustyou/cli build
pnpm --filter @notjustyou/mcp build
NOTJUSTYOU_BASE_URL=http://localhost:3000 node packages/notjustyou-mcp/dist/index.js
```

Build the SDK package from a workspace checkout:

```bash
pnpm --filter @notjustyou/sdk-js build
```

## Request Limits

Request bodies are limited by bytes read from the stream, including requests
without `Content-Length` or with an incorrect smaller declared length.

| POST endpoint | Maximum body | Oversized response |
| --- | --- | --- |
| `/api/report`, `/api/clicks` | 8 KiB (8,192 bytes) | HTTP `413`, `reason: "body_too_large"` |
| `/api/signals`, `/api/collectors/register`, `/api/collectors/heartbeat` | 8 KiB (8,192 bytes) | HTTP `400`, `reason: "body_too_large"` |
| `/mcp` | 32 KiB (32,768 bytes) | HTTP `413`, JSON-RPC error code `-32000` |

Signal validation and error responses are described in [Signals](signals.md#validation-rules).

CLI and installed stdio MCP requests to the public Not Just You APIs have a
10-second deadline covering response headers and body. This is a per-request
limit, not a timeout for the user's AI provider call. The CLI and installed MCP
do not automatically retry failed API requests. Their source-specific failure
behavior is documented in the [CLI README](../packages/notjustyou-cli/README.md#request-failures)
and [MCP README](../packages/notjustyou-mcp/README.md#request-failures).
The SDK has its own [bounded signal retry policy](../packages/notjustyou-sdk-js/README.md#retry-and-coalescing).

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
