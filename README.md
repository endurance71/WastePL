# WastePL

WastePL is a vendor-neutral data layer for municipal waste collection in Poland.
It normalizes fragmented public schedules and waste facilities into one auditable,
versioned data model and API.

## PoC focus
- address → service area → collection schedule
- official-source provenance and freshness
- deterministic source adapters
- PRG / TERYT address normalization
- pilot municipalities around Koszalin

## Architecture
Start as a modular monolith: API + worker + shared domain contracts. PostgreSQL/PostGIS
is the system of record; source artifacts are immutable objects addressed by SHA-256.

## Repository contracts
- `schemas/wastepl-v0.1.schema.json` — normalized data contract
- `openapi/wastepl-v0.1.yaml` — HTTP API contract
- `db/migrations/0001_init.sql` — canonical database schema
- `docs/adr/` — architecture decisions
- `docs/sprint-01.md` — first sprint scope

## Local infrastructure
```bash
docker compose up -d
```

This bootstrap intentionally contains only the first vertical-slice skeleton. Source adapters,
PRG/TERYT import and production deployment are Sprint 01 work.
