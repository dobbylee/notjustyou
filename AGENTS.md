# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## 5. Repository Workflow

Use the repository workflow even for small changes unless the user explicitly asks otherwise.

- Work on a branch, open a PR, and merge through GitHub for committed changes.
- Do not commit directly to `main`.
- Do not use Conventional Commit prefixes in commit or PR titles. Avoid prefixes such as `feat:`, `fix:`, `docs:`, `chore:`, or `test:`.
- Do not put internal phase names in commit or PR titles.
- Title commits and PRs by the user-visible or maintainer-visible change.
- Good examples:
  - `Update Google surfaces and license holder`
  - `Add signal schema validation`
  - `Add Redis signal counters`
- Bad examples:
  - `docs: update README`
  - `Phase 1 signal schema`
  - `chore: cleanup`
- PR bodies should include Summary, Verification, and Privacy impact when relevant.

## 6. Product Boundaries

Not Just You must stay privacy-safe and source-aware.

- Treat the repository as fully public open source. Assume any committed code, docs, examples, test fixtures, logs, URLs, tokens, credentials, operational procedures, and comments can be read by anyone.
- Do not commit real secrets, private operational runbooks, private endpoint details, internal monitoring tokens, personal account identifiers, local machine paths, or security-sensitive instructions that would help misuse production systems.
- Public docs should be user-centered. `README.md` should explain what the project is, how to run it, what APIs exist at a product level, and the public privacy boundary. Do not use it as an implementation diary, QA log, private operations guide, or place to accumulate per-change manual test notes.
- Keep manual community reports, official status, and installed-client signals separate in storage, API contracts, tests, and backend aggregation.
- Do not extend `/api/report` into automatic telemetry.
- Add installed-client telemetry through dedicated signal contracts and endpoints.
- It is acceptable for the dashboard to show a unified "recent problem signals" summary, but it must preserve source breakdown such as community reports, installed signals, and official status.
- Do not collect prompt text, request or response bodies, headers, API keys, cookies, source files, diffs, clipboard content, exact IP addresses, account emails, or machine/user names.
- If a change adds or changes collected fields, document the data boundary and add focused tests.

## 7. Project Harness

Before implementation work expands, keep the harness current.

- `AGENTS.md` is the source for Codex and other LLM-agent behavior in this repository.
- `CONTRIBUTING.md` is the public contributor workflow.
- `.github/pull_request_template.md` is the PR checklist.
- `README.md` should remain useful to a first-time open-source user.
- `docs/architecture.md` and `docs/signals.md` hold durable public design notes.
- Run `pnpm lint`, `pnpm test`, and `pnpm run build` before PRs unless the change clearly cannot affect code and the user accepts a narrower check.
- Keep the baseline verification command list in this file only. Other documents should refer to `AGENTS.md` for baseline verification and list only additional focused tests, package checks, manual checks, skipped checks, blockers, or actual results.
