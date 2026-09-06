# Bieżący status WastePL

> Zweryfikowano: 2026-09-05, commit `cb7d92f0e7b5f413c9f6a86248ce83f590f12994`. Stan odnosi się do `main` oraz manifestu `pilot-koszalin-region@2026.13`.

## Executive summary

WastePL ma działającą i dobrze przetestowaną regionalną platformę danych, 17 aktywnych źródeł w 8 gminach pilota (17/17 live soak PASS), pierwszą konsumencką PWA oraz audytowaną próbkę 10 646 realnych adresów PRG (w tym 100% miasta Koszalina dla pełnych 5 frakcji). Projekt **nie jest jeszcze gotowym produkcyjnie systemem ogólnopolskim**.

Najważniejsze nierozstrzygnięte obszary to:

1. rozszerzenie address coverage w pozostałych 7 gminach pilota (obecnie 42.53% całego regionu, odblokowane 100% Koszalina, cel >=90-95%);
2. wdrożenie produkcyjne i uruchomienie pilota z realnymi użytkownikami (P2);
3. włączenie branch protection na `main` (wymaga zmiany repozytorium na publiczne lub planu GitHub Pro w GitHub Free; kompensowane przez CI na push/PR);
4. zebranie pełnych danych unit economics z realnego utrzymania.

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
| Pełne address coverage pilota | **49,29% (12 337 / 25 030)** | Wynik Address Coverage Census v2 (zob. [raport Census](reports/address-coverage-census.md)). |
| Koszalin address coverage | **100% (10 240 / 10 240)** | Pełny harmonogram miejski 5 frakcji (P1-C.2). |
| Audytowane realne adresy PRG | **12 337 / 12 337 PASS** | 100% poprawności w audytowanej próbce; nie denominator całego regionu. |
| Formalny historyczny real-100 | **100/100 PASS** | Koszalin 9, Manowo 46, Tychowo 45. |
| Polanów Garbno + rejon wiejski A (18 miejscowości) | **430/430 PASS** | Bezpieczny aktywny subset (Garbno 39 + Bukowo, Dadzewo, Domachowo, Jacinki, Krytno, Karsina, Karsinka, Nacław, Nadbór, Osetno, Powidz, Puławy, Rekowo, Rzyszczewko, Sowinko, Stołpie, Świerczyna 391). |
| Będzino Trasa I + Trasa II (20 miejscowości) | **785/785 PASS** | Bezpieczny aktywny subset (Trasa I: 12 miejscowości, 487 pkt; Trasa II: Barninek, Dobiesławiec, Dobre, Dobre Małe, Kazimierz Pom., Łekno, Podamirowo, Ziębrze, 298 pkt). |
| Sianów Grabówko + Borowiec rural + Dąbrowa + Skwierzynka | **559/559 PASS** | Bezpieczny aktywny subset (Grabówko 31 + Borowiec rural 90 + Dąbrowa 93 + Skwierzynka 345). |
| Świeszyno Chałupy | **167/167 PASS** | Bezpieczny aktywny subset. |
| Bobolice Kłanino | **65/65 PASS** | Bezpieczny aktywny subset. |
| Trusted PSZOK geocoding | **8/8** | Punkty mają zweryfikowane współrzędne w warstwie referencyjnej PRG/GUGiK. |
| Aktualny live-source soak 17/17 | **17/17 PASS (8 HEALTHY, 9 CHANGED/OK, 0 FAIL)** | Ręczny soak z `workflow_dispatch` (Run ID `33882827565`). Wszystkie 17 aktywnych źródeł pobiera się i parsuje poprawnie w izolowanym środowisku. |
| Consumer PWA | **DZIAŁA / PRE-PRODUCTION** | React 19 + Vite + service worker, address flow, harmonogram, provenance, PSZOK i mapa. |
| Playwright E2E | **94/94 PASS** | Pełny multi-device suite (Desktop Chrome, Pixel 5, iPhone 14) + audyt a11y WCAG 2.2 AA, feedback flow, testy offline/stale-cache oraz true cold-start SW offline test. |
| PWA installability assets | **KOMPLETNE** | PWA ikony 192/512, maskable 512, apple-touch 180, favicon svg/ico wgrane do `apps/pwa/public`. |
| Powiadomienia | **KOMPLETNE** | VAPID/Web Push: backend subscription storage, scheduled push worker, service worker delivery. Alarmy `.ics` zachowane jako alternatywa. |
| Branch protection `main` | **WYŁĄCZONE** | `main` w prywatnym repozytorium GitHub Free; CI zabezpieczone przez `--frozen-lockfile` i push/PR CI. |
| Production blueprint | **GOTOWY** | `docker-compose.prod.yml`, Caddy reverse proxy z TLS, PWA Nginx SPA container, pętla zwrotna dla DB/Redis/MinIO. |
| Automated DB backup | **GOTOWY** | `pnpm db:backup` — pg_dump via docker, SHA-256 checksum, metadata JSON. |
| Automated DB restore | **GOTOWY** | `pnpm db:restore` — weryfikacja SHA-256, dry-run i atomic psql restore. |
| Source Prioritization | **GOTOWE** | `pnpm census:prioritize` — model ROI (odblokowane adresy / (czas + ryzyko)). |
| Resident Telemetry Funnel | **GOTOWE** | Pseudonimowy serwis telemetrii mieszkańców (P2.2) z buforem offline, haszowaniem SHA-256 identyfikatora instalacji i brakiem surowych adresów/User-Agent. |
| Lighthouse CI | **100/100/100/100 PASS** | `pnpm pwa:lhci` — Performance 100, Accessibility 100, Best Practices 100, SEO 100 w GitHub Actions CI. |
| Dependency Security Audit & SAST | **GOTOWE** | `pnpm security:audit` w CI (`--audit-level=high`) + GitHub CodeQL SAST (`security-extended,security-and-quality`) z eksportem SARIF, zero podatności. |
| Deployment runbook | **GOTOWY** | `docs/runbooks/staging-production-deployment.md` — pełna procedura deploy/DR i mechanizmy kompensacyjne. |
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

