# Signals

Signals are service-level observations used to help users understand whether an AI tool is having problems. Not Just You should preserve where each signal came from and avoid collecting user content.

## Source Families

Manual community reports, official status, and installed-client signals are separate families.

Manual community reports:

- submitted by a user pressing `Slow`, `Error`, or `Down`
- handled by `/api/report`
- summarized by `/api/summary`

Official status:

- fetched from provider status sources
- handled by `/api/official`
- displayed as a separate badge

Installed-client signals:

- planned opt-in metadata from SDK middleware, CLI hooks, plugins, browser extensions, MCP monitors, or local probes
- should use dedicated signal endpoints
- must not reuse `/api/report`
- v1 should start with API middleware and local tooling; browser extension and MCP monitor sources are future-capable schema values, not first implementation targets

## Planned Installed Signal Shape

The planned installed-client signal input is metadata-only:

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
}
```

`collectorId` should be derived from the collector token server-side, not accepted in the request body.

Collector token lookup keys should use a server secret based HMAC. Raw collector tokens should not be stored.

Installation ids should be random local ids. Server-side dedupe and approximate unique counts should store only a derived hash or HMAC, not the raw installation id.

## Validation Rules

Planned validation order:

1. Apply request size limit.
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

Unknown fields should be rejected.

`observedAt` should not be trusted blindly. The first implementation should reject stale values older than 15 minutes and reject values more than 2 minutes in the future.

Collector registration also needs abuse protection. Token and installation limits can be hard limits; service-wide aggregate guards should start as soft guards so an attacker cannot block legitimate signals for a service.

## Sensitive Data Rules

Reject payloads that include sensitive keys such as:

- `prompt`
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
- exact key `code`

The exact key `code` is sensitive, but substrings such as `statusCode` and `errorCode` are allowed.

## Display Rules

The UI can show exact counts because count volume is useful to users. The compact default can show a combined recent signal count, but source breakdown must remain visible through hover, focus, or tap:

- combined recent problem signal count
- community report counts
- installed signal counts
- approximate unique installation counts
- official status outside the combined count

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
