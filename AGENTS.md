# Repository Agent Guidance

## Start Here

- Treat this repository as fully public. Never commit secrets, private operational details, personal identifiers, or local machine paths.
- Before non-trivial work, inspect `git status`, read `agent-harness/workflow.md`, and read `local-docs/plan.md` when that ignored local file exists.
- Follow only the current task routed by `local-docs/plan.md`. Historical notes under `local-docs/archive/` are evidence, not active instructions.

## Execution Boundaries

- Make the smallest change that satisfies the requested outcome.
- Preserve existing contracts and naming unless the task explicitly changes them.
- Do not mix unrelated cleanup into a scoped change.
- Work on a branch for committed changes. Do not commit directly to `main`.
- Do not push, open a PR, merge, publish, deploy, submit a marketplace form, or otherwise change remote state without explicit user authorization.

## Product Invariants

Not Just You must remain privacy-safe and source-aware.

- Keep manual community reports, official provider status, and installed-client signals separate in storage, API contracts, tests, and backend aggregation.
- A presentation-only combined summary is allowed only when the source breakdown remains visible.
- Do not extend `/api/report` into automatic telemetry. Installed-client telemetry uses dedicated signal contracts and endpoints.
- Do not collect prompt text, messages, request or response bodies, headers, API keys, cookies, source files, diffs, clipboard content, exact IP addresses, account emails, machine names, or local usernames.
- If collected fields change, update the public data boundary and add focused tests in the same change.

## Documentation Ownership

- `README.md` is for product introduction, supported user surfaces, usage, and the public privacy boundary.
- `CONTRIBUTING.md` is the public contributor guide.
- `docs/development.md` owns local setup, self-hosting, scripts, deployment, and public API details.
- `docs/architecture.md` owns durable system boundaries.
- `docs/signals.md` owns signal contracts, validation, privacy rules, and display semantics.
- `agent-harness/workflow.md` owns the implementation, review, validation, and handoff loop.
- `agent-harness/prompts/implementation-review.md` owns the independent review contract.
- Ignored `local-docs/plan.md` routes current work; ignored task and archive notes must not be linked from public docs.

## Verification

Run focused checks while iterating. Before a PR, run the baseline repository verification unless the change cannot affect code and the user accepts a narrower check:

```bash
pnpm lint
pnpm test
pnpm run build
```

Also run relevant package, plugin, protocol, browser, or published-consumer checks for the changed surface. Record skipped checks and blockers explicitly.

## Review

For non-trivial changes, use an independent reviewer after focused checks and before baseline verification. Give the reviewer `git status`, the complete tracked diff, the full content of every intended untracked file, and `agent-harness/prompts/implementation-review.md`; do not ask it to modify files. A plain unstaged `git diff` is insufficient when the intended change contains untracked files. Address findings and repeat until the reviewer returns exactly `No Findings` or the user explicitly accepts a documented residual risk.

If an independent reviewer is unavailable or disallowed by the active tool policy, perform a structured direct review with the same prompt and record that limitation. Do not describe direct self-review as independent review.

## Commits And Pull Requests

- Use plain, user-visible or maintainer-visible commit and PR titles.
- Do not use Conventional Commit prefixes or internal phase names.
- Keep logical concerns in separate commits when they can be reviewed independently.
- PR bodies should summarize scope, verification, and privacy impact when relevant.
