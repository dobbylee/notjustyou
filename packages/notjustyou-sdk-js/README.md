# @notjustyou/sdk-js

Node.js metadata-only SDK collector for Not Just You.

## Usage

Install the CLI and SDK:

```sh
npm install -g @notjustyou/cli
npm install @notjustyou/sdk-js
```

Run setup once with the CLI so the SDK can reuse the local collector config:

```sh
njy setup
```

The default setup allowlist is `openai-api`. To use the SDK with OpenAI,
Anthropic, and Gemini API calls from the same config, register all three API
services:

```sh
njy setup --service openai-api --service anthropic-claude-api --service google-gemini-api
```

Wrap an existing provider SDK call:

```ts
import { recordAiCall } from "@notjustyou/sdk-js";

const response = await recordAiCall(
  { serviceId: "openai-api" },
  () => callOpenAi(),
);
```

Supported `serviceId` values are `openai-api`, `anthropic-claude-api`, and
`google-gemini-api`.

The wrapper returns successful values unchanged and rethrows the original
provider error unchanged. Signal submission is best effort and never replaces
the wrapped call result.

Wrapped provider calls that throw produce failure signals. Successful calls
produce no signal unless `slowAfterMs` is configured.

## Setup Relationship

The SDK does not create collector tokens. It reads the local config written by
`njy setup` or `njy register` from the Not Just You CLI.

The SDK sends only when that config allows:

- `source: "api_middleware"`
- the runtime `serviceId`
- the configured Not Just You base URL

If config is missing, the service is not allowlisted, or a `baseUrl` override
does not match the config base URL, the SDK fails closed and does not send a
signal.

## Privacy Boundary

This package is Node/server-side only. It does not run in browsers, monkey-patch
global `fetch`, or proxy AI traffic.

The SDK sends only metadata for allowed collector configs:

- service id
- source `api_middleware`
- symptom
- observed time
- duration in milliseconds
- status code, when available
- short sanitized error code, when available
- random installation id
- configured collector client version

The random installation id is stored in local Not Just You config so repeated
signals from the same installation can contribute to unique-installation
aggregation and rate limits. Server aggregation stores only derived hashes, not
the raw installation id.

The SDK does not send provider request bodies, provider response bodies,
prompts, provider headers, provider API keys, cookies, source files, diffs,
clipboard content, raw provider error objects, or raw provider error messages.
Signal submission uses the local collector token as Not Just You collector auth.

## Slow Signals

Slow-call signals are opt-in:

```ts
await recordAiCall(
  { serviceId: "openai-api", slowAfterMs: 30000 },
  () => callOpenAi(),
);
```

Without `slowAfterMs`, successful calls do not submit a signal.

## Retry And Coalescing

Not Just You signal submission uses a bounded in-memory queue. The queue stores
only sanitized signal payloads, never provider errors, prompts, provider bodies,
provider headers, or tokens.

The SDK retries signal submission only. It never retries the wrapped AI API
call. Retryable signal failures use bounded attempts, exponential backoff with
jitter, and server `retryAfterSeconds` when present.

Repeated local failure signals are coalesced for 30 seconds by service id,
source, symptom, status code, and sanitized error code. Coalescing limits noisy
repeated failures without changing the wrapped call result.

## Diagnostics

Check local collector readiness with the CLI:

```sh
njy doctor
```

For local or self-hosted setups, pass the same base URL used during setup:

```sh
njy doctor --base-url http://localhost:3000
```

Preview a metadata-only signal fixture before wiring an app:

```sh
njy payload-preview --fixture ./signal.json
```

Build and inspect the package from a workspace checkout when developing this
repository:

```sh
pnpm --filter @notjustyou/sdk-js build
pnpm --filter @notjustyou/sdk-js pack --dry-run
```
