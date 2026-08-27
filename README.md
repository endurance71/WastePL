# WastePL

WastePL is a vendor-neutral data layer for municipal waste collection in Poland. It normalizes fragmented public schedules and waste facilities into one auditable, versioned data model and API.

## PoC focus

- address → service area → collection schedule
- official-source provenance and freshness
- deterministic source adapters
- PRG / TERYT address normalization
- pilot municipalities around Koszalin

## Architecture

The PoC starts as a modular monolith: NestJS/Fastify API + BullMQ worker + shared domain contracts. PostgreSQL/PostGIS is the system of record. Raw source artifacts are immutable, content-addressed with SHA-256 and stored in S3-compatible object storage (MinIO locally).

The ingestion path is:

`source registry → conditional HTTP fetch → retry/timeout policy → SHA-256 → dedupe → immutable object store → source_artifacts → audit log`

ETag and Last-Modified are preserved when sources provide them. HTTP 304 and repeated identical content do not create a new artifact. Every fetch attempt, including failures, is recorded in `source_fetch_attempts`.

## Repository contracts

- `schemas/wastepl-v0.1.schema.json` — immutable Sprint 01 normalized data contract
- `schemas/wastepl-facility-v0.2.schema.json` — standalone PSZOK/deposit-return facility contract
- `openapi/wastepl-v0.1.yaml` — HTTP API contract
- `db/migrations/0001_init.sql` — canonical database schema
- `db/migrations/0002_source_ingestion_audit.sql` — ingestion audit/polling schema
- `db/migrations/0003_pilot_address_slice.sql` — TERYT-backed pilot address/service-area slice
- `db/migrations/0004_pilot_schedule_slice.sql` — fixture-derived pilot schedule/provenance slice
- `db/migrations/0005_golden_pilot_addresses.sql` — golden pilot address expansion
- `db/migrations/0006_facility_contract_v02.sql` — source-backed facility semantics
- `docs/adr/` — architecture decisions
- `docs/sprint-01.md` — first sprint scope

Facility contract v0.2 keeps `UNKNOWN` distinct from unavailable/closed, permits missing coordinates instead of fabricated pins, separates facility kind from accepted material/container capabilities, and requires provenance for structured hours, access claims and non-unknown operational status.

## Requirements

- Node.js 22+
- pnpm 10+
- Docker with Docker Compose for local infrastructure

## Local setup

```bash
cp .env.example .env
corepack enable
pnpm install
pnpm infra:up
pnpm db:migrate
```

Start the API and worker in separate terminals:

```bash
pnpm --filter @wastepl/api dev
pnpm --filter @wastepl/worker dev
```

Health check:

```bash
curl http://localhost:3000/v1/health
```

Resolve a canonical pilot address:

```bash
curl 'http://localhost:3000/v1/addresses/resolve?query=1%20Maja%203'
```

Get a collection schedule by free-text address:

```bash
curl 'http://localhost:3000/v1/collection?address=1%20Maja%203&from=2026-08-26&days=30'
```

The collection response always includes source URL/format and quality metadata (`verificationStatus`, `confidence`, `retrievedAt`, warnings). Ambiguous top-ranked service-area matches return HTTP 409 instead of silently selecting a schedule.

## Pilot data integrity

The pilot TERC/SIMC identifiers are loaded from official TERYT reference data. `prg_id` and unverified ULIC values remain `NULL` until WastePL imports them from an authoritative PRG/TERYT feed; the project does not fabricate official identifiers.

The schedule rows in migration `0004` are materialized from the deterministic Issue #3 regression fixtures and are explicitly marked `fixtureDerived` in `source_artifacts.parse_report`. They are suitable for the PoC vertical and CI, but are not represented as raw production downloads of the complete upstream PDFs.

## Verification

```bash
pnpm contracts:check
pnpm build
pnpm typecheck
pnpm test
```

CI starts PostGIS, Redis and MinIO, applies all pending migrations to an empty database, builds the monorepo, runs typechecks and unit/integration/E2E tests, verifies immutable object storage and smoke-tests `/v1/health`.
