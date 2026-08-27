# ADR-0004: Source-backed facility semantics

**Status:** Accepted  
**Date:** 2026-08-27

## Context

WastePL v0.1 already has a basic `facility` object and PostgreSQL `facilities` table, but
the model is too shallow for a trustworthy national PSZOK and deposit-return map.

A missing value must not be turned into a false operational claim. In particular:

- no published coordinates must not produce a fabricated map pin;
- no machine telemetry must not become `isWorking=false`;
- missing opening hours must not mean closed;
- a temporary outage is meaningful only with a source and observation timestamp;
- RVM and manual return are different facility kinds, while accepted container classes
  are separate capabilities.

## Decision

WastePL introduces a standalone, backwards-compatible **facility contract v0.2** while keeping
the normalized dataset contract v0.1 immutable and valid for existing producers. A future dataset
version may compose this facility contract after the facility ingestion/API vertical is proven.

### Facility identity

`key` is the stable WastePL record key in normalized data. PostgreSQL additionally stores
an optional `canonical_key` for the future cross-source canonical identity layer.

Provider identifiers are preserved as structured `externalIds` / `external_ids`. Mutable
attributes such as opening hours or operational status must never be part of identity.

### Location

`location` may be `null`. WastePL does not geocode or fabricate coordinates inside a
deterministic source adapter unless the coordinates themselves come from an accepted
source or a separately provenance-tracked geocoding workflow.

When coordinates are present, the facility contract requires `locationSourceKey`.

### Facility type vs accepted material

Facility type describes *how/what the point is* (`PSZOK`, `DEPOSIT_RVM`,
`DEPOSIT_MANUAL`, etc.).

Capabilities describe *what it accepts*:

- PSZOK/material facilities use `acceptedMaterials`;
- deposit-return facilities use `acceptedContainers`;
- RVM/manual points require at least one accepted container class;
- PSZOK does not use deposit-container capabilities.

### Opening hours

Structured opening hours carry an explicit timezone and source. WastePL does not expose
or persist an `openNow` claim from absent or unstructured hours.

### Operational status

Operational state is one of:

- `OPERATIONAL`
- `TEMPORARILY_UNAVAILABLE`
- `UNKNOWN`

`UNKNOWN` means no current source-backed assertion. It is not equivalent to unavailable.

`OPERATIONAL` and `TEMPORARILY_UNAVAILABLE` require both an observation timestamp and
source provenance. PostgreSQL enforces the same invariant.

### Access rules

Access scope is structured as `OPEN_TO_ALL`, `MUNICIPALITY_RESIDENTS`,
`MUNICIPALITY_PROPERTY_OWNERS`, `OTHER`, or `UNKNOWN`. Any non-unknown access claim must
have source provenance. Unsupported restrictions stay in source-backed notes instead of
being guessed into structured fields.

## Consequences

- v0.1 remains available unchanged.
- facility v0.2 can represent official PSZOK records even when coordinates/status are missing.
- later geospatial APIs must omit/null-handle facilities without trusted coordinates.
- live RVM telemetry remains optional and provider-specific.
- cross-source deduplication can be built on canonical/external identity without mixing
  operational state into the fingerprint.
