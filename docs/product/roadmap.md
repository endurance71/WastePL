# Roadmapa WastePL — pilot, jakość, coverage i skalowanie

> Stan zweryfikowany 2026-09-05 względem `main` `435ae20e18bd920743efe98e1e0b4980a0f91596` oraz manifestu `pilot-koszalin-region@2026.13`. Ten dokument rozdziela **kod/blueprint**, **weryfikację CI** i **realne wdrożenie operacyjne**. Status `ZROBIONE` oznacza spełnione kryterium DoD, a nie tylko istnienie pliku lub procedury.

## 1. Aktualna pozycja projektu

WastePL jest zaawansowaną regionalną platformą danych i pre-production PWA. Fundament techniczny jest mocny: publiczne API, worker ingestujący, provenance i immutable artifacts, PostGIS, 17 aktywnych źródeł w 8 gminach, PSZOK, Web Push, `.ics`, feedback mieszkańców, live-source monitoring, rozbudowane readiness gates, Playwright/WCAG oraz Lighthouse CI.

Największym ograniczeniem produktu nie jest obecnie brak modułów aplikacji. Są nim:

- **address coverage: 42,53% (10 646 / 25 030 adresów PRG)** z odblokowanym 100% miasta Koszalina, z celem >=90–95% w całym regionie;
- brak technicznie wymuszonego branch protection / required CI na `main`;
- brak potwierdzonego publicznego stagingu działającego na realnej domenie;
- brak empirycznie zweryfikowanego off-site backupu i restore drill na środowisku staging;
- niepełny security automation hardening (CodeQL/SAST, secret scanning, dependency update automation — pinning GitHub Actions SHA zrealizowany);
- brak wiarygodnych danych unit economics z realnego utrzymania źródeł.

Wniosek strategiczny: **nie dokładamy dużych nowych modułów. Utrzymujemy wiarygodność repo i telemetrykę, uruchamiamy realny staging, a większość pracy produktowej kierujemy w zwiększenie coverage obecnych 8 gmin.**

## 2. Stan bazowy pilota

| Miara | Stan |
| --- | ---: |
| Gminy w manifeście | 8 |
| Gminy z >=1 ACTIVE collection scope | 8/8 |
| Gminy z ACTIVE PSZOK | 8/8 |
| ACTIVE source identities | 17 (9 collection + 8 PSZOK) |
| Oficjalne adresy PRG w pilocie | 25 030 |
| Supported | 11 303 |
| Unsupported | 13 727 |
| Ambiguous | 0 |
| Address coverage | **45,16%** |
| Audytowane adresy w bezpiecznych zakresach | 11 303 / 11 303 PASS |
| Manual live-source soak | 17/17 PASS (`33882827565`) |
| Playwright na ostatnim zweryfikowanym zestawie | 93/93 PASS |
| Lighthouse CI na ostatnim zweryfikowanym zestawie | 100/100/100/100 |

`8/8 gmin` oznacza obecność źródła w każdej gminie, a **nie** pełne pokrycie adresów.

## 3. Zasada metryk coverage

Raportujemy osobno:

1. **municipality source presence** — liczba gmin z co najmniej jednym aktywnym zakresem;
2. **address coverage** — `supported official PRG addresses / all official PRG addresses in pilot`;
3. **ambiguity rate** — udział adresów bez jednoznacznego service area;
4. **audited-address correctness** — zgodność dat i frakcji w jawnej próbie audytowej;
5. **unsupported rate** — udział adresów, dla których WastePL bezpiecznie odmawia podania harmonogramu zamiast zgadywać.

`415/415 PASS` oznacza correctness audytowanej próbki. Nie oznacza 100% coverage regionu.

## 4. P0 — repo, CI i wiarygodność źródeł prawdy [STATUS: OTWARTE]

P0 pozostaje otwarte, dopóki kryterium branch protection / required CI nie jest technicznie wymuszone albo jawnie zmienione jako zaakceptowane ryzyko governance.

### P0.1 — pełny CI aktualnego `main` [ZROBIONE]

Workflow obejmuje m.in.:

- `pnpm install --frozen-lockfile`;
- `docs:check` i `contracts:check`;
- migracje od pustej bazy;
- build i typecheck;
- unit/integration tests;
- pilot readiness i fixture-independent production gates;
- Playwright E2E + WCAG 2.2 AA;
- API health smoke test;
- dependency audit;
- Lighthouse CI.

CI uruchamia się również na `push` do `main`, więc każdy commit trafiający na tę gałąź otrzymuje automatyczną weryfikację po fakcie.

### P0.2 — CI na push do `main` [ZROBIONE]

`.github/workflows/ci.yml` zawiera `push: branches: [main]`, `pull_request` i `workflow_dispatch`.

To jest warstwa bezpieczeństwa, ale **nie zastępuje** required status checks przed merge.

### P0.3 — branch protection / ruleset `#84` [NIEZROBIONE]

Stan GitHub API przy tej weryfikacji:

- `main protected: false`;
- required status-check enforcement: `off`;
- issue `#84` pozostaje otwarte.

Proces zespołowy używa PR-ów i zielonego CI, lecz direct push nie jest technicznie blokowany przez konfigurację repozytorium. Jeśli prywatny plan GitHub nie pozwala włączyć wymaganej ochrony, jest to **jawne ograniczenie/ryzyko**, a nie spełnione DoD.

**DoD:** `main` ma ruleset/branch protection wymagający PR oraz zielonego `ci`, albo ryzyko jest formalnie zaakceptowane i P0 zdefiniowane na nowo. Do tego czasu P0.3 pozostaje otwarte.

### P0.4 — integralność `current-status.md` [ZROBIONE]

Wdrożono w PR `#112`:
- `scripts/check-docs.mjs` weryfikuje istnienie commitu (`git cat-file -e <sha>^{commit}`);
- weryfikuje osiągalność z `HEAD` (`git merge-base --is-ancestor <sha> HEAD`);
- pełna historia w CI (`fetch-depth: 0`).

**DoD:** CI odrzuca nieistniejący lub nieosiągalny verification SHA. Spełnione w PR `#112`.

### P0.5 — stale live-source alert `#101` [ZROBIONE]

Stary alert został zamknięty po potwierdzeniu późniejszego zielonego soaka 17/17 oraz kolejnego poprawnego scheduled runu.

### P0.6 — live-source soak jako stała bramka [ZROBIONE]

17 ACTIVE sources jest objętych automatycznym workflow live-source oraz możliwością ręcznego `workflow_dispatch`.

## 5. P1-A — jakość i odporność PWA [STATUS: MOCNA, ALE NIE W 100% DOMKNIĘTA]

### P1-A.1 — realne odcięcie sieci po primingu cache [ZROBIONE]

Playwright używa `context.setOffline(true)` po wcześniejszym załadowaniu harmonogramu i weryfikuje utrzymanie widocznych danych.

### P1-A.2 — cold-start offline [ZROBIONE]

