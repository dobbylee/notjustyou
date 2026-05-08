# Not Just You

Real-time community signal for AI tools. The MVP is a single status board where users can check recent reports and submit `Slow`, `Error`, or `Down` without signing in.

This repo is currently at the scaffolded MVP stage. The local app works with in-memory storage, and production readiness depends on connecting Vercel and Upstash Redis.

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
- `/api/official` official provider status summary

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
- OpenAI and Anthropic official status adapters
- Google and Cursor official status marked as `not_connected`

## Notes

- `docs/` is ignored and used for local planning notes.
- Vercel Web Analytics is used for visits/referrers only. Report behavior is visible through Redis counters and API logs.
- Production MVP completion requires Vercel deployment, Upstash Redis env vars, Web Analytics activation, and a production smoke test.
