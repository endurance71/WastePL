# ADR 0011: Versioned municipal source manifests

## Status
Accepted for Sprint 03 pilot.

## Context
WastePL needs repeatable source coverage across municipalities without turning application configuration into a second territorial registry or claiming parser support that does not exist.

Official municipality identity already comes from the TERYT-backed `municipalities` table. Source discovery is a different concern: URLs, formats, parser support, cadence and provenance change independently and need reviewable version history.

## Decision
WastePL stores pilot source configuration in versioned JSON manifests validated by `source-manifest-v0.1.schema.json` plus semantic checks.

Each municipality is referenced by its official seven-digit TERC. Manifest sync fails before source writes when any referenced TERC is absent from the official municipality backbone; the manifest never creates municipalities.

Each source has a stable `key`, official HTTPS URL, data type, source format, owner, polling cadence, reuse/provenance notes and optional active date range.

`ACTIVE` means WastePL has an explicitly allowlisted parser compatible with the declared format. `PLANNED` means the official entry point is known but ingestion support is not implemented; sync always persists such entries with `active=false` and no parser key.

Source registry identity is preserved across idempotent syncs by `source_key`. Existing rows may be adopted by matching official URL when they do not already belong to a different source key. Key/URL collisions across separate rows are rejected rather than merged heuristically.

Coverage reports are scoped to an exact `manifestId@version` and group registry state by municipality and data type. `manifest_status=ACTIVE` and `sources.active=true` are deliberately reported separately so date-window-disabled sources are not described as schedulable.

## Consequences
The pilot can truthfully describe planned national coverage before every adapter exists, while the scheduler only sees supported, currently active sources. Changes to source discovery become reviewable repository diffs rather than ad-hoc database edits.

Adding a new active source requires both parser implementation and manifest validation support. Adding a municipality requires the official territorial import first.
