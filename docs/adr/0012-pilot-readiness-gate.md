# ADR 0012: Deterministic self-updating pilot readiness gate

## Status
Accepted for Sprint 03 pilot.

## Context
Before adding municipalities or mobile UI, WastePL needs a repeatable proof that the current source pipeline is safe under unchanged data, changed data and source failure. A CI gate must not depend on municipal websites being reachable or stable at test time.

The current runtime has a deliberate durable boundary: source polling writes immutable `source_artifacts` and an `artifact_processing_outbox` row transactionally. Domain-specific publish paths are already protected separately by collection and facility golden E2E gates, but a single generic outbox consumer does not yet publish every supported data type.

## Decision
CI runs `pnpm pilot:readiness` only after the full test suite.

The readiness command:

- imports the eight pilot municipalities through the official TERYT importer using a deterministic pilot slice;
- synchronizes the real `pilot-koszalin-region@2026.1` source manifest;
- uses controlled repository fixtures instead of live network responses for every currently schedulable source;
- writes artifacts through the real MinIO artifact store and the real PostgreSQL Source Registry;
- proves a second unchanged run adds no artifact and is fully deduplicated;
- changes one source payload and proves exactly one new immutable artifact/outbox handoff is created for that source;
- simulates a retryable outage and proves source health changes while last-known-good published data remains intact;
- checks active canonical collection-event/facility duplicates, review queue counts and stale-source state;
- reads both golden reports produced by the preceding test suite and requires collection and facility correctness to remain at least 99%;
- always writes `apps/worker/test-results/pilot-readiness-report.json`, which CI archives even when the gate fails.

`PLANNED` manifest entries are coverage-only. They never receive deterministic payloads and must remain inactive with no parser key.

## Boundary of the proof
A PASS proves the current manifest → Source Registry → deterministic fetch → object store → immutable artifact → durable outbox path, source-health failure semantics, and the separately exercised downstream collection/facility golden publish/query contracts.

It does not claim that every `PLANNED` municipality is ingestible, nor that CI has contacted any municipal website. It also does not substitute for a future generic artifact-processing worker test once all data types share that runtime path.

## Consequences
The pilot gets one archived, machine-readable readiness artifact with explicit evidence rather than a collection of implicit green tests. Expanding coverage should require this gate to remain green and the report to continue describing unsupported sources honestly.