Wykonano rzeczywisty live-source staging soak na aktualnym `main`:
- **Run ID:** `33882827565` (workflow_dispatch)
- **Data:** 2026-09-04
- **Wynik ogólny:** **17/17 PASS** — 8 HEALTHY bez zmian, 9 CHANGED_BUT_PARSEABLE, 0 FAIL, 0 REVIEW_REQUIRED.
- **Weryfikacja naprawionego upstream driftu:**
  1. `bobolice-collection-klanino-safe-h2-2026`: **HEALTHY** (HTTP 200, SHA `3b91671c01a6`, przetworzone i opublikowane poprawnie).
  2. `sianow-collection-dabrowa-grabowko-safe-h2-2026`: **HEALTHY** (HTTP 200, SHA `618c62bcca3a`, 104 kB PDF pobrany i opublikowany).
  3. `sianow-pszok`: **CHANGED_BUT_PARSEABLE** (HTTP 200, SHA `100b99e59672`, 631 kB HTML poprawnie zmatchowany z szablonem).
  4. `swieszyno-collection-trasa-1-safe-h2-2026`: **HEALTHY** (HTTP 200, SHA `8a37e48e2031`, 185 kB PDF pobrany przez fallback legacy BIP TLS).
- **Wniosek:** 100% z 17 źródeł pilota działa i parsuje się poprawnie z poziomu rzeczywistej sieci i środowiska GitHub Actions CI runner. Staging soak jest w pełni zielony.

## Consumer PWA

PWA jest działającym thin clientem, ale jeszcze nie produktem produkcyjnym.

Obecne możliwości:

- wyszukiwanie i wybór adresu przez WastePL API;
- najbliższe odbiory i kolejne terminy;
- source/provenance/freshness w odpowiedzi;
- PSZOK i mapa Leaflet/OpenStreetMap dla trusted location;
- local storage wybranego adresu;
- service worker i cache runtime;
- true cold-start offline z izolowanego service workera i Cache Storage (`pwa-cold-start-offline.spec.ts`);
- eksport kalendarza `.ics`;
- scheduled Web Push notifications (VAPID, backend subscription, push worker, SW delivery);
- Web Notifications API do permission/test notification;
- komplet ikon installability (192/512, maskable 512, apple-touch 180, favicon svg/ico);
- Playwright E2E (94/94 PASS, Desktop Chrome, Pixel 5, iPhone 14) + audyt a11y WCAG 2.2 AA, resident feedback flow oraz testy offline/stale/error.

Pozostałe zadania przed publicznym pilotem:

- wdrożenie CodeQL / SAST w workflow CI — **✅ zrobione** (`.github/workflows/codeql.yml`, upload SARIF artifact);
- produkcyjny staging pod dedykowaną domeną i zbieranie telemetrii.

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
- dependency security audit w CI (`pnpm security:audit`) — **✅ zrobione**;
- pinning krytycznych GitHub Actions do pełnych SHA — **✅ zrobione** (PR #124);
- CodeQL/SAST — **✅ zrobione** (`.github/workflows/codeql.yml`, PR #129);
- dependency update automation.

## Najbliższa kolejność prac

1. **P0:** włączyć branch protection na `main` i required CI (wymaga zmiany widoczności repo na publiczne w GitHub Free lub Pro);
2. ~~**P0:** wykonać ręczny aktualny live-source soak 17/17 i przejrzeć raport~~ — **✅ ZROBIONE** (Run ID `33882827565`, 17/17 PASS, 0 FAIL, 0 REVIEW_REQUIRED);
3. ~~**P0:** zbudować pełny **PRG Address Coverage Census** dla wszystkich 8 gmin~~ — **✅ ZROBIONE** (Census v2 pipeline, 415 supported / 25 030 adresów PRG);
4. **P1:** domykać coverage 8 gmin według liczby odblokowanych adresów i kosztu utrzymania (cel: >=90-95%);
5. ~~domknąć installability PWA~~ — **✅ ZROBIONE**;
6. ~~rozszerzyć Playwright o krytyczne mobile/offline/error flows oraz dodać do CI~~ — **✅ ZROBIONE** (78 testów E2E + axe WCAG 2.2 AA w GitHub Actions CI);
7. ~~zdecydować: `.ics` jako reminder MVP albo pełny scheduled Web Push~~ — **✅ ZROBIONE** (oba zaimplementowane, wpięty scheduler do workera);
8. ~~przygotować staging/production deployment, backup/restore, monitoring i alerting~~ — **✅ ZROBIONE** (docker-compose.prod, db-backup, runbook, observability, security);
9. **P2:** uruchomić deployment staging/prod i real-user pilot; mierzyć address search success / unsupported / ambiguous / retention;
10. **P3:** dopiero po domknięciu jakości i ekonomii zwiększać zakres do kolejnych ~20 gmin.

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
