# @notjustyou/cli

Read-only command line status lookup for Not Just You AI service surfaces.

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
```

The CLI reads public status summaries only:

- `/api/summary`
- `/api/signals/summary`
- `/api/official`

It does not submit reports or installed-client signals, and it does not require collector credentials.

## Privacy Boundary

The CLI does not collect prompt text, request or response bodies, headers, API keys, cookies, source files, diffs, clipboard content, exact IP addresses, account emails, or machine/user names.
