# @notjustyou/sdk-js

Node.js metadata-only SDK collector for Not Just You.

## Usage

Run setup once so the SDK can reuse the local collector config:

```sh
njy setup
```

Wrap an existing OpenAI SDK call:

```ts
import { recordAiCall } from "@notjustyou/sdk-js";

const response = await recordAiCall(
  { serviceId: "openai-api" },
  () => client.responses.create({ model: "gpt-5", input: "Hello" }),
);
```

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
