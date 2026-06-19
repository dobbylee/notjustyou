# Architecture

Not Just You is a public status board for AI tools. The product combines community reporting, official provider status, and planned opt-in installed-client signals without treating those sources as the same kind of data.

## Current Product

The current app is a Next.js status board backed by Redis.

- Users can submit `Slow`, `Error`, or `Down` reports without signing in.
- Reports are deduped for the same service over a short window.
- Official provider status is fetched separately where a reliable mapping exists.
- The dashboard polls for recent state and renders provider surface cards.

Redis is required at runtime. There is no in-memory fallback.

## Source Families

The product has three source families:

| Source family | API | Storage | UI role |
| --- | --- | --- | --- |
| Manual community reports | `POST /api/report`, `GET /api/summary` | report counters | user-submitted recent reports |
| Official status | `GET /api/official` | official status cache | provider status badge |
| Installed-client signals | planned `/api/signals` APIs | signal counters | opt-in metadata-only problem signals |

These families must stay separate in storage, API contracts, tests, and backend aggregation.

The dashboard may show a unified recent problem summary when it helps users understand volume, but that summary is presentation-only and must keep source breakdown available. A compact card can show the combined count first, then expose the breakdown on hover, focus, or tap. For example:

```text
18 recent problem signals
10 community reports · 8 installed signals · 4 installations
Official status: operational
```

Avoid presenting mixed sources as a single undifferentiated report count.

## Product Analytics And Monitoring

`/api/clicks` is product interaction analytics. It records aggregate dashboard interactions such as report buttons, provider tabs, refresh, and copy-link actions. It is useful for understanding whether users interact with the product, but it is not the operational monitoring surface.

Operational checks should use dedicated read APIs:

- `/api/health` for app and Redis availability.
- `/api/monitoring` for token-protected aggregate operational counts.
- `/api/summary` for community report state.
- `/api/signals/summary` for installed-client signal state.

Do not extend click tracking into operational telemetry, collector health, API latency, Redis diagnostics, or abuse monitoring. Keep those concerns in dedicated monitoring or signal contracts so product analytics does not become a mixed-purpose data sink.

## Privacy Boundary

Not Just You should collect the smallest metadata needed to show service-level status.

Do not collect:

- prompt text
- request or response bodies
- headers
- API keys
- cookies
- source files or diffs
- clipboard content
- exact IP addresses
- account emails
- machine names or local usernames

If a new feature needs a new field, document the field in `docs/signals.md`, explain why it is needed, and add focused tests.

## Implementation Order

The durable order is:

1. Keep catalog, README, and public docs aligned.
2. Add installed-signal schema and privacy validation before collector code.
3. Add Redis hot counters and summary APIs.
4. Add dashboard source breakdown.
5. Add CLI and read-only MCP status lookup.
6. Add API middleware collectors.
7. Add vendor plugins only after local preview, redaction, and consent flows are clear.

Browser extensions, WebSocket transport, and durable event warehouses are later work.

## Expansion Gates

Redis hot counters remain the v1 path for fresh dashboard state.

Add Postgres or Neon only when the product needs history beyond hot windows, trend charts, incident grouping, collector version analysis, or abuse review workflows. Keep prompt, body, header, file, exact IP, and account data out of durable storage.

Evaluate ClickHouse or Tinybird only if event volume or analytics query shape grows beyond what Postgres can comfortably handle.

Start with dashboard polling and CLI short polling. Add SSE only if tool-local status UX needs push updates. Evaluate WebSocket or managed realtime only after polling/SSE are insufficient and long-lived connection hosting has a clear owner.
