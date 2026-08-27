# ADR-0010 — Internal data-ops review workflow

## Status
Accepted for Sprint 03 / Issue #31.

## Decision
WastePL keeps ambiguous identity matches and data-quality defects out of the public canonical path until an explicit data-ops decision is recorded.

Two queues are retained:

1. `facility_reconciliation_reviews` — one assertion versus one existing canonical candidate, with score and reasons.
2. `facility_data_quality_reviews` — source-backed problems without a canonical candidate, such as missing trusted geometry.

All explicit decisions append to `review_decision_audit` with actor, timestamp, decision, note and a decision-time snapshot. Source assertions are never deleted by review actions.

Reconciliation approval attaches an assertion to exactly one candidate in a PostgreSQL transaction. Other pending candidates for the same assertion are rejected in that transaction. Rejection never modifies the candidate facility.

Missing-geometry approval requires coordinates plus an existing source artifact id. It updates the assertion only and moves it back to `UNMATCHED`; it does not create a canonical facility directly. Normal reconciliation/publish logic remains the only canonicalization path.

## API boundary
Review operations live only under `/internal/v1/reviews` and are documented in a separate `openapi/wastepl-internal-v0.1.yaml` contract. Runtime requests require `x-wastepl-admin-key` and an `x-wastepl-actor` audit identity.

The public WastePL OpenAPI contract intentionally contains no data-ops mutation endpoints.

## Consequences
- Ambiguous data has an explicit operational lifecycle instead of manual SQL edits.
- Every human/service decision is queryable after the fact.
- Approval cannot destroy source provenance.
- Geometry is not silently fabricated to publish a map pin.
- The temporary admin-key boundary can later be replaced by IAM/RBAC without changing review transaction semantics.
