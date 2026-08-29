# Bieżący status WastePL

> Zweryfikowano: 2026-08-29. `main` przed PR `#71`: `ba1e1abb79202db520f75b9ec4ac3b5c173a2bd4`. Mechanizm live-source gate w PR `#71` przeszedł pełny deterministyczny CI #123 (`33244427495`) na headzie `9ae05998051d0490493acfce7911e02040ac6be8`; końcowa zmiana dokumentacyjna podlega finalnemu rerunowi przed merge.

## Etap

Sprinty 01–04 dostarczyły produkcyjnie utwardzony Data Platform PoC: Source Registry, immutable artifacts, scheduler/outbox, BullMQ runtime, deterministyczne parsery, transakcyjne publikowanie harmonogramów, temporalną historię, facilities reconciliation, bundle coordination, oficjalny TERYT/PRG backbone, source-ops API i fixture-independent production gates.

Sprint 05 rozszerza rzeczywiste collection coverage, jakość pilota i ekonomię onboardingu. PR `#68` zamknął `#64`: clean production consumer gate obejmuje dokładnie 100 realnych adresów GUGiK PRG. PR `#70` scalił warstwę pomiarową `#65`: machine-readable onboarding metrics, adapter reuse, source complexity i first-import/repeat-update automation bez rekonstruowania historycznych minut pracy.

WastePL nadal nie jest kompletnym produktem konsumenckim dla wszystkich ośmiu gmin. Brak danych jest traktowany jako brak pokrycia, nigdy jako powód do zgadywania harmonogramu.

## Stan pilota po rollout `2026.3`

| Miara | Stan | Interpretacja |
| --- | ---: | --- |
| Gminy w manifeście | 8 | Docelowy zakres pilota. |
| Gminy z jakimkolwiek aktywnym typem danych | 5 z 8 | Koszalin, Manowo, Bobolice, Świeszyno, Tychowo. |
| Gminy z aktywnym harmonogramem | 3 z 8 | Koszalin, Manowo i bezpieczny subset Tychowa. |
| Gminy z aktywnym PSZOK | 3 z 8 | Koszalin, Bobolice, Świeszyno. |
| Źródła ACTIVE | 7 | 3 collection + 4 facility/bundle members. |
| Źródła PLANNED | 8 | Jawne blockery; brak silent fallback. |
| Real-address collection gate | 100/100 | 100% consumer API correctness. |
| Krytyczne schedule/date mismatches | 0 | Tolerancja = 0. |
| Ambiguous responses | 0 | Brak cichego rozstrzygania. |
| Golden facilities | 8/8 | 100% clean-runtime consumer API gate. |

## Realny golden pack 100 adresów

Frozen evidence znajduje się w `apps/worker/test/fixtures/reference/prg-pilot-real-100-20260828.json` i nie wymaga internetu w PR CI.

Rozkład:

- Koszalin: 9/9;
- Manowo: 46/46;
- Tychowo: 45/45;
- łącznie: 100/100.

Każdy liczony przypadek ma realny identyfikator `prg-adresy.*`. Production gate odrzuca syntetyczne `wastepl-gate-*`. `Bogusława II 1-3` pozostaje source-only support row z `prg_id=NULL` i nie jest liczony do 100 realnych punktów PRG.

Consumer gate osiąga correctness `1.0` przy wymaganym minimum `0.99`; critical schedule/date mismatches = `0`, ambiguous responses = `0`, facilities = `8/8`.

## Tychowo

Realny PRG ujawnił różnicę źródłową `Pobądź` vs oficjalne PRG/TERYT `Pobądz`, SIMC `0313704`. Parser `municipal-collection-pdf-text@0.1.1` obsługuje jeden jawny alias `Pobądź -> Pobądz`; nie używa fuzzy matching.

Aktywny standard subset Tychowa ma 3 service areas i 45/45 realnych przypadków rozwiązuje się do dokładnie jednego service area. Miasto Tychowo i hard-to-reach properties pozostają poza aktywnym zakresem do czasu jednoznacznego modelu źródłowego.

## Onboarding economics `#65`

PR `#70` został scalony do `main` jako `ba1e1abb79202db520f75b9ec4ac3b5c173a2bd4` i dodał:

- `schemas/onboarding-metrics-v0.1.schema.json`;
- `metrics/onboarding/pilot-koszalin-region-v0.1.json`;
- agregat metryk;
- `scripts/check-onboarding-metrics.mjs` w `contracts:check`.

Jednostką pomiaru jest `municipality × data type × source wave`. Baseline obejmuje 6 aktywacji: Koszalin collection, Koszalin PSZOK, Manowo collection, Bobolice PSZOK, Świeszyno PSZOK, Tychowo collection.

Aktualny baseline:

| Miara | Wynik |
| --- | ---: |
| First-import manual intervention | 1/6 = 16,67% |
| Repeat-update automation | 3/3 = 100% |
| Adapter reuse inny niż `NEW_ADAPTER` | 1/6 = 16,67% |
| Human-effort phases measured | 0/36 |
| Total engineering/data-ops time | `UNKNOWN` |

