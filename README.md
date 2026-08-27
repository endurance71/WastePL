# WastePL

WastePL is a vendor-neutral data layer for municipal waste collection in Poland. It normalizes fragmented public schedules and waste facilities into one auditable, versioned data model and API.

## PoC focus

- address → service area → collection schedule
- official-source provenance and freshness
- deterministic source adapters
- PRG / TERYT address normalization
- pilot municipalities around Koszalin

## Architecture

The PoC starts as a modular monolith: NestJS/Fastify API + BullMQ worker + shared domain contracts. PostgreSQL/PostGIS is the system of record; raw source artifacts are designed to be immutable and addressed by SHA-256.

## Repository contracts

- `schemas/wastepl-v0.1.schema.json` — normalized data contract
- `openapi/wastepl-v0.1.yaml` — HTTP API contract
- `db/migrations/0001_init.sql` — canonical database schema
- `docs/adr/` — architecture decisions
- `docs/sprint-01.md` — first sprint scope

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

Expected shape:

```json
{
  "status": "ok",
  "service": "wastepl",
  "time": "2026-08-27T15:00:00.000Z"
}
```

## Verification

```bash
pnpm contracts:check
pnpm build
pnpm typecheck
pnpm test
```

CI additionally starts PostGIS and Redis, applies the migration to an empty database, builds the monorepo, runs typechecks/tests and smoke-tests `/v1/health`.
