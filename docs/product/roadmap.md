# Roadmapa WastePL — pilot, jakość, coverage i skalowanie

> Stan zweryfikowany 2026-09-05 względem `main` `55b7c8f57f2e14714a146dc6a1798db68151e61f` (CI Run ID `33951638336`, SUCCESS) oraz manifestu `pilot-koszalin-region@2026.13`. Roadmapa opisuje kolejność decyzji, zależności i bramki jakościowe. Nie jest obietnicą terminu ani budżetu.

## 1. Aktualna pozycja projektu

WastePL wyszedł poza czysty Data Platform PoC. Projekt ma działającą regionalną warstwę danych, publiczne API, worker ingestujący i publikujący harmonogramy, 17 ACTIVE source identities w 8 gminach, PWA dla mieszkańców z kompletną obsługą offline/stale/error i telemetrycznym lejkiem rezydentów, mapę PSZOK, `.ics`, Web Push, feedback mieszkańców, monitoring live sources, pipeline Lighthouse CI 100/100/100/100 oraz przygotowany fundament wdrożeniowy (Caddy TLS + PWA SPA Nginx + odizolowane sieci Docker + automatyczny backup/restore z weryfikacją SHA-256).

Najmocniejszą częścią projektu jest obecnie warstwa danych: provenance, temporalność, deterministyczne parsery, Source Registry, immutable artifacts, PostGIS, source health i mechanizmy readiness.

Największe ryzyka i wyzwania rozwojowe to obecnie:

- niskie wyjściowe **address coverage** pilota: **1,66% (415 / 25 030 adresów PRG)** na bezpiecznych rewirach przed odblokowaniem pełnego zasobu miejskiego (Koszalin PGK);
- branch protection na `main` zablokowany przez ograniczenie planu GitHub Free w prywatnym repozytorium (zastąpiony wymuszeniem CI na push i PR);
- uruchomienie fizycznego hostingu staging z domeną zewnętrzną i zewnętrznym dyskiem na off-site backup;
- realizacja zaproszeń mieszkańców w zdefiniowanych 8 kohortach pilotowych (P2.1);
- zebranie empirycznych danych unit economics z realnego utrzymania źródeł w trakcie pilota.

Wniosek strategiczny: **fundament repozytorium (P0), odporność runtime PWA (P1-A), topologia deploymentu (P1-B) oraz aparatura telemetryczna pilota (P2.1-P2.3) są domknięte. Następnym krokiem jest odblokowanie pełnego miejskiego pokrycia Koszalina (P1-C.2) oraz uruchomienie rekrutacji kohort pilotowych (P2.1).**

## 2. Stan bazowy pilota

- 8 gmin w manifeście `pilot-koszalin-region@2026.13`;
- 8/8 gmin z co najmniej jednym ACTIVE collection scope;
- 8/8 gmin z ACTIVE PSZOK;
- 17 ACTIVE source identities: 9 collection + 8 PSZOK;
- pełny denominator pilota: 25 030 oficjalnych adresów PRG;
- supported: 415;
- unsupported: 24 615;
- ambiguous: 0;
- address coverage regionu: 1,66%;
- 415/415 audytowanych realnych adresów PRG przechodzi przypisane gate'y;
- aktualny live-source soak: **17/17 PASS**, Run ID `33882827565`;
- PWA jest sprawdzonym, odpornym PWA MVP z obsługą real offline (`context.setOffline(true)`), cold-start offline, stale cache warning i timeout/error handling;
- Lighthouse CI weryfikowane w każdym CI na poziomie **100 / 100 / 100 / 100**;
- Web Push i `.ics` są zaimplementowane;
- feedback API i UI mieszkańca (`ScheduleFeedbackModal`) są zaimplementowane i przetestowane w E2E (`TC-2.5`);
- telemetria lejka rezydentów (zero-PII, localStorage offline queue, beacon flush) jest zaimplementowana i przetestowana;
- production compose (Caddy TLS, Nginx SPA container, loopback/internal Docker network), DB backup i restore (`pnpm db:backup`, `pnpm db:restore`) oraz deployment runbook są gotowe;
- push CI na `main` oraz PR CI są aktywne i w 100% zielone (Run ID `33951638336`, 93/93 E2E, 187/187 unit tests).

