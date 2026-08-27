# ADR-0007: Atomic facility ingestion from source artifacts

Status: Accepted

## Context

WastePL already had independent building blocks for immutable source artifacts, facility parsing, v0.2 validation, source assertions and canonical reconciliation. Without a single transaction boundary, a failure between reconciliation and canonical finalization could leave partially published data.

The first production vertical is the pair of official PGK Koszalin PSZOK sources: the main PSZOK page and the FAQ. One artifact owns location/opening/access claims; the FAQ owns accepted-material and published-limit claims.

## Decision

A facility bundle is published through one PostgreSQL transaction:

1. exact immutable source artifacts already exist in `source_artifacts`;
2. adapter parses and v0.2-validates every entity in the bundle;
3. source-specific claims are upserted into `facility_source_assertions`;
4. the primary assertion is reconciled against canonical facilities;
5. secondary assertions are attached to the selected/created canonical identity;
6. canonical fields and per-claim artifact references are finalized;
7. source artifacts are marked `PUBLISHED` with the ingestion outcome added to `parse_report`;
8. only then is the transaction committed.

`PgFacilityReconciliationRepository` accepts either a Pool or an existing PoolClient. When a PoolClient is provided, it never opens a nested transaction.

## Idempotency

The same immutable artifacts may be replayed safely:

- source assertions are identified by `(source_artifact_id, fingerprint)`;
- an assertion already bound to the same canonical facility is reused;
- the adapter stable `facility.key` is checked before fuzzy reconciliation;
- replay returns `UNCHANGED` instead of creating another facility;
- immutable source artifacts are not duplicated.

A fingerprint is only a source-assertion deduplication key. It is not the durable public facility identity.

## Review-required data

Missing source-backed geometry is never repaired by guessed geocoding during ingestion.

For the current PGK bundle:

- Komunalna 5 has source-backed coordinates and can be published as a canonical facility;
- Na Skwierzynkę 2 is retained as a `REVIEW_REQUIRED` source assertion with `geom = NULL` until trusted coordinates are supplied.

Identity ambiguity produced by reconciliation also remains review-required and is never silently merged.

## Failure semantics

Any error after assertion persistence but before canonical finalization rolls back the entire publication transaction. The last known good canonical data therefore remains untouched.

Parsing/validation happens before publication. Parser audit metadata stays attached to the exact immutable artifacts, and successful publication appends canonical outcomes to `parse_report`.

## Consequences

- the worker can replay deterministic artifacts without duplicating pins;
- API provenance can be traced to SHA-256 + parser version;
- scheduler work in Sprint 03 can invoke one orchestration path rather than reimplementing publication logic;
- review operations can later promote missing/conflicting claims without destroying original source assertions.
