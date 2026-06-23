# @notjustyou/cli

Command line status lookup and local collector setup for Not Just You AI service surfaces.

## Install

```bash
npm install -g @notjustyou/cli
```

You can also run it from a workspace checkout:

```bash
pnpm --filter @notjustyou/cli build
node packages/notjustyou-cli/dist/index.js status --base-url http://localhost:3000
```

## Usage

```bash
njy status
njy status openai-api
njy status openai-api --watch
njy status --base-url http://localhost:3000
njy setup
```

`status` reads public status summaries:

- `/api/summary`
- `/api/signals/summary`
- `/api/official`

`setup` registers an anonymous collector for future opt-in SDK collectors, writes the collector token to the local Not Just You config file, and runs a lightweight readiness check. The raw token is not printed.

The CLI does not submit reports or installed-client signals by itself.

## Advanced Diagnostics

```bash
njy register --source api_middleware --service openai-api
njy doctor
njy payload-preview --fixture ./signal.json
```

Repeat `--service` to allow one collector config to support multiple API SDK
adapters:

```bash
njy register --source api_middleware --service openai-api --service anthropic-claude-api --service google-gemini-api
```

`register` is the lower-level setup step. `doctor` checks public status reachability, local config, and collector token readiness. `payload-preview` validates a JSON fixture against the metadata-only signal boundary before any SDK collector sends similar data.

## Privacy Boundary

The CLI does not collect prompt text, request or response bodies, headers, API keys, cookies, source files, diffs, clipboard content, exact IP addresses, account emails, or machine/user names.

The local config stores only `baseUrl`, `collectorId`, `collectorToken`, allowed `source`, allowed service ids, client name, and client version. v1 stores the token in a local file with private file permissions; OS keychain storage is later work.
