# Sprint 01 — vertical slice

**Duration:** 10 working days

**Goal:** official source → immutable artifact → deterministic parser → normalization →
service-area resolver → `/v1/collection` for Koszalin and Manowo.

## P0
1. Bootstrap workspace and local PostGIS/Redis/object storage.
2. Apply `0001_init.sql`.
3. Validate normalized output against JSON Schema v0.1.
4. Source Registry + fetcher + SHA-256 change detector.
5. PDF_TEXT table adapter with fixtures.
6. Collection normalizer and fraction mapping.
7. Service-area rule engine.
8. Minimal address resolver for pilot fixtures/PRG slice.
9. Implement health, address resolve and collection endpoints.
10. Golden-data pack: at least 30 real addresses.

## Acceptance
- two municipalities work end-to-end;
- >=99% correct results within the golden test scope;
- identical artifacts do not trigger duplicate parsing;
- changes are versioned and auditable;
- ambiguous coverage is not guessed;
- API always exposes provenance and quality metadata.

## Out of scope
Mobile app, full municipality panel, deposit map, image/vision parsing, billing,
microservices/Kubernetes.