Wdrożono dedykowany suite testowy offline (`apps/pwa/playwright.offline.config.ts`, `apps/pwa/e2e/pwa-cold-start-offline.spec.ts`, PR #128):
- Test buduje aplikację produkcyjną (`vite build`) i serwuje ją w trybie preview;
- Pierwszy kontekst przeglądarki odwiedza PWA z zamockowanym backendem API, rejestruje Service Worker (`sw.js`) i ładuje harmonogram;
- Kontekst jest zamykany, a serwer mock API wyłączany;
- Nowy, odizolowany kontekst przeglądarki uruchamia się z flagą `context.setOffline(true)`;
- PWA ładuje się w pełni z Cache Storage / Service Worker bez dostępu do sieci i bez ręcznego seedowania `localStorage` w teście.

**DoD:** osobny test uruchamia nowy kontekst/offline po wcześniejszym primingu realnego builda PWA i udowadnia start bez sieci bez ręcznego seedowania schedule cache w samym teście. Spełnione w PR #128.

### P1-A.3 — stale/error fallback [ZROBIONE DLA KLUCZOWEGO PRZYPADKU]

E2E obejmuje m.in. fallback do cache przy awarii API 500 oraz czytelny komunikat dla użytkownika bez zapisanych danych przy błędzie sieci.

Nie deklarujemy szerszego zestawu statusów/timeoutów/malformed JSON, dopóki konkretne testy tego nie dowodzą.

### P1-A.4 — Lighthouse CI [ZROBIONE]

Lighthouse jest częścią CI. Zweryfikowany raport osiągał 100/100/100/100.

### P1-A.5 — feedback flow [ZROBIONE]

PWA zawiera `ScheduleFeedbackModal`, a API zapisuje zgłoszenia do tabeli `schedule_feedback` utworzonej w `0018_feedback.sql`.

## 6. P1-B — deployment i security [STATUS: BLUEPRINT GOTOWY, REALNE WDROŻENIE NIEPOTWIERDZONE]

### P1-B.1 — izolacja PostgreSQL/Redis/MinIO [ZROBIONE W BLUEPRINT]

`docker-compose.prod.yml` ogranicza porty administracyjne do `127.0.0.1`, używa wewnętrznych sieci i wystawia publicznie Caddy na 80/443.

### P1-B.2 — reverse proxy, TLS i PWA container [ZROBIONE W BLUEPRINT]

Repo zawiera Caddy oraz konteneryzację PWA/API/worker. To jest kompletna ścieżka wdrożeniowa w kodzie, ale nie dowód działającego publicznego środowiska.

### P1-B.3 — realny staging z domeną [NIEPOTWIERDZONE]

Runbook i konfiguracja istnieją. DoD wymaga faktycznego hosta, DNS/TLS, smoke testu z zewnątrz i obserwacji działania przez monitoring.

### P1-B.4 — backup/restore [CZĘŚCIOWO]

Skrypty `pnpm db:backup` i `pnpm db:restore` oraz weryfikacja SHA-256 istnieją.

**Nie uznajemy off-site DR za zrobione**, dopóki backup nie jest automatycznie kopiowany poza host i nie wykonano udokumentowanego restore drill z tego zewnętrznego artefaktu.

### P1-B.5 — security automation [ZROBIONE]

Zrobione:

- `pnpm audit --audit-level=high` w CI;
- frozen lockfile;
- API rate limiting i security headers;
- pinning krytycznych GitHub Actions do pełnych niezmiennych SHA commitów (`actions/checkout`, `actions/setup-node`, `actions/upload-artifact`, `actions/github-script`) w `ci.yml` i `live-source-staging.yml` (PR #124);
- CodeQL SAST workflow (`.github/workflows/codeql.yml`, PR #129) ze skanowaniem JavaScript/TypeScript (`security-extended,security-and-quality`) i eksportem SARIF jako workflow artifact.

Pozostaje (do rozważenia przy zmianie planu repozytorium):

- secret scanning / push protection tam, gdzie plan repo na to pozwala;
- dependency update automation.

### P1-B.6 — monitoring/alerting [BLUEPRINT, NIE REALNY STAGING]

Structured logs, `x-request-id`, `/v1/health` i procedury operacyjne istnieją. Realne alerty powinny być uznane za wykonane dopiero po wdrożeniu i zweryfikowaniu na środowisku staging.

## 7. P1-C — zwiększenie address coverage obecnych 8 gmin [STATUS: W TRAKCIE — KOSZALIN ODBLOKOWANY]

| Gmina | PRG | Supported | Unsupported | Coverage |
| --- | ---: | ---: | ---: | ---: |
| Koszalin | 10 240 | 10 240 | 0 | **100%** |
| Manowo | 1 210 | 46 | 1 164 | 3,80% |
| Bobolice | 2 080 | 65 | 2 015 | 3,13% |
| Świeszyno | 2 430 | 646 | 1 784 | 26,58% |
| Tychowo | 1 450 | 45 | 1 405 | 3,10% |
| Sianów | 3 520 | 559 | 2 961 | 15,88% |
| Polanów | 1 810 | 576 | 1 234 | 31,82% |
| Będzino | 2 290 | 785 | 1 505 | 34,28% |
| **RAZEM** | **25 030** | **12 962** | **12 068** | **51,79%** |

### P1-C.1 — model priorytetyzacji [ZROBIONE]

`pnpm census:prioritize` pozwala priorytetyzować źródła według liczby potencjalnie odblokowanych adresów, kosztu implementacji i ryzyka utrzymania.

### P1-C.2 — Koszalin [ZROBIONE]

Koszalin osiągnął 100% address coverage (10 240 / 10 240 PRG) dla pełnego harmonogramu miejskiego 5 frakcji (`MIXED`, `PAPER`, `METALS_PLASTICS`, `GLASS`, `BIO`):
- Wdrożono miejski harmonogram Koszalina z mapowaniem obszarów serwisowych (`SIMC: 0949448`);
- Odblokowano całe miasto Koszalin i podniesiono regionalne pokrycie z 1,66% do 42,53%;
- Utrzymano ambiguity na poziomie 0,00% i brak błędów klasyfikacji.

### P1-C.3 — kolejne zakresy

Wybierać następne źródła według mierzonego ROI i adapters reuse:
- **Sianów (wykonano w PR #119)**: rozbicie odpadów segregowanych na 3 kanoniczne frakcje (`METALS_PLASTICS`, `PAPER`, `GLASS`) dla Dąbrowy i Grabówka zostało zrealizowane. Dalszy backlog Sianowa to miasto Sianów oraz pozostałe trasy wiejskie (odblokowanie brakujących 3 489 adresów).
- **Będzino (Trasa II, EKOSAN)**: odblokowanie kolejnych miejscowości bez osłon śmietnikowych i posesji trudnodostępnych (kolejny najwyższy ROI: 2 277 adresów PRG).
- **Świeszyno, Polanów, Tychowo, Manowo, Bobolice**: sukcesywne włączanie rewirów o udowodnionej jednoznaczności (brak nakładania się tras i osłon).

### P1-C.4 — bramka coverage przed skalowaniem

Przed falą 20–50 kolejnych gmin:

- >=90–95% address coverage bieżącego pilota lub jawne zaakceptowane wyjątki;
- ambiguity <1%;
- unsupported scopes jawnie sklasyfikowane;
- regularny live-source health;
- brak krytycznych nierozstrzygniętych mismatches.

## 8. P2 — kontrolowany real-user pilot [STATUS: PRZYGOTOWANY, JESZCZE NIE URUCHOMIONY]

Bezpieczne zakresy 415 audytowanych adresów mogą posłużyć do kontrolowanego pilota bez czekania na 95% regionu.

### P2.1 — kohorty [ZDEFINIOWANE]

Runbook definiuje kohorty oparte na audytowanych zakresach m.in. Świeszyno-Chałupy, Bobolice-Kłanino, Manowo-Bonin+, Tychowo, Polanów-Garbno, Sianów-Grabówko, Będzino-Dworek i ograniczony Koszalin BIO.

Definicja kohorty nie jest równoznaczna z uruchomieniem rekrutacji ani aktywnym stagingiem.

### P2.2 — telemetry funnel [ZROBIONE]

Na `main` klient PWA rejestruje lejek i buforuje eventy offline, a backend w `apps/api` (`TelemetryController`, `TelemetryService`, migracja `0019_resident_telemetry.sql` wdrożone w PR `#113`) implementuje bezpieczny kolektor telemetryczny:

- backend collector `POST /v1/telemetry/events`;
- idempotencja po `event_id`;
- hashing SHA-256 identyfikatora instalacji przed zapisem w bazie;
- ścisła allowlista parametrów po stronie klienta i serwera;
- całkowity brak surowych `addressId` i `userAgent` w telemetryce (ochrona prywatności);
- oznaczenie retencji 90 dni i cykliczny cleanup;
- testy jednostkowe, kontrolera, serwisu i E2E na PostgreSQL.

**DoD:** endpoint działa end-to-end na realnym API, eventy są przechowywane zgodnie z minimalizacją danych i można policzyć funnel bez dokładnego adresu mieszkańca. Spełnione w PR `#113`.

### P2.3 — feedback mieszkańców [ZROBIONE W KODZIE]

Feedback UI i endpoint `POST /v1/feedback/schedule-discrepancy` są zaimplementowane. Realną wartość metryki oceniamy dopiero po uruchomieniu pilota.

## 9. Unit economics i source operations [STATUS: ZA MAŁO DANYCH]

Mierzyć:

- human-active onboarding time per source/municipality;
- adapter reuse rate;
- repeat-update automation rate;
- incidents per active source/month;
- drift detection rate i MTTR;
- manual review time;
- miesięczny maintenance/source-ops cost;
- koszt na 1000 supported addresses.

Obecna próbka jest zbyt mała do wiarygodnej ekstrapolacji na skalę kraju.

## 10. P3 — bramka rozszerzenia do kolejnych 20–50 gmin

Nie skalujemy geograficznie tylko dlatego, że technicznie można dodać kolejny adapter.

Warunki wejścia:

- branch protection / required CI albo formalnie zaakceptowana alternatywna polityka governance;
- każdy `main` commit automatycznie weryfikowany;
- regularny live-source monitoring;
- obecne 8 gmin >=90–95% coverage lub jawnie zaakceptowane wyjątki;
- ambiguity <1%;
- pełny PWA offline/stale/error E2E, a11y i Lighthouse;
- realny staging/production deployment zweryfikowany z zewnątrz;
- off-site backup i udany restore drill;
- realny monitoring/incident response;
- real-user pilot z wiarygodnymi KPI;
- znany realny miesięczny koszt utrzymania;
- brak krytycznych nierozstrzygniętych wrong-date mismatches.

## 11. Metryki sterujące decyzjami

- **Address coverage** i unsupported rate.
- **Correctness** i ambiguity.
- **Provenance completeness** i freshness.
- **Source health**, drift i MTTR.
- **Unit economics** per source/municipality/1000 supported addresses.
- **Adapter reuse** i repeat-update automation.
- **User value**: successful address lookup -> schedule shown -> reminder/calendar activation -> return visit.
- **Resident-reported correctness** i liczba zweryfikowanych rozbieżności.

## 12. Kolejność wykonawcza

1. **P0:** zmergować i zweryfikować guard integralności SHA (`#112`).
2. **P0:** rozstrzygnąć branch protection `#84`; do tego czasu nie oznaczać P0 jako zamkniętego.
3. **P2:** zmergować backend/privacy telemetry dopiero po pełnym zielonym CI (`#113`).
4. **P1-B:** uruchomić realny staging na domenie, z monitoringiem i zewnętrznym backupem.
5. **P1-A:** dodać prawdziwy cold-start offline z nowym browser context/service-worker cache bez ręcznego seedowania harmonogramu.
6. **P1-C:** zwiększać coverage, zaczynając od najwyższego ROI — Koszalin **[ZROBIONE — 100% Koszalina, regional coverage 42,53%]**, kolejny: Sianów.
7. **P2:** uruchomić ograniczoną kohortę mieszkańców i mierzyć funnel, feedback i błędy danych.
8. **P2:** zebrać miesięczne source-ops/unit economics.
9. **P3:** dopiero na tych danych podejmować decyzję o kolejnych 20–50 gminach.

## 13. Najważniejsza bramka biznesowo-techniczna

WastePL ma udowodnić trzy rzeczy przed agresywnym skalowaniem:

1. **Coverage:** przejście z 1,66% do >=90–95% bez nieutrzymywalnej ręcznej pracy per adres/gmina.
2. **Economics:** znany i malejący dzięki reuse koszt onboardingu oraz miesięcznego utrzymania.
3. **User value:** mieszkańcy znajdują adres, ufają harmonogramowi, aktywują przypomnienia i wracają.

Jeżeli te trzy warunki zostaną potwierdzone w realnym pilocie, obecny fundament techniczny jest wystarczająco mocny do skalowania WastePL jako krajowej warstwy danych i produktu dla mieszkańców.
