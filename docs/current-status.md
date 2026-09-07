# Bieżący status WastePL

> Zweryfikowano: 2026-09-07, commit `81510d43aa48a0ee2e3d879d69ada5dd717437d4`. Stan odnosi się do `main` oraz manifestu `pilot-koszalin-region@2026.13`.

## Executive summary

WastePL ma działającą, dobrze przetestowaną regionalną platformę danych dla 8 gmin pilota, 17 aktywnych źródeł, konsumencką PWA, offline/PWA, Web Push, PSZOK, provenance oraz rozbudowane bramki CI/production-readiness.

Aktualny konserwatywny wynik pokrycia to **12 816 audytowanych adresów z deterministycznym harmonogramem na bieżącym baseline 25 030 adresów PRG = 51,20% audited supported coverage**.

Ta liczba **nie jest jeszcze pełnym wynikiem resolvera dla całej populacji**. Po audycie implementacji Census w PR #145 obowiązuje jawny tryb `AUDITED_REFERENCE_PACKS`, a `fullPopulationResolutionVerified=false`. Pozostałe 12 214 adresów nie zostało jeszcze sklasyfikowanych adres-po-adresie jako `UNSUPPORTED` / `AMBIGUOUS` / `ERROR`. Pełny audyt śledzi P0 #144.

Projekt **nie jest jeszcze gotowym ogólnopolskim systemem produkcyjnym**. Najważniejsze braki przed publicznym skalowaniem to:

1. **P0 #144:** pełny, wersjonowany snapshot PRG i rzeczywista klasyfikacja resolvera dla całej populacji pilota;
2. zwiększenie audited supported coverage do co najmniej 90%, preferowane 95%+, bez inferowania harmonogramów ponad źródło;
3. deployment staging/prod i pilotaż z realnymi użytkownikami;
4. branch protection `main` — issue #84;
5. pomiar realnego maintenance cost / municipality / source.

## Jak czytać coverage

Od PR #145 rozdzielamy cztery pojęcia:

- **municipality source presence** — gmina ma co najmniej jeden aktywny collection scope;
- **audited supported coverage** — liczba oficjalnych adresów PRG znajdujących się w zamrożonych, audytowanych paczkach z deterministycznym harmonogramem, podzielona przez bieżący terytorialny baseline PRG;
- **audited-address correctness** — poprawność w aktywowanych i jawnie zweryfikowanych paczkach referencyjnych;
- **full-population resolver coverage** — docelowa metryka z #144, w której każdy adres PRG otrzyma faktyczny wynik runtime resolvera.

**8/8 gmin z ACTIVE collection source nie oznacza 100% coverage.**

**51,20% nie oznacza, że pozostałe 48,80% zostało dowiedzione jako `UNSUPPORTED`.** Na obecnym etapie jest to remainder bez pełnej klasyfikacji resolvera.

Globalne `0 ambiguity / 0 errors / 0 conflicts` nie może być publikowane jako wynik dla wszystkich 25 030 adresów, dopóki #144 nie wykona pełnego audytu. Obecne zera dotyczą aktywowanych, deterministycznych paczek i ich gate'ów.

## Stan pilota `2026.13`

| Miara | Stan | Interpretacja |
| --- | ---: | --- |
| Gminy w manifeście | **8** | Koszalin, Manowo, Bobolice, Świeszyno, Tychowo, Sianów, Polanów, Będzino. |
| Gminy z >=1 ACTIVE collection scope | **8/8** | Municipality source presence = 100%. |
| Gminy z ACTIVE PSZOK | **8/8** | Każda gmina pilota ma aktywny PSZOK. |
| ACTIVE source identities | **17** | 9 collection + 8 PSZOK. |
| Audited supported coverage | **51,20% (12 816 / 25 030)** | Tryb `AUDITED_REFERENCE_PACKS`, nie pełny census resolvera. |
| Full-population resolution verified | **NIE** | P0 #144. |
| Remaining population bez full classification | **12 214** | Nie należy automatycznie nazywać jej `UNSUPPORTED`. |
| Koszalin | **10 240 / 10 240 audited supported** | Pełny harmonogram miejski 5 frakcji w bieżącym baseline. |
| Manowo | **46 / 1 210 audited supported** | Legacy 2AB; migracja kanoniczności do bieżącego indeksu PGK śledzona w #143. |
| Bobolice | **65 / 2 080 audited supported** | Kłanino safe subset. |
| Świeszyno | **646 / 2 430 audited supported** | Chałupy 167 + Trasa II safe rural 479. |
| Tychowo | **45 / 1 450 audited supported** | Historyczny real-address subset. |
| Sianów | **559 / 3 520 audited supported** | Grabówko 31 + Borowiec rural 90 + Dąbrowa 93 + Skwierzynka 345. |
| Polanów | **430 / 1 810 audited supported** | Garbno 39 + rural set A 391. |
| Będzino | **785 / 2 290 audited supported** | Trasa I 487 + Trasa II safe rural 298. |
| Trusted PSZOK geocoding | **8/8** | Zweryfikowana warstwa referencyjna. |
| Consumer PWA | **PRE-PRODUCTION / działa** | Address flow, schedule, provenance, PSZOK/mapa, offline, Web Push. |
| Playwright | **PASS** | Multi-device E2E, a11y, offline/stale/error i true cold-start service worker. |
| Lighthouse CI | **100/100/100/100 PASS** | Performance, Accessibility, Best Practices, SEO. |
| Security | **PASS / wdrożone** | Dependency audit + CodeQL SAST + security headers + rate limiting. |
| Branch protection `main` | **WYŁĄCZONE** | P0 #84; do czasu rozwiązania obowiązuje proceduralny PR + CI + CodeQL + squash-only-on-green. |