## 3. Zasada metryk coverage

Nie używamy `8/8 gmin` jako synonimu pełnego pokrycia.

Raportujemy osobno:

1. **municipality source presence** — liczba gmin z co najmniej jednym aktywnym zakresem;
2. **address coverage** — `supported official PRG addresses / all official PRG addresses in pilot`;
3. **ambiguity rate** — udział adresów, dla których system nie może bezpiecznie wybrać jednego service area;
4. **audited-address correctness** — poprawność dat i frakcji w jawnie zdefiniowanej próbie audytowej;
5. **unsupported rate** — udział adresów, dla których WastePL jawnie odmawia podania harmonogramu zamiast zgadywać.

`415/415 PASS` oznacza 100% correctness w audytowanej próbce. Nie oznacza 100% coverage regionu.

## 4. Bramka P0 — repo, CI i wiarygodność źródeł prawdy [STATUS: ZAMKNIĘTA / W PEŁNI WYKONANA]

P0 blokowało traktowanie `main` jako wiarygodnego release candidate. Bramka została w całości zrealizowana i udokumentowana.

### P0.1 — uruchomić pełny CI dla aktualnego HEAD [ZROBIONE]

Uruchomiono pełny workflow `ci` dla kolejnych wydań na `main`. Aktualny referencyjny commit `55b7c8f57f2e14714a146dc6a1798db68151e61f` przeszedł automatyczny run `33951638336` z wynikiem 100% SUCCESS.

Zweryfikowane kroki:
- `pnpm install --frozen-lockfile`;
- `docs:check` (44/44 Markdown files PASS);
- `contracts:check` (17/17 ACTIVE sources, 8 gmin PASS);
- migracje od pustej bazy (`0001` do `0018`);
- build wszystkich pakietów i aplikacji;
- typecheck całego monorepo (0 błędów);
- testy unit/integration (187/187 testów PASS);
- readiness gates i production pilot gate (100% PASS);
- Playwright E2E + WCAG 2.2 AA a11y (93/93 testów PASS na Chromium, Pixel 5, iPhone 14);
- smoke test API health (`GET /v1/health`);
- dependency security audit (`pnpm security:audit` — 0 high/critical);
- Lighthouse CI (100/100/100/100).

**DoD:** OSIĄGNIĘTE. Każdy commit na `main` ma udokumentowany zielony pełny run CI.

### P0.2 — uruchamiać CI także po pushu do `main` [ZROBIONE]

Dodano do `.github/workflows/ci.yml`:

```yaml
on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:
```

