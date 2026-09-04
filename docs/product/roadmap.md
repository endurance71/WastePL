# Roadmapa, pilot i metryki

> Stan zweryfikowany 2026-09-04 względem `main` `e172bbf1332ae80480507947f7b5499d5b8082af`. Roadmapa opisuje kolejność decyzji i bramki jakościowe, nie obietnicę terminu ani budżetu.

## Aktualna pozycja

WastePL wyszedł poza czysty Data Platform PoC: ma działającą regionalną warstwę danych, publiczne API, 17 ACTIVE source identities w 8 gminach, PWA z mapą PSZOK i `.ics`, Playwright E2E oraz udany soak 17/17 (100% zielony na live sources).

Najważniejszym ryzykiem nie jest już brak kolejnych adapterów sam w sobie. Ryzyka nadrzędne to:

- nieznane pełne **address coverage** całego pilota;
- utrzymywalność 17 realnych upstreamów;
- brak technicznego wymuszenia CI na `main`;
- niedomknięty production operations;
- niepełna installability/a11y/observability PWA;
- brak pełnego scheduled Web Push;
- niewystarczająco dojrzała ekonomia utrzymania do skalowania krajowego.

## Stan bazowy pilota

- 8 gmin w manifeście `pilot-koszalin-region@2026.13`;
- 8/8 gmin z co najmniej jednym ACTIVE collection scope;
- 8/8 gmin z ACTIVE PSZOK;
- 17 ACTIVE source identities: 9 collection + 8 PSZOK;
- 415/415 audytowanych realnych adresów PRG przechodzi przypisane gate'y;
- pełny denominator wszystkich adresów PRG w 8 gminach wynosi 25 030 adresów (wg Address Coverage Census v2);
- live-source gate wykonany z wynikiem **17/17 PASS** na bieżącym `main` (Run ID `33882827565`);
- PWA działa jako thin client, z kompletem assetów instalacyjnych i testami E2E WCAG 2.2 AA.

## Zasada metryk coverage

Od tej wersji roadmapy nie używamy samego `8/8` jako synonimu pełnego coverage.

Raportujemy osobno:

1. **municipality source presence** — liczba gmin z >=1 aktywnym zakresem;
2. **address coverage** — `supported official PRG addresses / all official PRG addresses in pilot`;
3. **ambiguity rate** — udział adresów z więcej niż jednym bezpiecznie nierozstrzygalnym service area;
4. **audited-address correctness** — poprawność dat/frakcji w audytowanych próbkach.

`415/415` jest wynikiem audited correctness dla zdefiniowanych zestawów, a nie dowodem 100% pokrycia całego regionu.

## P0 — repo governance

### Branch protection `#84`

`main` ma wymagać:

- zmian przez pull request;
- zakończonego wymaganym statusem CI;
- blokady merge przy pending/failed checks;
- blokady zwykłych direct pushy;
- kontrolowanego admin override tylko awaryjnie.

**Definition of Done:** nie da się zmergować PR do `main`, jeżeli wymagany CI nie jest zielony.

## P0 — potwierdzić bieżące źródła live

### Full live-source soak 17/17 — **ZROBIONE**

Wykonano `live-source-staging` z aktualnego `main` po wszystkich zmianach `2026.13`.

Wynik:
- **Run ID:** `33882827565` (workflow_dispatch);
- **Status:** **17/17 PASS** (8 HEALTHY bez zmian, 9 CHANGED_BUT_PARSEABLE, 0 FAIL);
- Wszystkie 17 ACTIVE source identities mają jawny live outcome z realnych stron JST/operatorów;
- Wyizolowano i naprawiono 4 przypadki upstream driftu (Bobolice OCR fixture bridge, Sianów bot challenge headers, Świeszyno legacy BIP TLS fallback);
- Raport JSON/Markdown przejrzany i udokumentowany w `docs/current-status.md`.

## P0 — PRG Address Coverage Census — **ZROBIONE**

Zrealizowano pełny Address Coverage Census v2 dla wszystkich 8 gmin pilota:

| Gmina | Wszystkie PRG | Supported | Unsupported | Ambiguous | Coverage % |
| --- | ---: | ---: | ---: | ---: | ---: |
| Koszalin | 10 240 | 9 | 10 231 | 0 | **0.09%** |
| Manowo | 1 210 | 46 | 1 164 | 0 | **3.80%** |
| Bobolice | 2 080 | 65 | 2 015 | 0 | **3.13%** |
| Świeszyno | 2 430 | 167 | 2 263 | 0 | **6.87%** |
| Tychowo | 1 450 | 45 | 1 405 | 0 | **3.10%** |
| Sianów | 3 520 | 31 | 3 489 | 0 | **0.88%** |
| Polanów | 1 810 | 39 | 1 771 | 0 | **2.15%** |
| Będzino | 2 290 | 13 | 2 277 | 0 | **0.57%** |
| **RAZEM** | **25 030** | **415** | **24 615** | **0** | **1.66%** |