### Autorytatywne TERC-y pilota

PR #145 skorygował dwa błędne kody w dawnym Censusie. Aktualne kody używane jako kontrakt to:

| Gmina | TERC |
| --- | --- |
| Koszalin | `3261011` |
| Manowo | `3209042` |
| Bobolice | `3209033` |
| Świeszyno | `3209082` |
| Tychowo | `3201043` |
| Sianów | `3209073` |
| Polanów | `3209063` |
| Będzino | `3209012` |

## Census / Address Coverage — stan po PR #145

PR #145 naprawił metodologię raportowania bez sztucznego zmieniania liczby już audytowanych adresów.

Bieżący Census v2.1:

- `measurementMode = AUDITED_REFERENCE_PACKS`;
- `qualityScope = AUDITED_REFERENCE_PACKS_ONLY`;
- `fullPopulationResolutionVerified = false`;
- `totalAuditedAddresses = 12 816`;
- baseline terytorialny = 25 030;
- remaining unaudited = 12 214;
- wynik = 51,20% audited supported coverage.

Pola kompatybilności `unsupportedAddresses` / `totalUnsupported` nie są obecnie dowodem runtime resolution dla remainder. Raport jawnie opisuje tę różnicę.

### P0 #144 — wymagany pełny census

Definition of Done dla #144:

- kompletny, wersjonowany snapshot oficjalnych punktów PRG dla wszystkich 8 gmin;
- denominator wyliczany z datasetu, a nie ręcznie utrzymywanych sum;
- provenance, data pozyskania i SHA;
- każdy adres przechodzi przez **ten sam persistence-backed resolver co resident API**;
- każdy adres otrzymuje dokładnie jeden wynik: `SUPPORTED`, `UNSUPPORTED`, `AMBIGUOUS` albo `ERROR`;
- wszystkie quality counters są wyliczane z rzeczywistych wyników;
- CI blokuje publikację globalnych zer bez pełnego evaluated denominator.

PR #146 wykonał pierwszy techniczny krok: persistence-backed service-area resolver został współdzielony między runtime API a przyszłym Census. API zachowuje cienki `PgServiceAreaResolver`, ale SQL, mapowanie INCLUDE/EXCLUDE i finalne wywołanie `resolveServiceArea()` mają teraz jeden wspólny kontrakt.

## Źródła i live-source staging

Manifest `2026.13` ma 17 ACTIVE source identities.

Najważniejsze potwierdzone fakty:

- ostatni pełny ręczny/current-main soak z 2026-09-04: 17/17 PASS, 0 FAIL, 0 REVIEW_REQUIRED;
- 2026-09-07 ponownie uruchomiono wcześniejszy run #8 jako fresh-network attempt;
- fresh-network rerun zakończył się **success dla 17/17 ACTIVE sources**;
- rerun używał historycznego code SHA `04bd1cb`, więc jest dowodem bieżącej osiągalności i parsowalności upstreamów, **nie** dowodem current-HEAD code execution;
- Manowo legacy `2AB.pdf` nadal odpowiada HTTP 200, parsuje się i publikuje poprawnie, więc #143 jest migracją kanoniczności, nie outage'em.

Do dokładnego current-HEAD network proof należy użyć kolejnego scheduled/workflow-dispatch runu na aktualnym `main`. Obecny connector nie udostępnia wywołania `workflow_dispatch` dla nowego HEAD.

## Bezpieczne zasady rozszerzania coverage

Obowiązuje zasada: **unsupported jest lepsze niż błędny harmonogram**.

Nowe rewiry można aktywować wyłącznie, gdy mamy łącznie:

1. oficjalny artefakt harmonogramu;
2. deterministyczny parser i jawne mapowanie semantyki;
3. oficjalne punkty PRG / reguły adresowe;
4. zero-overlap proof względem wyjątków, osłon, wspólnot i trudnodostępnych posesji;
5. readiness/post-gate i brak regresji na istniejących adresach.

### Sianów