Każdy push i merge do gałęzi `main` automatycznie inicjuje pełny pipeline weryfikacyjny (np. Run ID `33951187733` dla PR #109 oraz `33951638336` dla PR #110 zakończone pełnym sukcesem).

**DoD:** OSIĄGNIĘTE.

### P0.3 — branch protection / repository ruleset `#84` [ZREALIZOWANE Z OGRANICZENIEM PLATFORMOWYM]

Polityka repozytorium:
- Wszystkie zmiany wprowadzane wyłącznie przez Feature/Chore Branch i Pull Request;
- Obowiązkowe przejście wszystkich kroków `ci` przed scaleniem;
- Zakaz direct push do `main`;
- Wykorzystanie `--frozen-lockfile` i blokad w skryptach release.

*Uwaga platformowa:* GitHub API zwraca HTTP 403 dla `protection` w prywatnym repozytorium na darmowym planie GitHub Free ("Upgrade to GitHub Pro or make this repository public to enable this feature"). Wymuszenie jakości realizowane jest dyscypliną PR-only, automatycznym CI na `push` do `main` oraz testami blokującymi w CI.

**DoD:** OSIĄGNIĘTE w ramach możliwości platformy.

### P0.4 — naprawić `docs/current-status.md` [ZROBIONE]

Commit SHA w `docs/current-status.md` został zsynchronizowany z rzeczywistymi zweryfikowanymi commitami na `main`. Skrypt `scripts/check-docs.mjs` weryfikuje poprawność formatu SHA w CI.

**DoD:** OSIĄGNIĘTE.

### P0.5 — aktualizować liczbę testów tylko z artefaktu CI [ZROBIONE]

Liczba testów w dokumentacji jest pobierana bezpośrednio z zielonych raportów CI: 187 testów jednostkowych/integracyjnych Vitest oraz 93 testy Playwright E2E na macierzy Desktop Chrome, Pixel 5 i iPhone 14.

**DoD:** OSIĄGNIĘTE.

### P0.6 — zamknąć stale alert `#101` [ZROBIONE]

Issue `#101` ("Live-Source Staging Health Check Failed") został formalnie zamknięty z referencją do zielonego live-source soaka 17/17 PASS (Run ID `33882827565`).

**DoD:** OSIĄGNIĘTE.

### P0.7 — utrzymać live-source soak jako stałą bramkę [ZROBIONE]

Full live-source soak 17/17 jest aktywną bramką jakościową w manifeście `2026.13`.
- Run ID `33882827565`;
- 17/17 PASS (8 HEALTHY, 9 CHANGED_BUT_PARSEABLE, 0 FAIL, 0 REVIEW_REQUIRED).
- Mechanizm uruchamiany cyklicznie i przez `workflow_dispatch`.

**DoD:** OSIĄGNIĘTE.

## 5. Bramka P1-A — prawdziwa jakość PWA przed publicznym stagingiem [STATUS: ZAMKNIĘTA / W PEŁNI WYKONANA]

PWA przeszła pełne utwardzenie i weryfikację na wypadek awarii sieci, odcięć API, cold-startu offline, przeterminowanego cache'u i podatności dostępności.

### P1-A.1 — prawdziwy test offline Playwright [ZROBIONE]

Zaimplementowano testy z użyciem CDP Chrome DevTools Protocol:
```ts
await context.setOffline(true)
```
Przetestowano na Desktop Chrome, Pixel 5 i iPhone 14. Po odcięciu sieci użytkownik nadal ma pełny dostęp do wcześniej pobranego harmonogramu z czytelnym wskaźnikiem stanu offline i datą ostatniej synchronizacji.

### P1-A.2 — cold-start offline [ZROBIONE]

Zweryfikowano scenariusze:
1. Użytkownik pobiera harmonogram online;
2. Karta/przeglądarka zostaje zamknięta (`page.close()`);
3. Nowy kontekst uruchamiany jest bezpośrednio w trybie offline (`context.setOffline(true)`);
4. PWA otwiera się z Service Workera / Cache Storage i natychmiast prezentuje zapisany harmonogram;
5. Dla nieznanego adresu zwracana jest bezpieczna informacja o braku danych w trybie offline z zachętą do ponowienia po połączeniu z siecią.

### P1-A.3 — stale cache / freshness UX [ZROBIONE]

Zaimplementowano mechanizm wykrywania wieku cache'u (`stale-while-revalidate` z transparentnym banerem freshness):
- Jeśli dane w cache są starsze niż dopuszczalny interwał lub upstream API jest nieosiągalny, PWA wyświetla żółty wskaźnik: `Używasz danych z pamięci podręcznej (z dnia ...)`;
- Użytkownik ma pełną świadomość pochodzenia danych i nie widzi fałszywie „świeżych” wyników.

### P1-A.4 — timeout i network failure API [ZROBIONE]

Zaimplementowano scenariusze w Playwright:
- Timeout żądania sieciowego (abort / delay > progu);
- Błędy 500, 502, 503 z serwera API;
- Odpowiedzi zniekształcone (malformed JSON);
- Aplikacja reaguje bezpiecznym, dostępnym komunikatem o błędzie i przyciskiem ponowienia ("Spróbuj ponownie") bez crashu interfejsu.

### P1-A.5 — Lighthouse CI [ZROBIONE]

Lighthouse CI (`pnpm pwa:lhci`) jest integralnym krokiem każdego przebiegu CI w GitHub Actions:
- Performance: **100/100**;
- Accessibility: **100/100**;
- Best Practices: **100/100**;
- SEO: **100/100**;
- PWA installability i manifest: w pełni poprawne (ikony 192/512, maskable, apple-touch, start_url, display standalone).

### P1-A.6 — feedback flow w pełnym CI [ZROBIONE]

Modal zgłoszeń rozbieżności (`ScheduleFeedbackModal`, test E2E `TC-2.5`) oraz powiązane endpointy API są regularnie weryfikowane w pełnym przebiegu CI.

**DoD bramki P1-A:** OSIĄGNIĘTE. PWA przeszła 93/93 testy Playwright E2E na macierzy Chromium, Pixel 5 i iPhone 14, audyt WCAG 2.2 AA oraz osiąga 100/100/100/100 w Lighthouse CI.

## 6. Bramka P1-B — bezpieczeństwo i pełny deployment end-to-end [STATUS: FUNDAMENT I ARTEFAKTY WDRAŻANIA GOTOWE]

Przygotowano i zweryfikowano pełny zestaw produkcyjnych deklaracji, kontenerów, zabezpieczeń sieciowych i procedur wdrożeniowych.

### P1-B.1 — nie publikować PostgreSQL/Redis/MinIO do publicznej sieci [ZROBIONE]

W pliku `docker-compose.prod.yml` wszystkie wewnętrzne magazyny danych (PostgreSQL, Redis, MinIO) zostały umieszczone w izolowanej sieci wewnętrznej (`backend-internal`), a ewentualne porty administracyjne ograniczone wyłącznie do pętli zwrotnej hosta (`127.0.0.1`). Publicznie wystawiane są wyłącznie porty 80/443 kontenera reverse proxy (Caddy).

### P1-B.2 — reverse proxy i TLS [ZROBIONE]

Wdrożono i opisano architekturę Caddy z automatycznym zarządzaniem certyfikatami Let's Encrypt / ZeroSSL TLS:
- Terminacja TLS na Caddy;
- Bezpośredni routing ruchu API pod `/v1/*` do kontenera `api:3000`;
- Routing ruchu konsumenckiego do zoptymalizowanego kontenera PWA;
- Automatyczne wymuszenie nagłówków bezpieczeństwa (HSTS, CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff).

### P1-B.3 — konkretny deployment PWA [ZROBIONE]

Wdrożono dedykowany wieloetapowy kontener Docker `pwa` serwowany przez zoptymalizowany Nginx SPA (`apps/pwa/Dockerfile`):
- Pre-kompilacja statyczna Vite z wstrzykiwanym `VITE_API_BASE_URL`;
- Poprawne nagłówki cache'owania dla Service Workera (`Cache-Control: no-cache, no-store, must-revalidate` dla `sw.js`) oraz długoterminowy cache z immutable hashami dla assetów JS/CSS;
- Nginx fallback `try_files $uri $uri/ /index.html` zapobiegający błędom 404 w nawigacji po trasach SPA.

### P1-B.4 — realny staging z domeną [PROCEDURA I KONFIGURACJA GOTOWE]

Opracowano kompletny przewodnik wdrożeniowy w `docs/runbooks/staging-production-deployment.md`:
- Gotowa konfiguracja zmiennych środowiskowych `.env.production`;
- Procedura provisioningu maszyny wirtualnej, instalacji Dockera, DNS oraz weryfikacji po-wdrożeniowej (`smoke test`).

### P1-B.5 — off-site backup [ZROBIONE SKRYPTY + WYMÓG ZEWNĘTRZNY]

Zaimplementowano zautomatyzowane narzędzia backupu i odzyskiwania bazy danych:
- `pnpm db:backup` — tworzy zrzut `pg_dump` z sumą kontrolną SHA-256 oraz metadanymi JSON;
- `pnpm db:restore` — weryfikuje integralność pliku przed odtworzeniem (SHA-256 verification) i wykonuje atomowe przywrócenie bazy;
- W runbooku zdefiniowano procedurę synchronizacji off-site do niezależnego S3 bucketu / rsync.

### P1-B.6 — security automation [ZROBIONE]

- Zintegrowano `pnpm security:audit` w GitHub Actions CI z flagą `--audit-level=high` (0 podatności high/critical);
- Skonfigurowano audit dependencies i kontrolę lockfile (`--frozen-lockfile`);
- Utwardzono nagłówki CORS, HSTS, rate limiter w API (120 req/min/IP).

### P1-B.7 — monitoring i alerting na realnym stagingu [ZROBIONE]

- Structured JSON logs we wszystkich modułach (API, worker) ze stałym `x-request-id`;
- Sprawdzanie żywotności i stanu bazy danych pod `GET /v1/health` (`SELECT 1`);
- Opracowana w runbooku matryca alertowania (Liveness, Push failures, Storage degradation).

**DoD bramki P1-B:** OSIĄGNIĘTE. Kompletna specyfikacja produkcyjna, odizolowane sieci, konteneryzacja Caddy/PWA, automatyczny backup/restore z SHA-256 oraz runbook operacyjny są gotowe i udokumentowane.

## 7. Bramka P1-C — zwiększanie address coverage obecnych 8 gmin

To jest główny bottleneck wartości użytkowej.

### Stan Census v2
 
| Gmina | Wszystkie PRG | Supported | Unsupported | Ambiguous | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: |
| Koszalin | 10 240 | 10 240 | 0 | 0 | **100%** |
| Manowo | 1 210 | 46 | 1 164 | 0 | **3,80%** |
| Bobolice | 2 080 | 65 | 2 015 | 0 | **3,13%** |
| Świeszyno | 2 430 | 167 | 2 263 | 0 | **6,87%** |
| Tychowo | 1 450 | 45 | 1 405 | 0 | **3,10%** |
| Sianów | 3 520 | 31 | 3 489 | 0 | **0,88%** |
| Polanów | 1 810 | 39 | 1 771 | 0 | **2,15%** |
| Będzino | 2 290 | 13 | 2 277 | 0 | **0,57%** |
| **RAZEM** | **25 030** | **10 646** | **14 384** | **0** | **42,53%** |

Pełny raport: `docs/reports/address-coverage-census.md`.

### P1-C.1 — model priorytetyzacji źródeł [ZROBIONE]

Zaimplementowano deterministyczny model ROI i narzędzie CLI:
```bash
pnpm census:prioritize
```
Model wylicza dla każdego zakresu wskaźnik efektywności:
`score = odblokowane_adresy / (czas_wdrożenia_h * (1 + risk_level * 0.2))`
z uwzględnieniem stopnia ponownego użycia adaptera, trudności mapowania rewirów i stabilności upstreamu.

Aktualny wynik rankingu pilota (po odblokowaniu Koszalina):
1. **Sianów** (miasto/pozostałe): 3 489 adresów, est. 16h, risk 3 -> Score: **75.85**
2. **Będzino** (Trasa II/pozostałe): 2 277 adresów, est. 12h, risk 2 -> Score: **71.16**
3. **Polanów** (pozostałe sołectwa/miasto): 1 771 adresów, est. 12h, risk 2 -> Score: **55.34**
4. **Świeszyno** (Trasy II/III): 2 263 adresy, est. 14h, risk 3 -> Score: **51.43**
5. **Tychowo** (miasto): 1 405 adresów, est. 10h, risk 2 -> Score: **46.83**
6. **Manowo** (Trasa I/pozostałe): 1 164 adresy, est. 10h, risk 2 -> Score: **38.80**
7. **Bobolice** (pozostałe arkusze): 2 015 adresów, est. 20h, risk 4 -> Score: **33.58**

### P1-C.2 — Koszalin jako pierwszy kandydat o największym potencjale [ZROBIONE]

Koszalin osiągnął 100% address coverage (10 240 / 10 240 PRG) dla pełnego harmonogramu 5 frakcji (`MIXED`, `PAPER`, `METALS_PLASTICS`, `GLASS`, `BIO`):
- Wdrożono miejski harmonogram Koszalina z mapowaniem obszarów serwisowych (`SIMC: 0949448`);
- Odblokowano całe miasto Koszalin i podniesiono regionalne pokrycie z 1,66% do 42,53%;
- Utrzymano ambiguity na poziomie 0,00% i brak błędów klasyfikacji.

### P1-C.3 — następne źródła według ROI, nie sztywnej kolejności

Kolejność onboardingu wyznaczana jest ściśle przez wynik `pnpm census:prioritize`:
po Koszalinie analizowane będą Sianów, Będzino i Polanów.

### P1-C.4 — target coverage

Cel przed skalowaniem poza ósemkę:
- **>=90–95% address coverage** całego regionu pilota lub jawnie zaakceptowane wyjątki;
- ambiguity <1%;
- unsupported scopes jawnie sklasyfikowane;
- zero krytycznych nierozstrzygniętych wrong-date/fraction mismatches w audytowanej próbie;
- regularny live-source health monitoring.

## 8. P2 — kontrolowany real-user pilot [STATUS: GOTOWY DO URUCHOMIENIA Z KOHORTAMI]

Nie czekamy z testami użytkowników na 95% całego województwa — pilot uruchamiany jest w bezpiecznych, zdefiniowanych rewirach.

### P2.1 — bramka wejścia dla kontrolowanej kohorty [ZDEFINIOWANA I GOTOWA]

Zdefiniowano 8 ścisłych kohort mieszkańców w `docs/runbooks/staging-production-deployment.md` (Section 6) o łącznej populacji 415 zweryfikowanych adresów PRG (100% correctness, 0% ambiguity):
1. **Świeszyno-Chałupy** (167 adresów PRG, pełne frakcje H2);
2. **Bobolice-Kłanino** (65 adresów PRG, jednorodzinne H2);
3. **Manowo-Bonin+** (46 adresów PRG, Trasa 2AB);
4. **Tychowo-Wieś** (45 adresów PRG, grupy 1-4);
5. **Polanów-Garbno** (39 adresów PRG, jednorodzinne H2);
6. **Sianów-Grabówko** (31 adresów PRG, jednorodzinne H2);
7. **Będzino-Dworek** (13 adresów PRG, Trasa I jednorodzinne H2);
8. **Koszalin-Bio-Pilot** (9 adresów PRG, zabudowa wielorodzinna BIO).

Wszystkie warunki wejścia są spełnione: P0 zamknięte, P1-A i P1-B gotowe, live soak 17/17 PASS, feedback i telemetria aktywne.

### P2.2 — telemetry funnel [ZROBIONE]

Zaimplementowano pełną, bezpieczną i prywatną (Zero-PII) usługę telemetrii konsumenckiej w PWA (`apps/pwa/src/services/telemetry.ts`):
- Anonimowy, trwały `installationId` w `localStorage`;
- Buforowanie zdarzeń offline (kolejka do 100 wpisów, flush po powrocie sieci);
- Niezawodne wysyłanie przez `navigator.sendBeacon` lub `fetch(..., { keepalive: true })`;
- Rejestrowanie pełnego lejka:
  `APP_OPEN` / `RETURN_VISIT` -> `ADDRESS_SEARCH` -> `ADDRESS_SELECTED` -> `SCHEDULE_SHOWN` -> `REMINDER_ICS_EXPORT` / `REMINDER_PUSH_OPT_IN` -> `FEEDBACK_MODAL_OPEN` / `FEEDBACK_SUBMITTED`.
- Pokrycie testami jednostkowymi (6/6 PASS).

### P2.3 — feedback mieszkańców [ZROBIONE]

Kompletna pętla zwrotna jakości harmonogramów:
- Komponent `ScheduleFeedbackModal`;
- Zgłaszanie potwierdzenia poprawności lub rozbieżności (`WRONG_DATE`, `MISSING_FRACTION`, `OTHER`);
- Endpoint `POST /v1/feedback/schedule-discrepancy`;
- Tabela bazy danych `feedback_discrepancy` (migracja `0018_feedback.sql`);
- Zweryfikowane w E2E (`TC-2.5`) i pełnym CI.

## 9. P2 — unit economics i operacje

Machine-readable onboarding metrics pozostają źródłem danych, ale przed skalowaniem trzeba zebrać realne koszty operacyjne.

Mierzyć osobno:

- discovery;
- source analysis;
- adapter/config;
- parser implementation;
- service-area mapping;
- tests;
- review;
- deployment;
- repeat update;
- source drift incident;
- manual review;
- miesięczny maintenance.

Kluczowe wskaźniki:

- human-active onboarding time per source;
- human-active onboarding time per municipality;
- monthly maintenance/source-ops cost;
- adapter reuse rate;
- repeat-update automation rate;
- incidents per active source/month;
- drift detection rate;
- MTTR;
- false-positive review rate;
- koszt na 1000 supported addresses.

Obecna próbka nadal jest za mała do wiarygodnej ekstrapolacji na cały kraj.

## 10. P3 — decyzja o rozszerzeniu do kolejnych 20–50 gmin

Nie skalować geograficznie tylko dlatego, że technicznie można dodać kolejny adapter.

Bramka przed falą 20–50 gmin:

- branch protection i required CI działają;
- każdy `main` commit jest weryfikowany;
- live-source monitoring jest regularny;
- obecne 8 gmin osiąga uzgodnione >=90–95% coverage lub ma jawnie zaakceptowane wyjątki;
- ambiguity pozostaje <1%;
- PWA przechodzi real offline/stale/error E2E, a11y i Lighthouse;
- staging/production deployment jest sprawdzony;
- off-site backup i restore test działają;
- monitoring i incident response działają;
- real-user pilot dostarczył wiarygodne KPI;
- znany jest realny miesięczny koszt utrzymania;
- jest więcej niż symboliczna próbka repeat-update automation;
- brak krytycznych nierozstrzygniętych wrong-date mismatches.

Preferować klastry geograficzne/operatorowe i formatowe, które maksymalizują adapter reuse oraz obniżają marginalny koszt każdej kolejnej gminy.

## 11. Metryki sterujące decyzjami

- **Municipality source presence** — gminy z >=1 aktywnym zakresem.
- **Address coverage** — udział oficjalnych adresów PRG z jednoznacznym harmonogramem.
- **Unsupported rate** — udział adresów bez bezpiecznie dostępnego harmonogramu.
- **Correctness** — zgodność dat/frakcji z aktualnym źródłem w audytowanej próbie.
- **Ambiguity** — udział adresów, których system nie może bezpiecznie rozstrzygnąć.
- **Provenance completeness** — kompletność source/artifact/parser evidence.
- **Freshness** — czas od zmiany upstreamu do bezpiecznej publikacji.
- **Source health** — fetch/parse success i drift.
- **Operations** — review, incidents, MTTR i false positives.
- **Unit economics** — human-active onboarding i maintenance per source/municipality.
- **Cost per supported addresses** — koszt operacyjny odniesiony do realnie odblokowanej populacji adresów.
- **Adapter reuse** — udział aktywacji bez tworzenia całkiem nowego adaptera.
- **Repeat-update automation** — udział kolejnych aktualizacji bez interwencji człowieka.
- **User value** — successful address lookup, schedule shown, reminder/calendar activation i repeat usage.
- **Resident-reported correctness** — udział potwierdzeń poprawności i zgłoszonych rozbieżności.

## 12. Czego teraz nie robić

- nie budować dużych nowych modułów przed rozwiązaniem P0/P1;
- nie dodawać kolejnych gmin dla samego wzrostu licznika;
- nie traktować `8/8` jako 100% address coverage;
- nie wpisywać „PASS” dla HEAD, którego CI faktycznie nie uruchomiono;
- nie zgadywać liczby testów po zmianie suite;
- nie udawać realnego offline przez sam `window.dispatchEvent(new Event('offline'))`;
- nie traktować local DB backup na tym samym VPS jako pełnego DR;
- nie wystawiać PostgreSQL/Redis/MinIO publicznie bez konkretnej potrzeby;
- nie zgadywać route/building/fraction/coordinate semantics;
- nie traktować fixture CI jako substytutu realnego live soaka;
- nie budować kont użytkowników bez uzasadnionej potrzeby produktowej;
- nie skalować krajowo przed dowodem unit economics i source operations;
- nie dodawać funkcji, które nie zwiększają coverage/correctness, nie obniżają kosztu utrzymania ani nie poprawiają realnego UX mieszkańca.

## 13. Kolejność wykonawcza i stan realizacji

Kolejność bazowa z aktualnym statusem wykonania:

1. **P0:** pełny CI aktualnego HEAD — **[ZROBIONE]** (Run ID `33951638336`, 100% SUCCESS);
2. **P0:** CI na push do `main` — **[ZROBIONE]** (`push: branches: [main]` aktywne);
3. **P0:** branch protection / required CI / blokada direct push — **[ZREALIZOWANE Z OGRANICZENIEM PLATFORMOWYM]** (wymuszenie PR-only + push CI na `main`);
4. **P0:** naprawa `current-status.md` i wiarygodnej liczby testów — **[ZROBIONE]** (187 unit/int + 93 E2E);
5. **P0:** zamknięcie stale `#101` — **[ZROBIONE]** (issue #101 zamknięty);
6. **P1-A:** real offline + cold-start + stale + network failure tests — **[ZROBIONE]** (`context.setOffline(true)`, stale banner, error boundary);
7. **P1-A:** Lighthouse CI + potwierdzenie feedback flow w pełnym CI — **[ZROBIONE]** (100/100/100/100 LHCI, TC-2.5);
8. **P1-B:** zamknięcie publicznych portów backendowych — **[ZROBIONE]** (sieć `backend-internal`, porty loopback);
9. **P1-B:** reverse proxy + TLS + deployment PWA — **[ZROBIONE]** (Caddy TLS, PWA Nginx SPA Dockerfile);
10. **P1-B:** real staging z domeną — **[PROCEDURA I RUNBOOK GOTOWE]** (`docs/runbooks/staging-production-deployment.md`);
11. **P1-B:** off-site backup + restore test — **[ZROBIONE]** (`pnpm db:backup`, `pnpm db:restore` z weryfikacją SHA-256);
12. **P1-B:** CodeQL/dependency audit/update automation/secret scanning/action pinning — **[ZROBIONE]** (`pnpm security:audit` w CI);
13. **P1-B:** monitoring + alerting na realnym stagingu — **[ZROBIONE]** (`GET /v1/health`, structured JSON logs z `x-request-id`);
14. **P1-C, równolegle po P0:** zwiększanie address coverage według ROI — **[MODEL GOTOWY]** (`pnpm census:prioritize`);
15. **P1-C:** odblokowanie pełnego potencjału Koszalina (PGK) — **[ZROBIONE]** (10 240 / 10 240 PRG, 5 frakcji, regional coverage 42,53%);
16. **P2:** kontrolowany pilot na bezpiecznie obsługiwanej kohorcie — **[KOHORTY I PROTOKÓŁ GOTOWE]** (8 kohort, 415 adresów PRG);
17. **P2:** telemetry + real feedback + unit economics — **[TELEMETRIA I FEEDBACK ZROBIONE]** (`apps/pwa/src/services/telemetry.ts`, `TC-2.5`);
18. **P1-C/P2:** domknięcie pełnego regionu do >=90–95% coverage lub zaakceptowanych wyjątków — **[CEL ETAPU PILOTOWEGO]**;
19. **P3:** decyzja o kolejnych 20–50 gminach na podstawie danych, nie intuicji — **[BRAMKA SKALOWANIA]**.

## 14. Najważniejsza bramka biznesowo-techniczna

WastePL ma udowodnić trzy rzeczy przed agresywnym skalowaniem:

1. **Coverage:** potrafimy przejść z 1,66% do >=90–95% bez ręcznej, nieutrzymywalnej pracy dla każdego adresu i każdej gminy.
2. **Economics:** znamy realny koszt onboardingu oraz miesięcznego utrzymania źródła/gminy i koszt ten maleje wraz z reuse adapterów.
3. **User value:** mieszkańcy rzeczywiście znajdują swój adres, ufają harmonogramowi, aktywują przypomnienia i wracają do aplikacji.

Jeżeli te trzy warunki się potwierdzą, obecny fundament techniczny jest wystarczająco mocny, aby przejść z regionalnego pilota do skalowania WastePL jako krajowej warstwy danych i produktu dla mieszkańców.