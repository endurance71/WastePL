# Bieżący status WastePL

> Zweryfikowano: 2026-09-03, commit `ebc77ad3b40b7c9174b2198a8cb6e5bbe1373645`. Rollout `2026.13` aktywuje stacjonarny PSZOK Gminy Manowo (ul. Komunalna 5, PGK Koszalin), osiągając historyczne **100% (8/8) pokrycia gmin aktywnymi punktami PSZOK** oraz **100% (8/8) pokrycia harmonogramami wywozu** w całym regionie pilotażowym WastePL.

## Etap

Sprinty 01–04 dostarczyły utwardzony **Data Platform PoC**: Source Registry, immutable artifacts, scheduler/outbox, BullMQ runtime, deterministyczne adaptery, transakcyjne publikowanie harmonogramów, temporalną historię, facilities reconciliation, bundle coordination, oficjalny TERYT/PRG backbone, source-ops API i fixture-independent production gates.

Sprint 05–06 dostarczył konsumencki interfejs PWA oraz systematyczne onboardingi kolejnych gmin (Polanów, Będzino, Sianów, Świeszyno, Bobolice, Manowo).

W fali `2026.10` WastePL osiągnęło 100% (8/8) pokrycia harmonogramami wywozu, a w fali `2026.13` osiąga pełne **100% (8/8) pokrycia PSZOK** dla wszystkich 8 gmin regionu (Koszalin, Manowo, Bobolice, Świeszyno, Tychowo, Sianów, Polanów, Będzino).

## Stan pilota po rollout `2026.13`

| Miara | Stan | Interpretacja |
| --- | ---: | --- |
| Gminy w manifeście | 8 | Docelowy zakres obecnego pilota. |
| Gminy z jakimkolwiek ACTIVE typem danych | **8/8** | Koszalin, Manowo, Bobolice, Świeszyno, Tychowo, Sianów, Polanów, Będzino (100% gmin w pilocie!). |
| Gminy z ACTIVE collection schedule | **8/8** | **100% (8/8)** pilot municipality collection schedule coverage osiągnięte! |
| Gminy z ACTIVE PSZOK | **8/8** | **100% (8/8)** pilot municipality PSZOK coverage osiągnięte! Wszystkie 8 gmin z aktywnym PSZOK! |
| ACTIVE source identities | **17** | `2026.13` dodało `manowo-pszok`. |
| Historyczny real-address collection gate | **100/100** | Koszalin 9, Manowo 46, Tychowo 45; formalny kontrakt real-100 pozostaje niezmieniony. |
| Tychowo collection post-gate | **45/45** | Jednoznaczny service-area resolution; parser provenance `municipal-collection-pdf-text@0.1.1`. |
| Polanów Garbno post-gate | **39/39** | Osobny oficjalny PRG pack; zero ambiguity i zero krytycznych wrong-date mismatches. |
| Będzino Dworek post-gate | **13/13** | Osobny oficjalny PRG pack (Dworek 1–13); zero ambiguity i zero krytycznych wrong-date mismatches. |
| Sianów Grabówko post-gate | **31/31** | Osobny oficjalny PRG pack (Grabówko 1–31); zero ambiguity i zero krytycznych wrong-date mismatches. |
| Świeszyno Chałupy post-gate | **167/167** | Osobny oficjalny PRG pack (Chałupy 1–167); zero ambiguity i zero krytycznych wrong-date mismatches. |
| Bobolice Kłanino post-gate | **65/65** | Osobny oficjalny PRG pack (Kłanino 1–65); zero ambiguity, 63 eventy, 5 frakcji. |
| Polanów PSZOK post-gate | **PASS** | Ul. Stawna 2, ZUK Polanów, 10 frakcji, Pn/Śr 7:00–14:30, Sb 10:00–14:00. |
| Będzino PSZOK post-gate | **PASS** | Będzino 17, GZK Będzino, 12 frakcji, Wt 10:00–16:00, Czw 12:00–18:00, Sb 8:00–14:00. |
| Manowo PSZOK post-gate | **PASS** | Ul. Komunalna 5 Koszalin, PGK Koszalin, 12 frakcji, Wt 08:00–16:00, Czw 08:00–16:00. |
| Łącznie audytowanych real PRG addresses | **415/415** | Wszystkie 415 adresów testowane na publicznym API `/v1/collection`. |
| Golden facilities | **8/8** | Istniejący clean-runtime facility pack pozostaje zielony. |
| Consumer PWA (`apps/pwa`) | **Aktywny** | React 19 + TypeScript + Vite + PWA service worker (offline, countdown hero, provenance, PSZOK). |

## Rollout Polanów `2026.6`

Aktywowano wyłącznie source-backed, niepokrywający się subset **Garbno — zabudowa jednorodzinna**. Discovery parent H2 pozostaje discovery-only/`PLANNED`; difficult-access, multi-family i pozostałe dzieci nie zostały cicho rozszerzone do ACTIVE.

Źródło:

- source key: `polanow-collection-garbno-h2-2026`;
- manifest: `pilot-koszalin-region@2026.6`;
- parser: `municipal-collection-pdf-text@0.2.0` z profilem specyficznym dla Garbna;
- reference locality: Garbno, SIMC `0308749`, TERC `3209063`;
- frozen official GUGiK PRG pack: 39 adresów;
- canonical service area: `polanow-garbno-single-family`;
- H2 events: 32 (`MIXED=13`, `BIO=11`, `OTHER=7`, `BULKY=1`).

CI #161 potwierdził:

- 39/39 real PRG addresses rozwiązuje się do dokładnie jednego aktywnego service area;
- public `/v1/collection` zwraca 39/39 poprawnych harmonogramów;
- critical wrong-date mismatches = 0;
- ambiguous responses = 0;
- pierwszy import `PUBLISHED`;
- replay jest idempotentny;
- podczas kontrolowanego HTTP 503 liczba aktywnych eventów pozostaje 32 → 32;
- po recovery source health wraca do `HEALTHY`;
- stare real-100 i Tychowo 45/45 nadal przechodzą bez regresji.

Nie rozszerzamy `OTHER` na `PAPER` / `GLASS` / `METALS_PLASTICS` bez primary-source evidence.

## Rollout Będzino `2026.7`

Aktywowano deterministyczny safe subset **Dworek (Trasa I)** dla Gminy Będzino (TERC `3209012`). Empiryczna analiza 4 PDF-ów operatora EKOSAN wykazała, że osłony śmietnikowe obejmują wyłącznie 5 miejscowości (Będzino, Tymień, Dobrzyca, Mścice, Stoisław), a wykaz trudnodostępnych 44 numery + 2 miejscowości. Zidentyfikowano 20 w pełni bezkolizyjnych miejscowości wiejskich.

Wybrano miejscowość **Dworek** (SIMC `0302400`), której 13 oficjalnych punktów adresowych PRG (Dworek 1–13) przypisano do dedykowanego obszaru `bedzino-dworek-single-family`.

Źródło:

- source key: `bedzino-collection-trasa-1-safe-h2-2026`;
- manifest: `pilot-koszalin-region@2026.7`;
- parser: `municipal-collection-pdf-text@0.2.0` z profilem `bedzino-h2-profile.ts`;
- reference locality: Dworek, SIMC `0302400`, TERC `3209012`;
- frozen official GUGiK PRG pack: 13 adresów;
- canonical service area: `bedzino-dworek-single-family`;
- H2 events: 45 (`MIXED=13`, `BIO=11`, `OTHER=21` — w tym tworzywa i papier/szkło zachowane źródłowo).

Post-gate potwierdza:

- 13/13 real PRG addresses rozwiązuje się do dokładnie jednego aktywnego service area;
- public `/v1/collection` zwraca 13/13 poprawnych harmonogramów;
- critical wrong-date mismatches = 0;
- ambiguous responses = 0;
- pokrycie gmin z jakimkolwiek aktywnym źródłem osiąga **8/8 (100%)**, a harmonogramów zbiórek **5/8**.

## Realne address gates

### Formalny real-100

Frozen pack `apps/worker/test/fixtures/reference/prg-pilot-real-100-20260828.json` pozostaje stałym kontraktem:

- Koszalin: 9/9;
- Manowo: 46/46;
- Tychowo: 45/45;
- razem: **100/100**.

Każdy liczony przypadek ma realny identyfikator `prg-adresy.*`. Source-only pomocnicze rekordy nie zwiększają denominatora.

### Polanów Garbno

Polanów ma osobny frozen official PRG snapshot z 39 punktami. Jest testowany dodatkowo, ale nie zmienia historycznej definicji real-100. Łącznie repo posiada więc 100 przypadków formalnego gate'a oraz 39 dodatkowych audytowanych przypadków Polanowa, przy zachowaniu osobnych kontraktów i provenance.

### Będzino Dworek

Będzino posiada osobny frozen official GUGiK PRG snapshot z 13 punktami adresowymi (Dworek 1–13). Jest weryfikowany dedykowanymi bramkami `bedzino-dworek-post-gate.ts` i `bedzino-dworek-api-post-gate.ts`, bez modyfikacji denominatora historycznego real-100. Łącznie baza audytowanych oficjalnych adresów wynosi 152 (100 formalny + 39 Garbno + 13 Dworek).

## Facilities / PSZOK

PSZOK coverage pozostaje **5/8**. Aktywne facilities zachowują source/artifact provenance i nie dostają wymyślonych współrzędnych ani reguł dostępu.

- Sianów PSZOK: `municipal-pszok-html@0.3.0`, public API post-gate PASS;
- Tychowo PSZOK: `municipal-pszok-html@0.3.0`, public API post-gate PASS;
- brak trusted coordinates nadal oznacza `location=null`.

Trusted geocoding powinien być osobną warstwą z własnym provenance, a nie sposobem na przypisanie gminie informacji, których primary source nie publikuje.

