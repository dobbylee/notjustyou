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
njy enable claude-code
njy enable cursor
njy enable antigravity-cli
njy enable antigravity
njy enable antigravity-ide
njy disable claude-code
njy disable cursor
njy disable antigravity-cli
njy disable antigravity
njy disable antigravity-ide
```

`status` reads public status summaries:

- `/api/summary`
- `/api/signals/summary`
- `/api/official`

`setup` registers an anonymous collector for future opt-in SDK collectors,
writes the collector token to the local Not Just You config file, and runs a
lightweight readiness check. Raw collector tokens and collector ids are not
printed.

`enable claude-code`, `enable cursor`, and `enable antigravity-*` opt in to
metadata-only local hook reporting, write a `cli_hook` collector config, and
start the local hook receiver in send mode. Use the matching `disable` command
to turn that local hook sending off.

Guided local hook setup stores enabled agent surfaces in one local config. Each
`enable` or setup MCP flow changes only the confirmed surface while preserving
other already-enabled Claude Code or Cursor surfaces. Within the Antigravity
family, enabling one surface replaces any other active Antigravity surface
because the Antigravity hook cannot safely disambiguate multiple Antigravity
service ids. The matching `disable` command removes only that surface. Codex
remains status-only.

The CLI does not submit reports or installed-client signals unless an opt-in
collector path is enabled.

## Request Failures

Requests to the public Not Just You APIs have a 10-second deadline, including
reading the response body. The CLI does not automatically retry a failed
status, registration, heartbeat, or signal submission request.

`status` fetches the three source summaries concurrently. Community summary
failure makes the status check fail. Official-status or installed-signal
failure leaves that source unavailable while preserving the other results.
A timeout follows the same rules as any other failed request.

This deadline applies to Not Just You API requests; it does not limit your AI
provider calls or set the polling interval for `--watch`.

## Advanced Diagnostics

```bash
njy register --source api_middleware --service openai-api
njy register --source cli_hook --service anthropic-claude-code --enable-local-hooks
njy register --source cli_hook --service cursor-ide --enable-local-hooks
njy register --source cli_hook --service google-antigravity-cli --enable-local-hooks
njy enable cursor
njy doctor
njy payload-preview --fixture ./signal.json
```

Repeat `--service` to allow one collector config to support multiple API SDK
adapters:

```bash
njy register --source api_middleware --service openai-api --service anthropic-claude-api --service google-gemini-api
```

`register` is the lower-level setup step. It also avoids printing raw collector
tokens or collector ids. `doctor` checks public status reachability, local
config, and collector token readiness. `payload-preview` validates a JSON
fixture against the metadata-only signal boundary before any SDK collector sends
similar data.

## Privacy Boundary

The CLI does not send prompt text, request or response bodies, headers, API
keys, cookies, source files, diffs, clipboard content, exact IP addresses,
account emails, or machine/user names.

If local hook reporting is enabled, a local adapter may receive vendor hook
payloads in memory to derive metadata-only signals. Raw vendor payload fields
are not stored, queued, logged, or sent to Not Just You.

The local config stores a config version, `baseUrl`, `collectorId`,
`collectorToken`, allowed `source` and service ids, client name, and client
version. Hook configuration also records the sending opt-in and local receiver
token. The SDK may add a random installation id to the same file. Tokens are
stored with private file permissions; OS keychain storage is later work.

Opt-in hook configs also contain a separate random localhost receiver token.
Hook adapters use it only to authenticate local `/health` and `/hook` requests;
it is never sent to the public Not Just You API. Existing hook configs are
upgraded with this token the next time reporting is enabled.

On macOS and Linux, `doctor` requires private `0600` config permissions. Windows
does not expose equivalent POSIX owner/group/other mode bits, so `doctor` checks
the readable config and collector readiness without treating the missing POSIX
mode as a failure.