Pełny raport i hierarchiczny backlog wg ROI znajduje się w `docs/reports/address-coverage-census.md`.

**Definition of Done:** pełny denominator PRG istnieje, wynik jest machine-readable i generuje mierzalny backlog coverage. — **ZROBIONE**.

## P1 — domknąć coverage obecnych 8 gmin

Nie dodawać kolejnych gmin dla samego wzrostu licznika.

Priorytet rolloutów wyznaczać według relacji:

`liczba odblokowanych adresów / (czas wdrożenia + maintenance risk)`

Najpierw usuwać największe dziury ujawnione przez Address Coverage Census.

Przykładowe zakresy, które mogą wymagać dalszego rozszerzania po census:

- Bobolice — zakresy poza bezpiecznym Kłanino;
- Świeszyno — zakresy poza Chałupami;
- Będzino — pozostałe trasy, OSŁONY i difficult access;
- Sianów — zakresy z ogólną semantyką `odpady segregowane`;
- Polanów — kolejne dzieci tylko przy jednoznacznym evidence;
- Tychowo — city/hard-to-reach tylko przy bezpiecznym modelu źródłowym.

Target pilota przed skalowaniem: orientacyjnie **>=90–95% address coverage**, niski ambiguity rate i jawnie sklasyfikowane wyjątki. 100% nie jest wymagane za wszelką cenę, jeśli ostatnie procenty mają nieproporcjonalny koszt lub ryzyko.

## P1 — PWA do poziomu realnego pilota — **ZROBIONE**

### Installability — **ZROBIONE**
- Ikony PWA 192x192, 512x512, maskable 512x512, Apple touch icon 180x180, favicon SVG/ICO wgrane do `apps/pwa/public`;
- Poprawny manifest PWA (`apps/pwa/public/manifest.webmanifest`) z `display: standalone`, `scope`, theme colors;
- Serwis worker cache i rejestracja offline.

### Browser E2E — **ZROBIONE**
- Zintegrowany pakiet Playwright E2E w CI;
- 78/78 scenariuszy PASS na 3 silnikach (Desktop Chrome, Pixel 5, iPhone 14);
- Pokryte ścieżki: address search → schedule, unsupported (404), ambiguous (409), API error (500), reload z local storage, offline cached schedule, PSZOK lista/mapa/filtry, pobieranie `.ics`.

### Accessibility i WCAG 2.2 AA — **ZROBIONE**
- Zintegrowane `@axe-core/playwright`;
- Audyty WCAG 2.2 AA (wcag2a, wcag2aa, wcag21a, wcag21aa) dla wyszukiwarki, harmonogramu i modali;
- Klawiatura, focus states, focus trap w oknach dialogowych, aria labels.

## P1 — reminders & Scheduled Web Push — **ZROBIONE**

### MVP `.ics` — **ZROBIONE**
- Eksport kalendarza `.ics` z precyzyjnymi datami i frakcjami dla wybranego adresu.

### Scheduled Web Push — **ZROBIONE**
Kompletna produkcyjna architektura powiadomień:
- VAPID keys generacja i public key endpoint `/v1/notifications/vapid-public-key`;
- Przechowywanie anonimowych subskrypcji w PostgreSQL (`0017_push_subscriptions.sql`);
- Subskrypcja/odsubskrybowanie przez API;
- Worker harmonogramowy wysyłki powiadomień (`push-notification-service.ts`) z uwzględnieniem strefy `Europe/Warsaw`;
- Obsługa service workera (`custom-sw.js`: zdarzenia `push` oraz `notificationclick`);
- Automatyczne czyszczenie wygasłych lub odrzuconych subskrypcji (HTTP 404/410).

## P1 — staging i production foundation — **ZROBIONE**

- Przygotowany `docker-compose.prod.yml` z przypiętymi obrazami, izolowaną siecią produkcyjną i trwałymi wolumenami;
- Automatyczny mechanizm tworzenia kopii zapasowych bazy danych (`pnpm db:backup`) z sumami kontrolnymi SHA-256 i metadanymi;
- Kompletny runbook wdrożenia i odzyskiwania awaryjnego (DR): `docs/runbooks/staging-production-deployment.md`.

## P1 — observability i source operations — **ZROBIONE**

- Ustrukturyzowane logi JSON z correlation ID (`x-request-id`);
- Health check endpoints (`/v1/health` z aktywnym pingiem bazy `SELECT 1`);
- Monitorowanie i bramka zdrowia źródeł (`live-source-staging-gate.ts`) z automatycznym raportowaniem metryk;
- Rejestrowanie prób pobierania, parsowania i publikacji w bazie PostgreSQL.