Po PR #140 źródłowa kolumna `odpady segregowane` pozostaje kategorią zbiorczą `OTHER`. WastePL nie może inferować z niej PAPER / GLASS / METALS_PLASTICS.

Route 13 (Karnieszewice, Kołzin, Płonka) jest śledzona w #141. Aktywacja wymaga zamrożenia właściwego bieżącego H2 artefaktu oraz paczek PRG; starszy pełnoroczny harmonogram nie może zastąpić aktualnego H2 PDF.

### Manowo

Legacy `2AB.pdf` nadal działa, ale aktualny indeks PGK rozdziela Manowo na `manowo3/*`. Issue #143 prowadzi migrację tak, aby najpierw zachować 46/46 obecnych adresów, a dopiero potem zwiększać coverage.

### Będzino / Świeszyno / Polanów / Bobolice / Tychowo

Kolejne partie wyłącznie na podstawie jawnego official artifact + PRG + deterministic rules. Nie aktywować szerokiego rewiru tylko dlatego, że nazwa trasy sugeruje przynależność miejscowości.

## PWA i resident experience

Obecnie działa:

- wyszukiwanie i wybór adresu przez WastePL API;
- najbliższe odbiory i kolejne terminy;
- provenance i freshness;
- PSZOK i mapa Leaflet/OpenStreetMap dla trusted locations;
- local persistence wybranego adresu;
- service worker i cache runtime;
- true cold-start offline z Cache Storage;
- eksport `.ics`;
- Web Push: VAPID, subscription storage, scheduler, sender i service-worker delivery;
- automatyczne czyszczenie wygasłych subskrypcji 404/410;
- feedback API dla rozbieżności harmonogramu;
- pseudonimowa telemetria resident funnel bez surowych adresów.

## Produkcja / operacje

Gotowe elementy:

- `docker-compose.prod.yml`;
- Caddy/TLS reverse proxy;
- PWA Nginx SPA container;
- DB/Redis/MinIO topology;
- `db:backup` z checksumem i metadanymi;
- `db:restore` z weryfikacją SHA, dry-run i atomic restore;
- structured JSON logs i `x-request-id`;
- health endpoint z DB ping;
- rate limiter;
- HSTS / nosniff / X-Frame-Options / CORS;
- dependency audit;
- CodeQL SAST;
- deployment/DR runbook.

Brakuje rzeczywistego staging/prod deploymentu i obserwacji zachowania systemu przy realnym ruchu użytkowników.

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

Próbka jest nadal za mała do wiarygodnej ekstrapolacji ogólnopolskiej. Potrzebny jest realny miesięczny maintenance/source-ops cost per municipality/source.

## Repo i CI

Na moment weryfikacji `main` nie ma aktywnego branch protection. Issue #84 pozostaje P0.

Mechanizmy kompensacyjne:

- praca na branchach i PR-ach;
- `pnpm install --frozen-lockfile`;
- `docs:check` i `contracts:check`;
- build + typecheck + pełne testy;
- readiness + fixture-independent production gate;
- Playwright + cold-start offline;
- API health smoke;
- dependency security audit;
- Lighthouse CI;
- CodeQL;
- krytyczne GitHub Actions przypięte do pełnych SHA;
- squash merge dopiero po zielonych checkach.

## Najbliższa kolejność prac

1. **P0 #144:** pełny PRG acquisition + versioned snapshot + full-population resolver audit;
2. **P0 #84:** branch protection / required CI po zmianie planu lub widoczności repo;
3. **P1:** zwiększanie audited supported coverage z 51,20% do >=90%, preferowane 95%+;
4. **P1:** fresh live-source staging na aktualnym HEAD po istotnych zmianach danych/parserów;
5. **P2:** rzeczywisty staging/prod deployment;
6. **P2:** pilot 10–20 użytkowników, następnie 50–100 po spełnieniu quality gates;
7. **P2:** mierzyć address-search success, unsupported, ambiguity, feedback mismatch, notification delivery i retention;
8. **P3:** dopiero po dowodzie jakości i ekonomii rozszerzać region/kolejne gminy.

## Bramka wyjścia z obecnego pilota

Pilot można uznać za gotowy do skalowania dopiero, gdy:

- #144 daje pełny, reprodukowalny census całej populacji PRG;
- coverage osiąga uzgodniony próg >=90–95% lub istnieje jawnie zaakceptowany wyjątek;
- ambiguity/error/conflict rates są **zmierzone** na pełnym denominatorze, a nie założone;
- live-source staging działa regularnie na bieżącym kodzie;
- PWA zachowuje browser E2E/a11y/offline/Lighthouse;
- staging/prod ma monitoring, backup i procedurę incident response;
- znamy realny koszt wdrożenia i utrzymania gminy;
- nie ma krytycznych wrong-date mismatches w audytowanych zakresach.

**Sama liczba ACTIVE sources ani 8/8 municipality source presence nie jest bramką wyjścia.**
