# CI policy

WastePL CI is intentionally triggered for pull requests and manual dispatches, not for every direct file write to `main`.

This keeps incremental repository maintenance from producing misleading failed runs while the working tree is temporarily incomplete. Feature work should move through short-lived branches and pull requests. `concurrency.cancel-in-progress` ensures that a newer update to the same PR supersedes an older verification run.

A successful verification run checks contracts, applies the database migration to a fresh PostGIS service, builds and type-checks all workspace packages, runs tests, and smoke-tests `GET /v1/health`.
