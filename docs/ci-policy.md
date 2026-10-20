# CI policy

WastePL CI (`.github/workflows/ci.yml`) runs on pull requests, on pushes to `main` and on manual dispatches. CodeQL (`.github/workflows/codeql.yml`) runs on pull requests targeting `main` and on pushes to `main`.

Feature work moves through short-lived branches and pull requests. `concurrency.cancel-in-progress` ensures that a newer update to the same PR supersedes an older verification run.

A successful verification run checks contracts, applies the database migration to a fresh PostGIS service, builds and type-checks all workspace packages, runs tests, and smoke-tests `GET /v1/health`.

## Branch protection

`main` is protected by the repository ruleset `protect-main` (Settings → Rules → Rulesets), which targets the default branch with enforcement `Active` and no bypass actors. Verified on 2026-10-20.

| Rule | Effect |
| --- | --- |
| Restrict deletions | `main` cannot be deleted. |
| Block force pushes | History on `main` cannot be rewritten. |
| Require status checks to pass | `verify` (ci) and `Analyze (javascript-typescript)` (CodeQL) must succeed before a change lands on `main`. Branches are not required to be up to date. |

Repository security settings (Settings → Advanced Security): secret scanning, push protection and Dependabot security updates are enabled.

Check names in the ruleset must match the job names reported on commits. If a workflow job is renamed, update the ruleset at the same time, or merges will wait forever on a check that never reports.

To inspect the effective rules:

```bash
gh api repos/endurance71/WastePL/rules/branches/main --jq '.[].type'
```
