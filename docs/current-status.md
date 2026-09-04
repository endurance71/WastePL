# Bieżący status WastePL

> Zweryfikowano: 2026-09-04, commit `6cc1609cf42eedf5f24e969a37bdb4430cd1cef2`. Stan odnosi się do `main` oraz manifestu `pilot-koszalin-region@2026.13`.

## Executive summary

WastePL ma działającą i dobrze przetestowaną regionalną platformę danych, 17 aktywnych źródeł w 8 gminach pilota, pierwszą konsumencką PWA oraz audytowaną próbkę 415 realnych adresów PRG. Projekt **nie jest jeszcze gotowym produkcyjnie systemem ogólnopolskim**.

Najważniejsze nierozstrzygnięte obszary to:

1. brak pełnego census pokrycia wszystkich adresów PRG w 8 gminach;
2. brak potwierdzonego ręcznego live-source soak 17/17 na bieżącym `main`;
3. brak branch protection na `main`;
4. brak deploymentu staging/production i real-user pilota;
5. PWA wymaga domknięcia Lighthouse/a11y gate oraz testów offline/error.

## Jak czytać coverage

Od tego dokumentu obowiązują trzy rozdzielone pojęcia:

- **municipality source presence** — gmina ma co najmniej jeden aktywny zakres harmonogramu danego typu;
- **address coverage** — udział wszystkich oficjalnych adresów PRG w pilocie, dla których WastePL potrafi jednoznacznie zwrócić właściwy harmonogram;
- **audited-address correctness** — poprawność na jawnie zdefiniowanej próbce audytowej.

**8/8 gmin z ACTIVE collection source nie oznacza 100% address coverage.** W części gmin aktywne są bezpieczne podzbiory miejscowości lub zakresów, podczas gdy szersze źródła pozostają `PLANNED`.

## Stan pilota `2026.13`

| Miara | Stan | Interpretacja |
| --- | ---: | --- |
| Gminy w manifeście | **8** | Koszalin, Manowo, Bobolice, Świeszyno, Tychowo, Sianów, Polanów, Będzino. |
| Gminy z >=1 ACTIVE collection scope | **8/8** | Municipality source presence = 100%. Nie jest to pełne pokrycie adresów. |
| Gminy z ACTIVE PSZOK | **8/8** | Każda gmina pilota ma aktywny stacjonarny punkt PSZOK. |
| ACTIVE source identities | **17** | 9 źródeł collection + 8 PSZOK. |
| Pełne address coverage pilota | **1,66% (415 / 25 030)** | Wynik pierwszego Address Coverage Census (zob. [raport Census](reports/address-coverage-census.md)). |
| Audytowane realne adresy PRG | **415/415 PASS** | 100% poprawności w audytowanej próbce; nie denominator całego regionu. |
| Formalny historyczny real-100 | **100/100 PASS** | Koszalin 9, Manowo 46, Tychowo 45. |
| Polanów Garbno | **39/39 PASS** | Bezpieczny aktywny subset. |
| Będzino Dworek | **13/13 PASS** | Bezpieczny aktywny subset. |
| Sianów Grabówko | **31/31 PASS** | Bezpieczny aktywny subset. |
| Świeszyno Chałupy | **167/167 PASS** | Bezpieczny aktywny subset. |
| Bobolice Kłanino | **65/65 PASS** | Bezpieczny aktywny subset. |
| Trusted PSZOK geocoding | **8/8** | Punkty mają zweryfikowane współrzędne w warstwie referencyjnej PRG/GUGiK. |
| Live-Source gate code | **17/17 covered** | Gate jest skonfigurowany dla całej aktywnej floty `2026.13`. |
| Aktualny live-source soak 17/17 | **SKONFIGUROWANY** | Skonfigurowano automatyczny codzienny cron 04:00 UTC z alertowaniem w GitHub Actions. |
| Consumer PWA | **DZIAŁA / PRE-PRODUCTION** | React 19 + Vite + service worker, address flow, harmonogram, provenance, PSZOK i mapa. |
| Playwright E2E | **78/78 PASS** | Pełny multi-device suite (Desktop Chrome, Pixel 5, iPhone 14) + audyt a11y WCAG 2.2 AA. |
| PWA installability assets | **KOMPLETNE** | PWA ikony 192/512, maskable 512, apple-touch 180, favicon svg/ico wgrane do `apps/pwa/public`. |
| Powiadomienia | **KOMPLETNE** | VAPID/Web Push: backend subscription storage, scheduled push worker, service worker delivery. Alarmy `.ics` zachowane jako alternatywa. |
| Branch protection `main` | **WYŁĄCZONE** | `main` w prywatnym repozytorium GitHub Free; CI zabezpieczone przez `--frozen-lockfile`. |
| Production blueprint | **GOTOWY** | `docker-compose.prod.yml`, pinned images, isolated network, persistent volumes. |
| Automated DB backup | **GOTOWY** | `pnpm db:backup` — pg_dump via docker, SHA-256 checksum, metadata JSON. |
| Deployment runbook | **GOTOWY** | `docs/runbooks/staging-production-deployment.md` — pełna procedura deploy/DR. |
| Observability | **GOTOWE** | Structured JSON logs, `x-request-id`, health check z DB ping (`SELECT 1`). |
| Security hardening | **GOTOWE** | Rate limiter (120 req/min/IP), HSTS, `nosniff`, `X-Frame-Options: DENY`, CORS. |
| Feedback API | **GOTOWE** | `POST /v1/feedback/schedule-discrepancy`, migracja `0018_feedback.sql`. |

