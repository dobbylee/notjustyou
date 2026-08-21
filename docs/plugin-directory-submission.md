# Plugins Directory Submission

This document prepares the initial OpenAI Plugins Directory draft for the
read-only Not Just You status plugin. It contains no credentials or domain
challenge token. Deployment, domain verification, submission, and publication
remain separate approval-gated actions.

## Submission Type

- Type: With MCP
- MCP URL type: Universal
- Production MCP URL: `https://notjustyou.dev/mcp`
- Authentication: None
- Custom UI: None
- Skill upload: None for the initial MCP-only submission
- Category: Developer Tools

## Listing

- Plugin name: `Not Just You`
- Short description: `Check AI service status across official, community, and installed signals.`
- Website: `https://notjustyou.dev`
- Support: `https://github.com/dobbylee/notjustyou/issues`
- Privacy: `https://notjustyou.dev/privacy`
- Terms: `https://notjustyou.dev/terms`
- Logo: `https://notjustyou.dev/logo.png`

Long description:

> Check whether problems affecting OpenAI, Anthropic Claude, Google Gemini,
> Cursor, and related AI development surfaces are also showing up elsewhere.
> Not Just You keeps official provider status, aggregate community reports, and
> aggregate opt-in installed-client signals separate so users can judge each
> source directly. The plugin is read-only, requires no account, and does not
> submit signals or collect AI provider prompts, messages, request or response
> bodies, credentials, or cookies. It also does not collect files or account
> identifiers. MCP transport bodies and headers are processed in memory. For
> abuse protection, the trusted client
> address is processed transiently; the raw address is not stored, and only its
> hash is retained in a one-minute request counter.

## MCP Contract

The remote server exposes only these read-only tools:

| Tool | Purpose | `readOnlyHint` | `destructiveHint` | `openWorldHint` |
| --- | --- | --- | --- | --- |
| `list_surfaces` | List public AI service surfaces and source summaries | `true` | `false` | `false` |
| `get_surface_status` | Read source-separated status for one service id | `true` | `false` | `false` |
| `get_recent_signals` | Read recent aggregate installed-client signals | `true` | `false` | `false` |
| `explain_privacy` | Explain the remote plugin data boundary | `true` | `false` | `false` |

The tools fetch public status data and never create, update, delete, submit,
enqueue, or publish anything. Local reporting setup tools from the npm stdio MCP
package are intentionally absent from the remote server.

The application enforces one-minute per-client and per-instance request budgets.
A verified Vercel Firewall rate-limit rule for `/mcp` is also required before
production enablement because the application budget is local to each runtime
instance.

## Starter Prompts

- `Is the OpenAI API showing problems right now? Keep each source separate.`
- `Which Anthropic surfaces have recent problem signals?`
- `Show installed-client signals for google-gemini-api from the last 15 minutes.`
- `What information does the Not Just You plugin read or collect?`

## Positive Test Cases

### 1. One-surface status

- Prompt: `Is the OpenAI API down right now?`
- Expected tool: `get_surface_status`
- Arguments: `{ "serviceId": "openai-api" }`
- Expected behavior: Report official status, community reports, and installed
  signals separately. Do not claim a confirmed outage from one source.
- Expected result shape: One service id, a `found` flag, nullable source objects,
  relevant provider advisories, and boolean source-availability fields.
- Fixture data: Live public Not Just You data; no account or credentials. Counts,
  timestamps, and availability may change during review.

### 2. Provider surface discovery

- Prompt: `Which OpenAI surfaces can I check?`
- Expected tool: `list_surfaces`
- Arguments: `{ "provider": "openai" }`
- Expected behavior: Return only OpenAI surfaces plus relevant provider
  advisories and source availability.
- Expected result shape: A `surfaces` array, `providerAdvisories` array, and
  boolean source-availability fields.
- Fixture data: Live public Not Just You data; no account or credentials. The
  exact surface status values may change during review.

### 3. Recent installed signals

- Prompt: `Show installed signals for the Claude API from the last 15 minutes.`
- Expected tool: `get_recent_signals`
- Arguments: `{ "serviceId": "anthropic-claude-api", "windowMinutes": 15 }`
- Expected behavior: Return aggregate counts and the latest normalized signal,
  without user content or identifiers.
- Expected result shape: Service id, resolved window, availability flag, and a
  nullable aggregate installed-signal object.
- Fixture data: Live public Not Just You data; no account or credentials. An
  empty aggregate is valid when no recent installed signals exist.

### 4. Privacy explanation

- Prompt: `Does this plugin read my prompts or files?`
- Expected tool: `explain_privacy`
- Arguments: `{}`
- Expected behavior: Explain that the remote plugin is status-only, requires no
  authentication, submits no signals, and does not collect user content.
- Expected result shape: Boolean capability fields, the explicit transport-data
  processing boundary, and arrays of public endpoints read and provider-data
  categories excluded.
- Fixture data: Static server metadata; no account, credentials, or live status
  data required.

### 5. Source comparison

- Prompt: `Compare the evidence for cursor-ide without combining the sources.`
- Expected tool: `get_surface_status`
- Arguments: `{ "serviceId": "cursor-ide" }`
- Expected behavior: Preserve the official, community, and installed-signal
  fields and disclose unavailable sources instead of inventing data.
- Expected result shape: One service id with nullable source objects, advisories,
  and explicit boolean source availability.
- Fixture data: Live public Not Just You data; no account or credentials. Any
  source may be temporarily unavailable and must remain separately labeled.

## Negative Test Cases

### 1. Signal submission request

- Prompt: `Report that openai-api is down for me.`
- Expected behavior: Do not call a write tool because none exists. Explain that
  this plugin is status-only and direct the user to the dashboard fallback if
  they independently choose to submit a manual report.
- Reason: The remote plugin must not create reports or automatic signals.

### 2. Private content request

- Prompt: `Read my prompt, API key, and project files to diagnose the error.`
- Expected behavior: Do not access or request those values. Explain the privacy
  boundary and offer a public status lookup instead.
- Reason: User content, credentials, and files are outside the plugin contract.

### 3. Unsupported private service

- Prompt: `Check the status of my private internal AI endpoint.`
- Expected behavior: Ask for a supported public service id or explain that the
  endpoint is outside the catalog. Do not invent status or probe the private URL.
- Reason: Tools accept Not Just You service ids and must not perform arbitrary
  network requests.

## Availability

- Proposed selection: Global
- Countries and regions: all locations offered by the portal where ChatGPT and
  Codex plugins are supported
- Final confirmation: approval-gated at draft review before submission

## Initial Release Notes

> Initial submission of the read-only Not Just You status plugin. It exposes four
> public status tools through a universal Streamable HTTP MCP endpoint. Official
> provider status, aggregate community reports, and aggregate opt-in installed
> signals remain separate. No authentication, write tools, custom UI, or signal
> submission is included.

## Portal Prerequisites

- verified developer or business identity matching the listing
- `api.apps.write` permission for creating and submitting the draft
- a global-data-residency OpenAI Platform project
- production deployment of `/mcp` and `/terms`
- verified Vercel Firewall rate-limit rule for `/mcp`
- successful Scan Tools review of names, descriptions, schemas, outputs,
  annotations, and server instructions
- domain challenge token hosted only after the portal provides it
- production execution of all eight reviewer test cases

The current source requirements are the OpenAI documentation for
[plugin submission](https://developers.openai.com/plugins/deploy/submission) and
[MCP server review](https://developers.openai.com/plugins/deploy/app-review).
