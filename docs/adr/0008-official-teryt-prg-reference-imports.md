# ADR-0008 — Official TERYT/PRG reference imports

## Status
Accepted for Sprint 03.

## Context
WastePL initially used a deliberately small pilot address slice. Real nationwide coverage must use official territorial/address identifiers without breaking service-area rules that already reference WastePL UUIDs.

TERYT and PRG serve different roles:
- TERC identifies territorial units;
- SIMC identifies localities and is treated as a stable official locality identifier;
- ULIC identifies a street-name entry in a locality relation and MUST NOT be treated as a globally unique street occurrence;
- PRG/idIIP identifies source address points and provides source geometry/status/version information.

## Decision
1. WastePL UUIDs remain internal stable primary keys.
2. Official identifiers are attributes/natural reconciliation keys, never replacements for WastePL UUIDs.
3. If a pilot street has `ulic = NULL` and exactly one same-locality/name match exists, ULIC import enriches that same row.
4. If a pilot address has `prg_id = NULL` and exactly one locality/street/building-number match exists, PRG import enriches that same row.
5. Ambiguous legacy matches are rejected into the import report rather than merged heuristically.
6. Street identity is `(locality_id, ulic)`, not `ulic` alone.
7. Rural PRG addresses may legitimately have no street.
8. PRG geometry carries an explicit CRS. Sprint 03 supports EPSG:4326 and EPSG:2180; PostGIS performs the transformation to canonical EPSG:4326. Unknown CRS is rejected.
9. Full-snapshot deactivation is scoped. PRG snapshot absence can deactivate only records already managed by PRG (`prg_id IS NOT NULL`) in the declared municipality scope. Legacy rows without official IDs are not removed by inference.
10. Deactivation is soft (`active=false`); history and downstream references are preserved.
11. Every import creates an auditable `reference_import_runs` record with source version, counts and rejected rows.
12. Fixture `idIIP` values/coordinates used in CI are explicitly deterministic test data. They validate format and behavior and are not presented as real production PRG facts.

## Consequences
- Existing service-area rule foreign keys survive migration from pilot data to official reference data.
- National TERYT/PRG batches can be imported idempotently.
- Source removals/changes are observable without destructive deletes.
- Resolver/API must ignore inactive addresses and municipalities.
- A future streaming GML/SHP/WFS reader can feed the same batch importer without changing database reconciliation semantics.
