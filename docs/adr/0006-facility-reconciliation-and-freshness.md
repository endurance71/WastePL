# ADR-0006: Facility reconciliation and freshness

**Status:** Accepted  
**Date:** 2026-08-27

## Context

The same PSZOK or deposit-return point can be published by a municipality, operator,
retailer or reviewed fallback source. WastePL must avoid duplicate pins without erasing
source-specific evidence or silently merging different facilities that happen to be close.

Operational state is more volatile than static identity. A historical `OPERATIONAL`
assertion must not survive indefinitely after its source freshness window expires.

## Decision

### Canonical facility vs source assertion

`facilities` remains the canonical consumer-facing entity. Every source-specific observation
is stored independently in `facility_source_assertions` and may point to one canonical
facility. One canonical facility can therefore retain many source assertions and provider IDs.

Source assertions are not overwritten when another source wins a conflict.

### Exact identity

Automatic reconciliation is strongest when a stable external `POINT` identity overlaps.
A shared `VENUE` identity is only equivalent when facility kind is also equal. `MACHINE`
identity alone never merges facilities.

### Candidate fingerprint

WastePL creates a deterministic candidate fingerprint from:

- facility kind;
- municipality TERC when known;
- normalized address;
- location rounded to roughly an 11 m grid;
- normalized facility name.

The fingerprint is a candidate-search aid, not a durable business identifier.

### Fuzzy matching

Without stable shared IDs, candidate scoring uses normalized address, name similarity and
geospatial distance. Matching is deterministic.

- high-confidence, unique, same-kind candidate -> automatic attachment;
- medium-confidence candidate -> review queue;
- different facility kinds can never fuzzy auto-merge;
- multiple plausible high-confidence canonicals -> review queue;
- weak candidates -> new canonical facility rather than a forced merge.

In particular an RVM and manual return point at the same store remain separate facilities.

### Review queue

`facility_reconciliation_reviews` stores candidate facility, score and reasons. A
`REVIEW_REQUIRED` assertion remains unattached until a review decision is made.

### Freshness

Each assertion stores separate TTLs for static data and operational status.
`facility_source_assertion_freshness` projects current/stale state dynamically.

A stale `OPERATIONAL` or `TEMPORARILY_UNAVAILABLE` assertion degrades to `UNKNOWN`.
The original source assertion is retained for audit; only its effective consumer-facing
meaning changes.

### Consumer API

When a canonical facility has source assertions, the facilities API uses source-assertion
freshness for operational state and surfaces assertion freshness in provenance. If no
assertions exist yet, legacy source-backed canonical data remains available for backwards
compatibility during the migration period.

## Consequences

- source-specific IDs are never lost;
- fuzzy matching can improve coverage without making low-confidence merges irreversible;
- review cases are measurable and auditable;
- stale telemetry cannot masquerade as a current machine/point status;
- future operator feeds can be added without changing canonical facility identity rules.
