# Signals

Signals are service-level observations used to help users understand whether an AI tool is having problems. Not Just You should preserve where each signal came from and avoid collecting user content.

## Source Families

Manual community reports, official status, and installed-client signals are separate families.

Manual community reports:

- submitted by a user through the dashboard fallback `Slow`, `Error`, or `Down` controls
- handled by `/api/report`
- summarized by `/api/summary`

Official status:

- fetched from provider status sources
- handled by `/api/official`
- displayed as a separate official status row
- componentless incidents stay provider-level advisories instead of being assigned to every service surface

Installed-client signals:

- opt-in metadata from SDK middleware, CLI hooks, plugins, browser extensions, MCP monitors, or local probes
- should use dedicated signal endpoints
- must not reuse `/api/report`
- v1 should start with API middleware and local tooling; browser extension and MCP monitor sources are future-capable schema values, not first implementation targets

The first SDK middleware supports:

- `openai-api`
- `anthropic-claude-api`
- `google-gemini-api`

The SDK sends only when local collector config allows `source: "api_middleware"` and the runtime `serviceId`.

## Installed Signal Shape

The installed-client signal input is metadata-only:

```ts
interface ProblemSignalInput {
  serviceId: string;
  source:
    | "api_middleware"
    | "cli_hook"
    | "ide_extension"
    | "browser_extension"
    | "mcp_monitor"
    | "local_probe";
  symptom:
    | "slow"
    | "error"
    | "down"
    | "rate_limited"
    | "auth_error"
    | "model_unavailable"
    | "network_error"
    | "tool_failure"
    | "permission_blocked"
    | "unknown";
  observedAt?: string;
  durationMs?: number;
  statusCode?: number;
  errorCode?: string;
  installationId?: string;
  clientVersion?: string;
  regionHint?: string;
  signalId?: string;
}
```

`collectorId` should be derived from the collector token server-side, not accepted in the request body.

Collector token lookup keys should use a server secret based HMAC. Raw collector tokens should not be stored.

Installation ids should be random local ids. Server-side dedupe and approximate unique counts should store only a derived hash or HMAC, not the raw installation id.

`signalId` is a random delivery id generated independently for each local
observation. SDK retries reuse the same id so the server can count a delivered
observation once even when its response is lost. The server stores only a
short-lived HMAC derived from the collector and signal ids.

## Validation Rules

`POST /api/signals` uses this validation order:

1. Enforce the 8 KiB (8,192-byte) limit while reading the request stream.
2. Parse JSON.
3. Run a recursive sensitive-key scan.
4. Validate against a strict schema.
5. Look up the collector token HMAC.
6. Check active/revoked collector state.
7. Check source and service allowlists.
8. Apply rate limits.
9. Check timestamp skew and normalize timestamps.
10. Write aggregate counters.
11. Return success without echoing raw event data.

Unknown fields are rejected.

`observedAt` values older than 15 minutes or more than 2 minutes in the future
are rejected. If omitted, the server uses its receive time.

Registration and heartbeat bodies use the same streaming size limit, JSON
parsing, sensitive-key scan, and strict schema validation. Registration is
rate-limited; heartbeat requires an active collector token and applies collector
and installation limits. Signal collector and installation limits are hard
limits; the service-wide guard is soft and does not reject otherwise valid
signals.

Signal, registration, and heartbeat errors use `{ ok: false, reason }`:

| HTTP status | Reason |
| --- | --- |
| `400` | `body_too_large`, `invalid_json`, `sensitive_payload`, `invalid_request`, or a failed allowlist/timestamp check |
| `401` | `missing_token` or `invalid_token` (signal and heartbeat) |
| `403` | `revoked_token` (signal and heartbeat) |
| `429` | `rate_limited`; the body also includes `retryAfterSeconds` |
| `500` | `internal_error` |
| `503` | `redis_unavailable` or `server_config_error` |

Oversized signal-family requests return `400` for compatibility. Limits and
responses for other endpoints are in the [development guide](development.md#request-limits).

## Sensitive Data Rules

The collection boundary excludes prompt text, messages, request or response
bodies and headers, credentials, cookies, source files and diffs, clipboard
content, exact IP addresses, account emails, machine names, and local usernames.

Reject payloads that include sensitive keys such as:

- `prompt`
- `message`
- `body`
- `request`
- `response`
- `headers`
- `authorization`
- `cookie`
- `apiKey`
- `token`
- `email`
- `diff`
- `fileContent`
- `filePath`
- `clipboard`
- `ipAddress`
- `accountEmail`
- `machineName`
- `username`
- exact key `code`

The exact key `code` is sensitive, but substrings such as `statusCode` and `errorCode` are allowed.

Allowed key names do not make arbitrary values safe. SDK normalizers must drop
an `errorCode` value when it resembles a credential, email address, username-
bearing path, or local file path. Raw provider errors and messages are never
sent for server-side redaction.

## SDK Signal Criteria

`recordAiCall` treats a wrapped provider call that throws as a failure signal.
It preserves the original return value or thrown error and submits Not Just You
signals best effort.

Common failure mapping:

- network or timeout errors -> `network_error`
- HTTP `429` or rate/quota error codes -> `rate_limited`
- HTTP `401` or `403` -> `auth_error`
- HTTP `5xx` -> `error`
- other classified HTTP errors -> `error`
- otherwise -> `unknown`

Provider-specific mapping:

- Anthropic overloaded/server errors -> `error`
- Anthropic auth, billing, permission, or credit errors -> `auth_error`
- Gemini quota/rate/resource exhausted errors -> `rate_limited`
- Gemini model unavailable, model not found, or bare `404` errors -> `model_unavailable`

Slow-call signals are opt-in. The SDK sends `slow` only when the caller passes
`slowAfterMs` and the wrapped call succeeds with `durationMs >= slowAfterMs`.
There is no default slow threshold.

Failure signals are locally coalesced for 30 seconds by service id, source,
symptom, status code, and sanitized error code. Slow signals are not coalesced.

Retryable deliveries keep one `signalId`. Server-side HMAC dedupe is short lived
and scoped to the collector, so retries do not inflate installed-signal counts
and unrelated collectors do not collide. Retry timers are best effort and do
not keep a short-lived Node process open.

## Display Rules

The UI can show exact counts because count volume is useful to users. The compact default can show a combined recent signal count, but source breakdown should remain visible by default:

- combined recent problem signal count
- community report counts
- installed signal counts
- official status outside the combined count

Detailed API, CLI, and MCP surfaces can expose approximate unique installation
counts when the extra metric is useful, but the compact dashboard should keep
the default installed-signal value to a single count.

Use wording that reflects confidence:

- `Recent problem signals`
- `Community reports`
- `Installed signals`
- `Reports increasing`
- `Likely degraded`
- `Official status reports degraded`

Avoid:

- `Confirmed down`
- `Definitely broken`
- `Officially down`, unless the exact official component reports an outage
