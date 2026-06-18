# Contributing

Not Just You is a privacy-safe status board for AI tools. Contributions should keep the project easy to run, easy to review, and explicit about data boundaries.

## Workflow

1. Create a branch from `main`.
2. Make the smallest change that solves the issue.
3. Run the relevant verification commands.
4. Open a pull request.
5. Merge through GitHub after review or explicit approval.

Do not commit directly to `main`.

## Commit And PR Titles

Use plain, content-focused titles.

Rules:

- Do not use Conventional Commit prefixes such as `feat:`, `fix:`, `docs:`, `chore:`, or `test:`.
- Do not include internal phase names in commit or PR titles.
- Describe the actual change.

Good examples:

- `Update Google surfaces and license holder`
- `Add signal schema validation`
- `Add Redis signal counters`
- `Show installed signal source breakdown`

Avoid:

- `docs: update README`
- `Phase 1 signal schema`
- `chore: cleanup`

## Verification

Run these before opening a PR when the change can affect code or documentation accuracy:

```bash
pnpm lint
pnpm test
pnpm run build
```

If a check is skipped, state why in the PR.

## Privacy And Data Boundaries

Manual community reports, official status, and installed-client signals have different trust levels and must stay separate in storage and API contracts.

Allowed UI behavior:

- Show a unified recent problem summary.
- Show exact counts when useful.
- Keep source breakdown visible.

Backend rule:

- Do not merge manual reports, official status, and installed-client signals into a single stored counter or API field.

Do not collect:

- prompts
- request or response bodies
- headers
- API keys
- cookies
- source files or diffs
- clipboard content
- exact IP addresses
- account emails
- machine names or local usernames

Any PR that adds or changes collected fields must document the field, explain why it is needed, and include focused tests.

## Documentation

Keep public documentation practical:

- `README.md` should help a new user understand and run the project.
- `docs/architecture.md` should describe durable system boundaries.
- `docs/signals.md` should describe signal contracts and privacy rules.
- `local-docs/` is ignored and may hold local research, planning notes, and temporary implementation plans.
