# Not Just You

Real-time community signal for AI tools. The MVP is a single status board where users can check recent reports and submit `Slow`, `Error`, or `Down` without signing in.

This repo is currently at the MVP app stage. The local app works with in-memory storage, and production readiness depends on connecting Vercel and Upstash Redis.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript 6 with `ES2025`
- Tailwind CSS 4
- Upstash Redis with in-memory local fallback
- Vercel Web Analytics for traffic only
- Vitest

## Requirements

- Node `>=20.9.0`
- pnpm `10.30.3`

The package manager is pinned in `package.json`.

## Local Development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

Redis is optional for local development. Without Redis credentials, reports are stored in process memory and reset when the dev server restarts.

## Environment

Create `.env.local` from `.env.example` when persistent local storage is needed.

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

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
- `/api/summary` recent 10 minute community report summary
- `/api/report` report submission with 3 minute same-service dedupe
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
- Surface-level official status adapters for Claude, Cursor, Gemini Web, Gemini API, and mapped OpenAI surfaces
- Unmapped or uncertain official status surfaces omit the official badge

## Current Surfaces

- Anthropic: Claude Code, Claude.ai, Claude Cowork, Claude API
- OpenAI: Codex CLI, Codex App, ChatGPT, OpenAI API
- Google: Gemini CLI, Antigravity, Gemini Web, Gemini API
- Cursor: Cursor IDE, Cursor CLI

## Official Status Mapping

- Anthropic: Statuspage components for Claude Code, claude.ai, Claude Cowork, and Claude API
- OpenAI: Statuspage components for CLI, App, Conversations, and Chat Completions
- Google: Workspace Gemini for Gemini Web, Cloud Vertex Gemini API for Gemini API
- Cursor: Statuspage components for IDE and CLI
- Gemini CLI and Antigravity stay unmapped until there is a reliable official source

## Privacy Notes

- No account or login is required.
- Reports are stored as service/status counters in minute buckets.
- Same-service dedupe uses a short-lived fingerprint derived from request metadata.
- Vercel Web Analytics is used for page views and referrers only.
- A minimal `/privacy` page should be added before public launch.

## Notes

- `docs/` is ignored and used for local planning notes.
- Vercel Web Analytics is used for visits/referrers only. Report behavior is visible through Redis counters and API logs.
- Production MVP completion requires Vercel deployment, Upstash Redis env vars, Web Analytics activation, a minimal privacy page, and a production smoke test.
