# ADR-0009: Source scheduler leases and artifact processing outbox

## Status
Accepted

## Context
WastePL source ingestion must run continuously across many independent municipal/operator sources. A source can be slow, temporarily unavailable, return HTTP 304, return the same bytes under different HTTP metadata, or publish malformed content. Multiple worker instances may run concurrently and processes can terminate between database and Redis operations.

The last published canonical data is user-facing state. Source polling health is operational state. These must not be conflated: an upstream outage or parser regression must never delete or overwrite the last known good canonical dataset.

## Decision

### PostgreSQL owns scheduling state
`sources.next_check_at` determines whether an active source is due. Schedulers atomically claim due rows with `FOR UPDATE SKIP LOCKED` and a time-bounded UUID lease (`poll_claim_token`, `poll_claim_expires_at`).

A delayed BullMQ job carries that claim token. The ingestion worker verifies that it still owns the live lease before performing network I/O. An expired/reclaimed job is completed as `SKIPPED_STALE_CLAIM` without fetching.

This allows multiple scheduler/worker instances without leader election and prevents overlapping fetches for one source.

### Conditional HTTP is an optimization; SHA-256 is truth
ETag and Last-Modified are sent when available. HTTP 304 means unchanged and creates no artifact.

For HTTP 200 responses WastePL always hashes the bytes. `(source_id, sha256)` remains the immutable identity boundary. The same SHA creates no duplicate artifact regardless of ETag, Last-Modified or URL behavior.

### Artifact creation and downstream handoff are transactional
When a new immutable `source_artifacts` row is inserted, one `artifact_processing_outbox` row is inserted in the same PostgreSQL transaction.

The outbox dispatcher claims pending rows with `FOR UPDATE SKIP LOCKED`, enqueues a deterministic BullMQ job keyed by `artifact_id`, and marks the outbox row enqueued only after `queue.add()` succeeds. If the process dies after Redis accepted the job but before the DB acknowledgement, re-dispatch is safe because the queue job id is deterministic.

A 304 or duplicate SHA creates no outbox row, therefore no parse/normalize work.

### Retry is split by failure class
HTTP fetching performs a short in-process exponential retry for transient network/HTTP failures. If those attempts are exhausted, source health is set to `FETCH_FAILED` and `next_check_at` receives persistent exponential backoff. Permanent HTTP failures wait for the normal source polling interval.

Artifact-processing jobs use BullMQ retries for transient infrastructure failures. A deterministic parser/data failure is represented by `PermanentArtifactParseError`, persisted as `PARSE_FAILED`, and the queue job resolves without further retries. A later source SHA creates a new artifact and a new processing opportunity.

### Source health never replaces last-known-good data
Operational source state is stored separately from `last_sha256` and published canonical entities. Fetch failure and parse failure update health/error timestamps and counters only.

`last_sha256` changes only when bytes were successfully fetched and hashed. An unchanged fetch after a known `PARSE_FAILED` or `REVIEW_REQUIRED` artifact does not incorrectly reset the source to healthy.

Canonical publication/deactivation remains the responsibility of the domain-specific publisher/orchestrator and its transaction rules. The scheduler never deletes canonical data.

## Consequences
- horizontal scheduler/worker scaling is safe without a single leader;
- a process crash cannot lose a newly created artifact between PostgreSQL and Redis;
- unchanged content cannot trigger duplicate downstream work;
- source outages remain visible while users retain the last known good dataset;
- deterministic bad input does not create infinite retry loops;
- generic scheduling is decoupled from parser-specific orchestration, including multi-source bundles such as PGK Koszalin PSZOK main + FAQ.
