# ADR 0013 — Artifact processing runtime and persisted parser dispatch

## Status
Accepted for Sprint 04.

## Context
Sprint 03 made source polling and immutable artifact creation crash-safe through `artifact_processing_outbox`, but the production worker did not consume `ARTIFACT_PROCESSING_QUEUE`. The parser key carried in a BullMQ job is transport data and must not become a source of truth. Raw bytes must also be verified against the immutable artifact hash before any parser or canonical publisher sees them.

## Decision
1. `source_artifacts` is authoritative for artifact identity, source ownership, storage URI, SHA-256 and parser key.
2. A queue payload may select an artifact ID, but the worker reloads the artifact from PostgreSQL and rejects source/parser mismatches.
3. Artifact bytes are loaded from the configured S3-compatible bucket and SHA-256 is recomputed before dispatch.
4. Parser dispatch is an explicit registry keyed by the persisted `parser_key`; there is no format/content guessing and duplicate handler registrations are rejected at startup construction time.
5. Already `PUBLISHED` or `REVIEW_REQUIRED` artifacts short-circuit before storage reads and handlers. Re-delivery is therefore safe and cannot repeat canonical publisher side effects.
6. Deterministic identity/parser/checksum errors are `PermanentArtifactParseError` outcomes. They are audited as `PARSE_FAILED` and the BullMQ job resolves so the same bad artifact cannot retry forever.
7. Transient object-store/runtime errors are rethrown so BullMQ retry/backoff remains available.
8. `source_processing_attempts` and source health continue to be updated by the existing `processArtifactJob` boundary.

## Activation boundary
The consumer is wired into the production bootstrap behind `ARTIFACT_PROCESSING_ENABLED=false` by default. At this ADR's introduction the active pilot parser keys still require publisher work tracked separately:

- `pgk-koszalin-pdf-text` needs the automatic collection publisher/replacement semantics.
- `pgk-koszalin-pszok-html` needs multi-artifact bundle coordination.

Enabling the runtime before those handlers are registered would correctly produce `UNKNOWN_PARSER_KEY`, but that would be an operational rollout error rather than a source-data error. Sprint 04 issues #47 and #48 register the real handlers; deployment activation follows them.

## Consequences
- Queue messages cannot redirect an artifact to another source or parser.
- Object-store corruption is detected before normalization/publishing.
- Re-delivery is idempotent at the parser/publisher boundary.
- Parser support remains explicit and observable instead of inferred.
- The generic runtime can be integration-tested with PostgreSQL, Redis and MinIO independently of municipal parser implementations.
