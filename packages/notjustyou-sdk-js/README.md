# @notjustyou/sdk-js

Node.js metadata-only SDK collector for Not Just You.

## Usage

Run setup once so the SDK can reuse the local collector config:

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
  () => client.responses.create({ model: "gpt-5", input: "Hello" }),
);
```

Supported `serviceId` values are `openai-api`, `anthropic-claude-api`, and
`google-gemini-api`.

The wrapper returns successful values unchanged and rethrows the original
provider error unchanged. Signal submission is best effort and never replaces
the wrapped call result.

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
- SDK client version

The SDK does not send request bodies, response bodies, prompts, headers, API
keys, cookies, source files, diffs, clipboard content, raw provider error
objects, or raw error messages.

## Slow Signals

Slow-call signals are opt-in:

```ts
await recordAiCall(
  { serviceId: "openai-api", slowAfterMs: 30000 },
  () => client.responses.create({ model: "gpt-5", input: "Hello" }),
);
```

Without `slowAfterMs`, successful calls do not submit a signal.

## Retry And Coalescing

Not Just You signal submission uses a bounded in-memory queue. The queue stores
only sanitized signal payloads, never provider errors, prompts, bodies, headers,
or tokens.

The SDK retries signal submission only. It never retries the wrapped AI API
call. Retryable signal failures use bounded attempts, exponential backoff with
jitter, and server `retryAfterSeconds` when present.

Repeated local failure signals are coalesced for 30 seconds by service id,
source, symptom, status code, and sanitized error code. Coalescing limits noisy
repeated failures without changing the wrapped call result.
