# Contributing

Not Just You is a privacy-safe status board for AI tools. Contributions should keep the project easy to run, easy to review, and explicit about data boundaries.

## Workflow

1. Create a branch from `main`.
2. Make the smallest change that solves the issue.
3. Run the repository verification required by `AGENTS.md`.
4. Open a pull request.
5. Merge through GitHub after review or explicit approval.

Do not commit directly to `main`.

## Commit And PR Titles

Use plain, content-focused titles.

Rules:

- Do not use Conventional Commit prefixes such as `feat:`, `fix:`, `docs:`, `chore:`, or `test:`.
- Do not include internal phase names in commit or PR titles.
- Describe the actual change.

Prefer a title such as `Add Redis signal counters` over an internal label such as
`Phase 1 signal schema`.

## Verification

Run `pnpm verify` for the baseline repository verification defined in
[AGENTS.md](AGENTS.md). Add the relevant checks from the
[verification matrix](docs/development.md#verification), including `pnpm test:redis`
for Redis Lua or atomic-write changes. If a check is skipped or narrowed, state
why in the PR.

## Development

For local setup, environment variables, self-hosting notes, workspace package commands, and the public API surface, read [docs/development.md](docs/development.md).

## Privacy And Data Boundaries

Follow the source-separation and public-data rules in [AGENTS.md](AGENTS.md) and the field contracts in [docs/signals.md](docs/signals.md). Changes to collected fields require a documented reason and focused privacy tests.

## Documentation

Use the documentation ownership map in [AGENTS.md](AGENTS.md). Keep product usage, contributor setup, architecture, and signal contracts with their respective audiences.
