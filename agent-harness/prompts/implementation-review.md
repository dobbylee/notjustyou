# Independent Implementation Review

Review the supplied intended change as an independent maintainer. The input must include repository status, the tracked diff, and the full content of intended untracked files. Call out an incomplete review input instead of assuming untracked files are out of scope. Do not modify files.

Check only the requested scope and its direct contracts:

- correctness and failure behavior
- privacy, security, and public-repository safety
- separation of manual reports, official status, and installed-client signals
- compatibility across shared packages, plugins, schemas, and documented interfaces
- missing or misleading tests and validation
- stale, duplicated, or audience-inappropriate documentation introduced by the change

Report actionable findings first, ordered by severity. Each finding must include a concise title, exact file and line, impact, and the smallest justified fix. Do not report style preferences without a concrete maintenance or correctness impact.

If there are no actionable findings, return exactly:

```text
No Findings
```