## Dane i architektura — co jest już mocne

Sprinty 01–06 zbudowały:

- Source Registry i wersjonowane manifesty;
- conditional fetch, immutable source artifacts i SHA-256 dedupe;
- scheduler/outbox oraz BullMQ runtime;
- deterministyczny parser dispatch;
- transakcyjne publikowanie harmonogramów;
- temporalną historię danych;
- facility reconciliation i bundle coordination;
- TERYT/PRG backbone;
- publiczne i wewnętrzne API;
- source health/review workflow;
- fixture-independent production gates;
- onboarding metrics;
- cienką PWA z mapą PSZOK i obsługą `.ics`;
- scheduled Web Push notifications (VAPID, subscription storage, push worker, SW delivery);
- Playwright E2E;
- structured observability (JSON logs, `x-request-id`, health + DB ping);
- security hardening (rate limiter, HSTS, nosniff, X-Frame-Options, CORS);
- production blueprint (docker-compose.prod, automated DB backup, deployment runbook);
- feedback API (`POST /v1/feedback/schedule-discrepancy`).

Schemat PostgreSQL/PostGIS zachowuje provenance, temporalność, confidence/verification oraz geospatial indexes. To jest obecnie najmocniejsza część projektu.

## Zakresy aktywne nie są pełnym pokryciem gmin

Ważne przykłady:

- **Polanów** — aktywny bezpieczny zakres Garbno; pozostałe zakresy wymagają osobnego dowodu i mapowania;
- **Będzino** — aktywny bezpieczny zakres Dworek/Trasa I; nie oznacza automatycznie całej gminy;
- **Sianów** — aktywny bezpieczny zakres Grabówko; parent source z ogólną semantyką segregowanych odpadów nie może być rozszerzany bez dowodu;
- **Świeszyno** — audytowany zakres Chałupy;
- **Bobolice** — audytowany zakres Kłanino; parent/full source pozostaje osobnym problemem coverage.

Z tego powodu kolejną metryką nadrzędną ma być **udział wszystkich adresów PRG obsługiwanych jednoznacznie**, a nie liczba ACTIVE sources.

## Live-source staging

Runbook `docs/runbooks/live-source-staging-gate.md` opisuje gate dla 17 ACTIVE sources w `2026.13`.

Historycznie wykonano poprawny live soak dla wcześniejszego manifestu `2026.6` i 10 aktywnych źródeł. Po rozszerzeniu floty do 17 źródeł sam fakt, że kod gate'a przechodzi deterministyczne CI, **nie jest dowodem**, że wszystkie 17 bieżących upstreamów zostało pobranych i ręcznie przejrzanych na aktualnym `main`.

Definition of Done dla aktualnego soaka:

1. `workflow_dispatch` z aktualnego `main`;
2. outcome dla wszystkich 17 ACTIVE source identities;
3. brak nierozstrzygniętych `FETCH_FAILED`, `PARSE_FAILED`, `WAITING_FOR_COMPANION` i krytycznego `REVIEW_REQUIRED`;
4. ręczny review JSON/Markdown artifact;
5. zapis run ID i commit SHA w tym dokumencie dopiero po rzeczywistym wykonaniu.

## Consumer PWA

PWA jest działającym thin clientem, ale jeszcze nie produktem produkcyjnym.

Obecne możliwości:

- wyszukiwanie i wybór adresu przez WastePL API;
- najbliższe odbiory i kolejne terminy;
- source/provenance/freshness w odpowiedzi;
- PSZOK i mapa Leaflet/OpenStreetMap dla trusted location;
- local storage wybranego adresu;
- service worker i cache runtime;
- eksport kalendarza `.ics`;
- scheduled Web Push notifications (VAPID, backend subscription, push worker, SW delivery);
- Web Notifications API do permission/test notification;
- komplet ikon installability (192/512, maskable 512, apple-touch 180, favicon svg/ico);
- Playwright E2E (78/78 PASS, Desktop Chrome, Pixel 5, iPhone 14) + audyt a11y WCAG 2.2 AA.

Pozostałe braki przed publicznym pilotem:

- Lighthouse performance gate (automatyczny threshold);
- testy offline/stale/error na real-browser matrix;
- production deployment i telemetry.

## Powiadomienia — obowiązująca semantyka