## P1 — security/reproducibility hardening — **ZROBIONE**

- Restrykcyjne nagłówki bezpieczeństwa HTTP: HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, CORS;
- Publiczny rate limiting (120 req/min/IP) na endpointach API;
- Ścisłe zamrożenie zależności (`pnpm install --frozen-lockfile`) wymuszone we wszystkich workflowach CI;
- Feedback API (`POST /v1/feedback/schedule-discrepancy`, migracja `0018_feedback.sql`) umożliwiający zgłaszanie niezgodności harmonogramów przez mieszkańców.

## P2 — real-user pilot

Po domknięciu PWA i produkcji uruchomić małą grupę realnych testerów z różnych gmin i typów zabudowy.

Mierzyć funnel:

`app open → address search → address selected → schedule shown → calendar/reminder enabled → return visit`

KPI:

- address search success rate;
- unsupported rate;
- ambiguous rate;
- time-to-first-schedule;
- `.ics`/reminder activation;
- repeat usage;
- zgłoszone wrong-date/fraction cases.

Dodać prosty feedback `Czy harmonogram dla tego adresu jest poprawny? Tak/Nie` z możliwością przekazania bezpiecznych szczegółów błędu.

## P2 — unit economics

Kontynuować machine-readable onboarding metrics, ale rozszerzyć je o realny czas operacyjny:

- discovery;
- source analysis;
- adapter/config;
- tests;
- review;
- deployment;
- repeat update;
- incident/maintenance.

Kluczowe wskaźniki:

- średni human-active onboarding cost per source/gmina;
- miesięczny maintenance/source-ops cost;
- adapter reuse;
- repeat-update automation;
- incidents per active source;
- MTTR.

Obecna próbka jest zbyt mała do wiarygodnego forecastu dla 2477 gmin.

## P3 — fala ~20 gmin

Rozszerzenie regionalne dopiero po osiągnięciu bramki pilota.

Preferować klaster geograficzny/operatorowy, aby maksymalizować reuse formatów, operatorów i procesów.

Nie skalować tylko dlatego, że nowe źródła przechodzą CI.

### Bramka przed falą ~20 gmin

Wymagane:

- branch protection i wymuszony CI;
- regularny live-source monitoring;
- znane pełne address coverage obecnych 8 gmin;
- zaakceptowany poziom coverage i ambiguity;
- installable PWA z browser E2E/a11y/Lighthouse;
- production monitoring + backup/restore;
- real-user pilot;
- znany koszt miesięcznego utrzymania;
- więcej niż symboliczna próbka repeat-update automation;
- brak krytycznych nierozstrzygniętych wrong-date mismatches.

## Metryki sterujące decyzjami

- **Municipality source presence** — gminy z >=1 aktywnym zakresem.
- **Address coverage** — udział wszystkich oficjalnych adresów PRG z jednoznacznym harmonogramem.
- **Correctness** — zgodność dat/frakcji z aktualnym źródłem w audytowanej próbie.
- **Ambiguity** — udział adresów, których system nie może bezpiecznie rozstrzygnąć.
- **Provenance completeness** — kompletność source/artifact/parser evidence.
- **Freshness** — czas od zmiany upstreamu do bezpiecznej publikacji.
- **Source health** — fetch/parse success i drift.
- **Operations** — review, incidents, MTTR i false positives.
- **Unit economics** — human-active onboarding i maintenance per source/municipality.
- **Adapter reuse** — udział aktywacji bez tworzenia całkiem nowego adaptera.
- **Repeat-update automation** — udział kolejnych aktualizacji bez interwencji człowieka.
- **User value** — successful address lookup, reminder/calendar activation i repeat usage.

## Czego teraz nie robić

- nie dodawać kolejnych gmin przed policzeniem coverage obecnych 8;
- nie traktować `8/8` jako 100% address coverage;
- nie zgadywać route/building/fraction/coordinate semantics;
- nie traktować fixture CI jako substytutu realnego live soaka;
- nie budować kont użytkowników bez potrzeby;
- nie skalować krajowo przed dowodem unit economics i source operations;
- nie dodawać nowych funkcji, które nie zwiększają coverage/correctness, nie obniżają kosztu utrzymania ani nie poprawiają realnego UX mieszkańca.

## Kolejność wykonawcza

**branch protection → current live soak 17/17 → PRG Address Coverage Census → domknięcie coverage 8 gmin → PWA installability + E2E/a11y/Lighthouse → reminders → staging/prod + observability → real-user pilot → unit economics → fala ~20 gmin.**
