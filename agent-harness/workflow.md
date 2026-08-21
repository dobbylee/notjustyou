# Repository Workflow

This file defines the repository implementation loop. `AGENTS.md` owns product invariants, documentation ownership, remote-action boundaries, and baseline verification commands.

## Start

1. Inspect `git status --short --branch`.
2. Read `AGENTS.md` and `local-docs/plan.md` when the local router exists.
3. Read only the active task and references routed by that plan. Do not load `local-docs/archive/` by default.
4. State the scoped outcome, non-goals, acceptance checks, and any material assumptions.
5. Create a branch before changing tracked files.

## Implementation Loop

For non-trivial work:

1. Implement one reviewable slice.
2. Run focused checks for the changed surface.
3. Review the diff for scope, generated artifacts, secrets, and public/private documentation boundaries.
4. Run the independent review contract in `agent-harness/prompts/implementation-review.md`, including `git status`, the tracked diff, and every intended untracked file in the review input.
5. Fix findings and repeat focused checks and review until the result is exactly `No Findings`, unless the user accepts a documented residual risk.
6. Run the baseline verification owned by `AGENTS.md` plus any surface-specific checks.
7. Complete required manual or consumer-path checks. Record blockers instead of claiming unperformed validation.
8. Update the active local task with scope, runtime behavior, privacy impact, verification, and remaining work.

Documentation-only work may use a narrower check only when runtime behavior cannot change and the user accepts that narrower verification. Record why the full baseline was not needed.

## Remote Boundary

Local implementation, validation, review, and commits do not authorize remote changes. Pushes, pull requests, merges, package publication, deployment, marketplace submission, and public release require explicit user authorization.

After authorization, complete the requested remote workflow through final checks and confirm that the checked revision matches the delivered revision.

## Local Task Lifecycle

- `local-docs/plan.md` is a concise router for current state and the next slice.
- Store one active task under `local-docs/tasks/` with acceptance criteria and current evidence.
- Keep durable product decisions in tracked code, tests, and public design docs.
- Move completed local task notes to `local-docs/archive/tasks/` only when their evidence remains useful; otherwise delete them.
- Historical plans and finish logs are not prerequisites for new sessions unless the current plan links them explicitly.