System powiadomień Web Push jest w pełni zaimplementowany (commit `942a887`).

Obecne możliwości:

- browser notification permission — **tak**;
- test notification — **tak**;
- alarmy w wygenerowanym `.ics` — **tak**;
- przechowywanie preferencji lokalnie — **tak**;
- backend subscription storage — **tak** (migracja `0017_push_subscriptions.sql`);
- scheduler/queue wysyłki push — **tak** (`push-notification-service.ts`, `dispatchForDate`);
- VAPID/Web Push sender — **tak** (endpoint `/v1/notifications/vapid-public-key`, subscribe/unsubscribe);
- service-worker `push` delivery — **tak** (`custom-sw.js`, event handler `push`);
- self-healing: automatyczne czyszczenie nieaktualnych subskrypcji (HTTP 404/410) — **tak**.

`.ics` pozostaje alternatywną ścieżką reminderów dla użytkowników preferujących import do kalendarza.

## Onboarding economics

Machine-readable źródła prawdy:

- `schemas/onboarding-metrics-v0.1.schema.json`;
- `metrics/onboarding/pilot-koszalin-region-v0.1.json`;
- `metrics/onboarding/pilot-koszalin-region-summary-v0.1.json`;
- `scripts/check-onboarding-metrics.mjs`.

Stan przez `2026.13`:

| Miara | Wynik |
| --- | ---: |
| Activation records | **16** |
| Prospective records | **10** |
| Historical backfill records | **6** |
| First-import automation | **15/16 = 93,75%** |
| Repeat-update automation | **3/3 = 100%** |
| Adapter reuse inny niż `NEW_ADAPTER` | **11/16 = 68,75%** |
| Human-effort observations | **60/96 = 62,50%** |
| Fully measured records | **10** |

Próbka repeat-update i human-effort jest nadal zbyt mała do wiarygodnej ekstrapolacji na cały kraj. Brakuje przede wszystkim rzeczywistego miesięcznego maintenance/source-ops cost per municipality/source.

## Repo i CI

`main` na moment weryfikacji nie ma aktywnej ochrony branch protection. Oznacza to, że zielony CI nie jest technicznie wymuszony przed merge. Issue `#84` pozostaje P0 do zamknięcia.

Dodatkowe hardening backlog:

- `pnpm install --frozen-lockfile` w CI — **✅ zrobione**;
- przypięte wersje obrazów infrastrukturalnych zamiast `latest` — **✅ zrobione** (`docker-compose.prod.yml`);
- structured JSON logs i request tracing — **✅ zrobione** (`logger.middleware.ts`, `x-request-id`);
- rate limiting — **✅ zrobione** (`rate-limiter.ts`, 120 req/min/IP);
- security headers (HSTS, nosniff, X-Frame-Options, XSS) — **✅ zrobione** (`main.ts`);
- dependency update automation;
- CodeQL/dependency audit/secret scanning;
- pinning krytycznych GitHub Actions.

## Najbliższa kolejność prac

1. **P0:** włączyć branch protection na `main` i required CI;
2. **P0:** wykonać ręczny aktualny live-source soak 17/17 i przejrzeć raport;
3. **P0:** zbudować pełny **PRG Address Coverage Census** dla wszystkich 8 gmin;
4. domykać coverage według liczby odblokowanych adresów i kosztu utrzymania;
5. ~~domknąć installability PWA~~ — **✅ ZROBIONE**;
6. rozszerzyć Playwright o krytyczne mobile/offline/error flows oraz dodać Lighthouse gate;
7. ~~zdecydować: `.ics` jako reminder MVP albo pełny scheduled Web Push~~ — **✅ ZROBIONE** (oba zaimplementowane);
8. ~~przygotować staging/production deployment, backup/restore, monitoring i alerting~~ — **✅ ZROBIONE** (docker-compose.prod, db-backup, runbook, observability, security);
9. uruchomić deployment staging/prod i real-user pilot; mierzyć address search success / unsupported / ambiguous / retention;
10. dopiero po domknięciu jakości i ekonomii zwiększać zakres do kolejnych ~20 gmin.

## Bramka wyjścia z obecnego pilota

Pilot 8 gmin można uznać za gotowy do skalowania dopiero, gdy:

- pełny census PRG pokazuje uzgodniony poziom address coverage (docelowo >=90–95% lub jawnie zaakceptowane wyjątki);
- ambiguity jest niskie i wszystkie unsupported scopes są jawne;
- aktualny live-source soak działa regularnie;
- PWA jest installable i przechodzi browser E2E/a11y/Lighthouse;
- produkcja ma monitoring, backup i procedurę incident response — **✅ blueprint gotowy**, wymaga deploymentu;
- znamy realny koszt wdrożenia i miesięcznego utrzymania gminy;
- nie ma krytycznych wrong-date mismatches w audytowanych zakresach.

**Sama liczba ACTIVE sources ani 8/8 municipality source presence nie jest bramką wyjścia.**
