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

## Validation Rules

Planned validation order:

1. Apply request size limit.
2. Parse JSON.
3. Run a recursive sensitive-key scan.
4. Validate against a strict schema.
5. Look up the collector token hash.
6. Check active/revoked collector state.
7. Check source and service allowlists.
8. Apply rate limits.
9. Normalize timestamps.
10. Write aggregate counters.
11. Return success without echoing raw event data.

Unknown fields should be rejected.

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

The UI can show exact counts because count volume is useful to users. It should still make provenance clear:

- community report counts
- installed signal counts
- approximate unique installation counts
- official status

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
