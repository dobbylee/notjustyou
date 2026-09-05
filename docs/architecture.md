# Architecture

Not Just You is a status layer for AI tools. The product combines tool-local status lookup, official provider status, opt-in installed-client signals, and fallback community reporting without treating those sources as the same kind of data.

## Current Product

The current app is a Next.js status board backed by Redis.

- The public dashboard is a compact shared status view with secondary fallback controls for `Slow`, `Error`, or `Down` community reports.
- Reports are deduped for the same service over a short window.
- Official provider status is fetched separately where a reliable mapping exists. Componentless provider incidents remain provider-level advisories and do not overwrite individual surface status.
- Opt-in SDK middleware can submit metadata-only API problem signals for OpenAI API, Claude API, and Gemini API.
- CLI, MCP, plugins, and SDK collectors are the primary surfaces for checking status or contributing opt-in signals where problems happen.
- A public Streamable HTTP MCP endpoint exposes only status lookup and privacy tools for directory clients; local reporting setup remains confined to the installed stdio MCP package.
- The dashboard polls each source independently and renders provider surface cards with source breakdown visible by default. A partial source failure must not hide successful data from another source.

Redis is required at runtime. There is no in-memory fallback.

Installed-signal counters use sparse minute hashes. Compact all-service reads
scale with the requested minute window, skip unique-installation calculation,
and avoid the full source-by-symptom cross product. Service-specific detail
reads use approximate unique-installation structures. A persisted v2 cutover
minute temporarily merges still-live v1 buckets through a bounded one-hour
rolling-deployment overlap, then naturally stops reading them once the requested
window moves past that overlap.

## Source Families

The product has three source families:

| Source family | API | Storage | UI role |
| --- | --- | --- | --- |
| Manual community reports | `POST /api/report`, `GET /api/summary` | report counters | user-submitted recent reports |
| Official status | `GET /api/official` | official status cache | labeled surface status row and provider advisories |
| Installed-client signals | `/api/signals` APIs | signal counters | opt-in metadata-only problem signals |

These families must stay separate in storage, API contracts, tests, and backend aggregation.

The dashboard may show a unified recent problem summary when it helps users understand volume, but that summary is presentation-only and must keep source breakdown visible. A compact card can show the combined count first, then show the source rows nearby. For example:

```text
Official status: operational
Community reports: 10
Installed signals: 8
```

Avoid presenting mixed sources as a single undifferentiated report count.
Approximate unique-installation counts may remain available through detailed
API, CLI, or MCP surfaces, but the compact dashboard should not compress
multiple installed-signal metrics into one ambiguous value.

## Product Analytics And Monitoring

`/api/clicks` is product interaction analytics. It records aggregate dashboard interactions for provider tabs and fallback report controls. Today it can be used as a lightweight way to inspect dashboard interaction volume, but it is not the long-term operational monitoring surface.

Operational checks should use dedicated read APIs:

- `/api/health` for app and Redis availability.
- `/api/monitoring` for token-protected aggregate operational counts.
- `/api/summary` for community report state.
- `/api/signals/summary` for installed-client signal state.

Do not extend click tracking into collector health, API latency, Redis diagnostics, abuse monitoring, or other operational telemetry. Keep those concerns in dedicated monitoring or signal contracts so product analytics does not become a mixed-purpose data sink. If click-volume analytics stops informing product decisions, remove `/api/clicks` in a focused cleanup rather than reusing it for operational monitoring.

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

## Module Boundaries

| Module | Responsibility |
| --- | --- |
| `app/api`, `app/mcp` | HTTP adaptation, status codes, and transport setup |
| `lib/http` | Bounded request-body parsing shared by HTTP entry points |
| `lib/catalog.ts` | Stable service ids and provider/surface mappings |
| `lib/storage`, `lib/signals/storage.ts` | Separate community and installed-signal persistence |
| `lib/signals` | Signal validation, authentication, privacy, and aggregation |
| `lib/official` | Provider adapters, component mapping, and official cache |
| `lib/mcp` | Public status-only tools and source-separated read models |
| `components` | Dashboard polling and presentation; combined counts stay here |
| `packages/notjustyou-cli` | Local configuration, explicit consent, receiver, and CLI |
| `packages/notjustyou-mcp` | Installed stdio tools; depends on the CLI reporting-setup export |
| `packages/notjustyou-sdk-js` | Metadata normalization, bounded queue, and sending |
| `packages/*-plugin` | Vendor-specific instructions, manifests, and local hook adapters |

Published packages must work from their packed artifacts without root app imports.
Vendor plugin instruction files are independently distributed; similar privacy
rules there are intentional. Keep runtime helpers shared within their owning
module before introducing a new cross-package dependency.

## Expansion Gates

Redis hot counters remain the v1 path for fresh dashboard state.

Add Postgres or Neon only when the product needs history beyond hot windows, trend charts, incident grouping, collector version analysis, or abuse review workflows. Keep prompt, body, header, file, exact IP, and account data out of durable storage.

Evaluate ClickHouse or Tinybird only if event volume or analytics query shape grows beyond what Postgres can comfortably handle.

Start with dashboard polling and CLI short polling. Add SSE only if tool-local status UX needs push updates. Evaluate WebSocket or managed realtime only after polling/SSE are insufficient and long-lived connection hosting has a clear owner.