Historycznych minut nie rekonstruujemy z commitów, PR ani długości sesji. `2026.3` jest ostatnim manifestem dopuszczającym historyczny backfill. Każda nowa aktywacja po `2026.3` musi mieć `measurementMode=PROSPECTIVE` i sześć faz mierzonych `PROSPECTIVE_TIMER`: discovery, source assessment, parser implementation, regression fixture, address/service-area mapping i review. Brak rekordu zatrzymuje CI.

`#65` pozostaje otwarte do pierwszej pełnej prospektywnie zmierzonej aktywacji, bo dopiero ona pozwoli podać realny koszt human-active time.

## Live-source staging/drift gate `#60`

Audyt po rollout `2026.3` wykazał, że istniejący live gate był zestarzały: nadal ładował manifest `2026.2` i dokładnie sześć ACTIVE sources, więc nie sprawdzał aktywnego Tychowa.

PR `#71` aktualizuje mechanizm przed pierwszym właściwym soakiem:

- gate wybiera najnowszy `pilot-koszalin-region-*` zamiast hardcoded `2026.2`;
- wersje są sortowane numerycznie (`2026.10 > 2026.9`);
- aktualny zestaw to 7 ACTIVE sources z `2026.3`, łącznie z `tychowo-collection-standard-2026`;
- reference backbone jest ten sam frozen real 100-address PRG pack co w clean production gate, nie stary syntetyczny slice;
- `Bogusława II 1-3` pozostaje source-only support row poza realnym PRG count;
- facility sources wymagają canonical evidence także bez hardcoded canonical key;
- member bundle, który początkowo zwrócił `WAITING_FOR_COMPANION`, nie powoduje fałszywego critical failure, jeśli companion później atomowo ukończył bundle i canonical evidence istnieje;
- report gate version = `0.2.0`;
- workflow nadal jest wyłącznie `workflow_dispatch`, używa izolowanej bazy i izolowanego bucketu oraz nie zapisuje produkcyjnych danych.

Deterministyczny CI #123 na kodzie #71 przeszedł docs/contracts, migracje, build/typecheck, wszystkie testy, historyczne readiness, 100-real-address production gate, raporty i API smoke.

**Ważne:** #71 aktualizuje mechanizm, ale nie stanowi samego live-source soaka. `#60` pozostaje otwarte, dopóki z aktualnego `main` nie zostanie wykonany i przejrzany rzeczywisty `workflow_dispatch` przeciw publicznym upstreamom.

## Production runtime i provenance

W runtime są zarejestrowane m.in.:

- `pgk-koszalin-pdf-text`;
- `municipal-collection-pdf-text`;
- `pgk-koszalin-pszok-html`;
- `municipal-pszok-html`.

Harmonogramy zachowują artifact UUID, SHA-256, parser key/version i source URL. Publikacje są transakcyjne, replay idempotentny, a poprzednie `collection_events` są zamykane przez `valid_to`. Koszalin PSZOK używa bundle `main + faq` z `WAITING_FOR_COMPANION` i last-known-good semantics.

`ARTIFACT_PROCESSING_ENABLED` pozostaje deploymentowo opt-in.

## Będzino i pozostałe NO-GO

Będzino pozostaje `PLANNED`: exact child URLs są znane, ale relacja route I/II, OSŁONY i zbioru trudnodostępnego do adresów/lokalności nie jest jeszcze deterministyczna.

Sianów ma blocker generic `odpady segregowane`. Świeszyno schedule wymaga stabilnego child capture ze starego hosta. Bobolice collection i Polanów wymagają dalszego deterministycznego modelu child artifacts.

## Pozostałe blokery przed zewnętrznym pilotem

- collection schedule obejmuje 3 z 8 gmin;
- pierwszy rzeczywisty live-source staging soak z aktualnego `main` nie został wykonany;
- miasto Tychowo i hard-to-reach wyjątki pozostają bez publikacji;
- Będzino wymaga deterministycznej relacji route/address;
- ogólnopolski produkcyjny feed punktów systemu kaucyjnego nie jest ustalony;
- `ARTIFACT_PROCESSING_ENABLED` pozostaje opt-in;
- brak pierwszego prospektywnie zmierzonego human-active onboarding record.

## Najbliższa kolejność

1. Scalić PR `#71` po finalnym zielonym CI; `#60` pozostawić otwarte do faktycznego live runu.
2. Uruchomić i ręcznie przejrzeć `live-source-staging` z aktualnego `main`.
3. Wybrać następną bezpieczną aktywację źródła i od początku mierzyć sześć faz onboardingu dla `#65`.
4. Kontynuować collection coverage tylko tam, gdzie service-area mapping jest deterministyczny.
5. PWA `#51` rozpocząć dopiero po spełnieniu live-soak start gate i przy zachowaniu obecnych data-quality gates.

## Stan decyzji

**Data Platform PoC: GO.**

**Automatyczna publikacja dla wspieranych źródeł: GO pod istniejącymi gate'ami.**

**#64 — 100 realnych adresów: DONE, PR `#68`.**

**#65 — warstwa pomiarowa: DONE w PR `#70`; realny human-time nadal UNKNOWN do pierwszej prospektywnej aktywacji.**

**#60 — mechanizm live-source gate: aktualizacja #71 przeszła CI #123; rzeczywisty live soak nadal PENDING.**

**Zewnętrzny szeroki pilot konsumencki: NO-GO**, dopóki nie zostanie wykonany aktualny live-source soak i nie wzrośnie deterministyczne collection coverage.