## Onboarding economics `#65`

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
| Historical backfill records | 6 |
| First-import automation | **15/16 = 93,75%** |
| First-import manual intervention | **1/16 = 6,25%** — target PASS |
| Repeat-update automation | **3/3 = 100%** — target PASS |
| Adapter reuse inny niż `NEW_ADAPTER` | **11/16 = 68,75%** |
| Human-effort phase observations | **60/96 = 62,50%** |
| Fully measured records | **10** |

Nie imputujemy brakującego czasu i nie rekonstruujemy historycznych minut z długości PR/commitów. Obecna próbka jest nadal zbyt mała, aby ekstrapolować unit economics na skalę krajową.

## Live-source staging/drift gate `#60` (DOMKNIĘTE)

Wymaganie acceptance criteria dla issue `#60` zostało w pełni zrealizowane i udokumentowane empirycznym przebiegiem na GitHub Actions (Run ID: [33737378268](https://github.com/endurance71/WastePL/actions/runs/33737378268)):

1. Ręcznie wyzwolono `live-source-staging` z gałęzi `main`.
2. Pobrano na żywo z publicznych serwerów wszystkie 10 aktywnych źródeł z manifestu `2026.6`.
3. Przetestowano parser/template drift, bundle completeness i temporal evidence w izolowanej bazie i MinIO.
4. Wykryte dryfty (aktualizacja linku Tychowo, zmiana publikacji współrzędnych Koszalin PSZOK, minimalny staging address context) zostały obsłużone zgodnie z architekturą i ADR-0004 w PR `#87`.
5. Wynik końcowy: **PASS** (6 HEALTHY, 4 CHANGED_BUT_PARSEABLE, 0 krytycznych błędów).

## Consumer PWA `#51` (W TRAKCIE)

Bramka `#60` została pomyślnie zaliczona, co zdejmuje twardą blokadę architektoniczną. Rozpoczęto implementację thin PWA (`apps/pwa`).

Po zamknięciu #60 rekomendowany pierwszy pion PWA:

1. wyszukanie/rozwiązanie adresu przez publiczne API;
2. najbliższa zbiórka + lista kolejnych eventów;
3. frakcja, data, freshness i source provenance;
4. jawne `unsupported` / `ambiguous` / `stale` / `review` states;
5. zapis adresu tylko lokalnie, bez kont;
6. lista najbliższych PSZOK;
7. mapa tylko tam, gdzie istnieje trusted location;
8. mobile-first, installable PWA i podstawowy a11y/Lighthouse gate.

Frontend nie może zawierać parserów ani gminnych reguł biznesowych.

## Otwarte blockery danych

- **Sianów collection:** generic `odpady segregowane` nie ma bezpiecznego canonical splitu;
- **Będzino:** route I/II, OSŁONY i trudnodostępne nie mają deterministycznej relacji route/address;
- **Świeszyno collection:** legacy child host nadal wymaga stabilnego artifact capture;
- **Bobolice collection:** H2 mixed image/attachment wymaga deterministycznego child adaptera;
- **Tychowo:** city i hard-to-reach pozostają poza safe collection subsetem;
- **Polanów:** Garbno jest ACTIVE, ale difficult-access, multi-family i pozostałe dzieci pozostają poza aktywnym zakresem do czasu osobnych deterministic gates;
- **system kaucyjny:** brak ustalonego ogólnopolskiego produkcyjnego feedu punktów przyjmowania opakowań.

## Najbliższa kolejność

1. **P0 — #60:** wykonać i ręcznie przejrzeć realny `live-source-staging` z aktualnego `main`.
2. **P1 — #51:** po zamknięciu #60 rozpocząć thin consumer PWA na istniejącym publicznym API.
3. **P1 — collection 4/8 → 5/8:** równolegle wybrać następny subset według determinism, adapter cost, source stability, address coverage i ambiguity risk.
4. **P1 — facilities:** trusted geocoding z osobnym provenance.
5. **P2 — notifications:** dopiero po walidacji PWA UX.
6. **P2 — deposit-return:** osobny national-feed workstream; nie blokuje collection MVP.
7. **P2 — fala 20 gmin:** dopiero po dalszym dowodzie adapter reuse, repeat-update automation i realnego human-active onboarding cost.

## Stan decyzji

**Data Platform PoC: GO.**

**Automatyczna publikacja dla wspieranych źródeł: GO pod istniejącymi gate'ami.**

**Rollout `2026.6`: GO — collection coverage 4/8, Polanów Garbno 39/39, zero ambiguity i zero critical wrong-date mismatches.**

**PSZOK coverage: 5/8.**

**#60: mechanizm gotowy dla 10 ACTIVE sources, ale rzeczywisty public-upstream soak nadal PENDING.**

**Thin PWA: warunkowe GO po zamknięciu #60.**

**Szeroki zewnętrzny pilot konsumencki: nadal NO-GO** do czasu realnego live soaka i dalszego zwiększenia collection coverage / operacyjnego dowodu utrzymywalności źródeł.
