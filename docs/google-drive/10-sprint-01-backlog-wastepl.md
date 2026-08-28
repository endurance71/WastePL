<!-- Source: https://docs.google.com/document/d/1R5jWwtxeI0o_2diZdU2luoTNLMzgAEyqt4kWymhX0VU/edit -->
<!-- Local snapshot: 2026-08-28 -->

# 10 — Sprint 01 Backlog — WastePL

[Oryginał w Google Docs](https://docs.google.com/document/d/1R5jWwtxeI0o_2diZdU2luoTNLMzgAEyqt4kWymhX0VU/edit)

WASTEPL — SPRINT 01 BACKLOG
Sprint: 10 dni roboczych
Cel: pierwszy działający vertical slice „oficjalne źródło → artifact → parser → normalizacja → strefa → API” dla dwóch gmin pilotażowych.
Data planu: 27.08.2026


1. SPRINT GOAL
Na koniec Sprintu 01 użytkownik lub test automatyczny podaje adres z dwóch gmin pilotażowych i otrzymuje poprawny harmonogram z oficjalnym źródłem, datą pobrania i confidence.


Pierwsze dwie gminy rekomendowane do vertical slice:
• Koszalin — przewidywalne PDF-y sektorowe,
• Manowo — przewidywalne PDF-y/tabele i inny sposób grupowania obszaru.


Bobolice i Sianów celowo nie są pierwszymi wdrożeniami. Są dobrymi testami trudnych przypadków, ale powinny wejść po stabilizacji pipeline’u.


2. STACK STARTOWY
Architektura: modular monolith.
Runtime: Node.js + TypeScript.
API: NestJS z adapterem Fastify.
Baza: PostgreSQL + PostGIS.
Dostęp do DB: lekka warstwa query/repository; kanoniczne migracje SQL. Nie uzależniać domeny PostGIS od ograniczeń ORM.
Queue/jobs: Redis + BullMQ.
Object storage: S3-compatible; lokalnie MinIO, produkcyjnie provider S3-compatible.
Walidacja kontraktów: JSON Schema / OpenAPI.
Testy: unit + integration + golden-data.
Monorepo: pnpm workspaces; bez mikroserwisów w PoC.


3. PROPOZYCJA STRUKTURY REPO
/
  README.md
  package.json
  pnpm-workspace.yaml
  docker-compose.yml
  .env.example
  apps/
    api/
    worker/
  packages/
    domain/
    data-standard/
    source-sdk/
    test-fixtures/
  db/
    migrations/
      0001_init.sql
    seeds/
  schemas/
    wastepl-v0.1.schema.json
  openapi/
    wastepl-v0.1.yaml
  docs/
    adr/
      0001-modular-monolith.md
      0002-source-artifacts-immutable.md
      0003-service-area-rules.md
    sprint-01.md


4. BACKLOG P0 — MUSI WEJŚĆ DO SPRINTU


S1-001 — Bootstrap monorepo
Priority: P0
Estimate: 2 SP
Zakres:
• pnpm workspace,
• apps/api, apps/worker,
• packages/domain, packages/data-standard,
• TypeScript strict,
• lint/format/test scripts,
• .env.example,
• README uruchomieniowy.
Acceptance:
• pnpm install działa,
• pnpm test działa na pustym projekcie,
• oba apps startują lokalnie.


S1-002 — Local infrastructure
Priority: P0
Estimate: 3 SP
Zakres:
• docker-compose PostgreSQL/PostGIS,
• Redis,
• MinIO/S3 local,
• health checks,
• dev scripts.
Acceptance:
• docker compose up -d daje healthy stack,
• API łączy się z DB,
• worker łączy się z Redis i storage.


S1-003 — DB migration 0001_init.sql
Priority: P0
Estimate: 5 SP
Zakres:
• municipalities,
• localities,
• streets,
• addresses,
• service_areas,
• service_area_rules,
• sources,
• source_artifacts,
• waste_fractions,
• collection_events,
• facilities,
• change log.
Acceptance:
• migracja działa na pustej bazie,
• migracja jest idempotentnie zarządzana przez runner,
• podstawowe constraints i indeksy istnieją.


S1-004 — WastePL JSON Schema v0.1
Priority: P0
Estimate: 3 SP
Zakres:
• machine-readable schema,
• enumy frakcji/statusów,
• source provenance,
• data quality,
• service area coverage.
Acceptance:
• przykładowy poprawny dataset przechodzi walidację,
• co najmniej 5 negatywnych fixture’ów jest odrzucanych.


S1-005 — Source Registry
Priority: P0
Estimate: 3 SP
Zakres:
• CRUD wewnętrzny lub seed sources,
• municipality/source URL/format/parser/poll interval,
• reuse metadata,
• active flag.
Acceptance:
• źródła Koszalina i Manowa są zapisane,
• worker potrafi pobrać listę aktywnych sources do sprawdzenia.


S1-006 — Artifact fetcher + change detector
Priority: P0
Estimate: 5 SP
Zakres:
• HTTP fetch z timeout/retry,
• SHA-256,
• ETag/Last-Modified jeśli istnieją,
• immutable object storage,
• source_artifacts,
• brak ponownego parsowania przy identycznym hash.
Acceptance:
• pierwszy fetch tworzy artifact,
• drugi identyczny fetch nie tworzy duplikatu,
• zmieniony plik tworzy nową wersję.


S1-007 — PDF_TEXT table adapter v0
Priority: P0
Estimate: 8 SP
Zakres:
• adapter dla tekstowego PDF,
• ekstrakcja tabeli/miesięcy/dat/frakcji,
• parse report,
• parser_version,
• confidence per extraction.
Acceptance:
• fixture Koszalin i Manowo daje deterministyczny normalized output,
• parser nie korzysta z AI w happy path,
• przy brakujących komórkach zwraca REVIEW_REQUIRED zamiast zgadywać.


S1-008 — Normalizer collection events
Priority: P0
Estimate: 5 SP
Zakres:
• mapowanie nazw lokalnych frakcji na kody WastePL,
• daty ISO,
• deduplikacja,
• fingerprint,
• walidacja zakresu roku,
• link do artifactu.
Acceptance:
• normalized events spełniają JSON Schema,
• brak duplikatów tej samej frakcji/daty/strefy,
• każdy event ma provenance.


S1-009 — Service-area rule engine v0
Priority: P0
Estimate: 8 SP
Zakres:
• LOCALITY,
• STREET,
• NUMBER_RANGE,
• EXPLICIT_NUMBERS,
• EXCLUDE,
• priority + specificity.
Acceptance:
• engine wybiera dokładnie jedną strefę dla fixtures,
• konflikt zwraca AMBIGUOUS,
• brak match zwraca NOT_FOUND,
• żadnego „first match wins”.


S1-010 — Minimal address resolver
Priority: P0
Estimate: 5 SP
Zakres:
• import minimalnego wycinka TERYT/PRG dla pilota albo przygotowany fixture adresowy,
• normalization text,
• mapping locality/street/building number,
• score candidate.
Acceptance:
• minimum 30 adresów testowych rozwiązuje się jednoznacznie,
• błędna miejscowość nie przechodzi cicho do sąsiedniej gminy.


S1-011 — API /v1/health, /v1/addresses/resolve, /v1/collection
Priority: P0
Estimate: 5 SP
Zakres:
• implementacja zgodna z OpenAPI v0.1,
• validation wejścia,
• source + quality w odpowiedzi,
• error codes.
Acceptance:
• contract tests przechodzą,
• odpowiedź /collection ma address, municipality, serviceArea, events, source, quality.


S1-012 — Golden-data test pack
Priority: P0
Estimate: 5 SP
Zakres:
• 30 realnych adresów łącznie,
• oczekiwana strefa,
• oczekiwane najbliższe odbiory,
• referencja do oficjalnego źródła,
• test regression.
Acceptance:
• minimum 99% zgodności na danych objętych testem,
• każdy błąd jest klasyfikowany: parser/resolver/service-area/source.


5. BACKLOG P1 — JEŚLI P0 JEST ZIELONE


S1-013 — XLSX adapter baseline
Priority: P1
Estimate: 5 SP
Cel: przygotowanie adaptera na kolejne gminy bez mieszania go z PDF parserem.


S1-014 — HTML adapter baseline
Priority: P1
Estimate: 5 SP
Cel: DOM selector config + extraction fixtures.


S1-015 — Internal review queue
Priority: P1
Estimate: 5 SP
Cel: lista artifactów REVIEW_REQUIRED, diff stara/nowa wersja, approve/reject.


S1-016 — Basic observability
Priority: P1
Estimate: 3 SP
Cel: structured logs, request ID, source fetch metrics, parser duration, error rate.


S1-017 — Facilities/PSZOK endpoint skeleton
Priority: P1
Estimate: 3 SP
Cel: model i endpoint bez pełnej agregacji krajowej.


6. OUT OF SCOPE SPRINT 01
• aplikacja React Native,
• pełny panel gminy,
• mapa punktów kaucyjnych,
• AI/vision parser obrazów,
• scraping prywatnych endpointów konkurencji,
• wszystkie 8 gmin,
• realtime alerts/push,
• billing,
• publiczne API keys,
• mikroserwisy/Kubernetes.


7. DEFINITION OF DONE
Task jest Done, jeśli:
• kod/kontrakt ma testy,
• błędy są jawne, bez silent fallback,
• wszystkie dane harmonogramowe mają source_artifact_id,
• fixtures są w repo,
• dokumentacja startowa jest zaktualizowana,
• brak sekretów w repo,
• nowe źródło ma owner, URL, format, parser i reuse metadata,
• pipeline można odtworzyć lokalnie.


8. SPRINT ACCEPTANCE — GO/NO-GO
GO do Sprintu 02, jeśli:
• 2 gminy działają end-to-end,
• minimum 30 adresów w golden tests,
• >=99% poprawnych odpowiedzi dla objętych przypadków,
• identyczny artifact nie uruchamia ponownie parsera,
• zmiana artifactu tworzy wersję i diff,
• konflikt stref nie jest automatycznie rozstrzygany,
• API ujawnia źródło i freshness.


NO-GO / poprawka architektury, jeśli:
• reguły stref wymagają hardcodowania w kodzie dla każdej gminy,
• parser generuje daty przez heurystyczne zgadywanie,
• provenance ginie w normalizacji,
• address resolver nie potrafi odróżnić wyjątków numerowych,
• update źródła nadpisuje historię.


9. KOLEJNY SPRINT — WSTĘPNY KIERUNEK
Sprint 02: Polanów + Tychowo + Będzino, XLSX/HTML adaptery, review queue, rozszerzenie golden pack do 100 adresów.
Sprint 03: Sianów + Świeszyno + Bobolice, difficult-source pipeline, image/vision fallback i test zmian rejonów.
