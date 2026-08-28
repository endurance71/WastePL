# Bieżący status WastePL

> Zweryfikowano: 2026-08-28, commit `7d4897ad8536ab8fda8fc88580c5bb2ae574307b` (PR `#59`, pełny CI run `33182354045`, run #104).

## Etap

Sprinty 01–03 są ukończone. W Sprincie 04 dostarczono runtime przetwarzania artefaktów (S04-01), automatyczne transakcyjne publikowanie harmonogramów z historią wersji i publicznym provenance (S04-02), deterministyczną koordynację wieloartefaktowych źródeł facilities (S04-03), drugą falę źródeł z wersjonowanym manifestem `pilot-koszalin-region@2026.2` oraz fixture-independent pilot production gate `#45`.

Production handlery `pgk-koszalin-pdf-text`, `pgk-koszalin-pszok-html` i `municipal-pszok-html` są zarejestrowane w artifact runtime. Surowe źródła `PDF_TEXT` przechodzą przez ekstrakcję tekstu z raw PDF przed deterministycznym adapterem. Fixture-independent gate potwierdza, że testowany zakres pilota można odbudować na osobnej czystej bazie przez rzeczywistą ścieżkę runtime bez preseedowanych canonical collection/facility rows. `ARTIFACT_PROCESSING_ENABLED` pozostaje domyślnie opt-in do czasu osobnej decyzji deployment/staging; przejście gate nie jest równoznaczne z uruchomieniem zewnętrznego pilota.

WastePL jest obecnie produkcyjnie utwardzonym Data Platform PoC dla testowanego zakresu, ale nadal nie jest kompletnym produktem konsumenckim dla ośmiu gmin.

## Stan pilota

| Miara | Stan | Interpretacja |
| --- | ---: | --- |
| Gminy w manifeście | 8 | Zakres docelowej fali pilotażowej. |
| Gminy z jakimkolwiek aktywnym typem danych | 4 z 8 | Koszalin, Manowo, Bobolice i Świeszyno. |
| Gminy z aktywnym harmonogramem | 2 z 8 | Koszalin i Manowo. |
| Gminy z aktywnym PSZOK | 3 z 8 | Koszalin, Bobolice i Świeszyno. |
| Źródła aktywne | 6 | 2 harmonogramy, 2 człony bundle PSZOK Koszalin, PSZOK Bobolice i PSZOK Świeszyno. |
| Źródła planowane | 7 | Pozostają nieschedulowane i mają jawne blockery. |
| Golden addresses | 30 z 30 | 100% w clean-runtime consumer API gate; nie docelowe 100 realnych adresów. |
| Golden facilities | 8 z 8 | 100% w clean-runtime consumer API gate. |

Rozbieżność 30 vs 100 pozostaje jawna: 30 adresów to istniejąca bramka regresyjna; minimum 100 realnych adresów rozłożonych na pilot to nadal kryterium przed zewnętrznym pilotem konsumenckim.

Manifest `2026.1` pozostaje historyczny i nie został nadpisany. Rollout `2026.2` zachowuje stabilne source UUID/history dla niezmienionych tożsamości źródeł. Tylko dwa nowe źródła zostały promowane do `ACTIVE`: `bobolice-pszok` i `swieszyno-pszok`.

## Dostarczone możliwości

- rejestr źródeł, warunkowe pobieranie HTTP, SHA-256, deduplikacja i niemutowalne artefakty;
- wersjonowane manifesty źródeł i scheduler/outbox;
- artifact processing worker z weryfikacją SHA i dispatch po `parser_key`;
- bezpieczna ekstrakcja tekstu z raw PDF dla źródeł `PDF_TEXT`, z limitem rozmiaru i jawnym błędem dla nieczytelnego PDF;
- parsery deterministyczne dla aktywnych źródeł PDF_TEXT i HTML;
- transakcyjne publikowanie harmonogramów z source ownership, idempotent replay i last-known-good;
- temporalna historia `collection_events` przez `valid_from`/`valid_to` zamiast hard-delete;
- publiczne provenance harmonogramu: artifact UUID, SHA-256, parser key i parser version;
- normalizacja adresów TERYT/PRG i deterministyczne obszary obsługi;
- model PSZOK/punktów kaucyjnych, rekonsyliacja, świeżość i atomowe publikowanie;
- deterministyczna koordynacja bundle `koszalin-pszok-main` + `koszalin-pszok-faq` z `WAITING_FOR_COMPANION`;
- jawne assessment metadata w Source Registry: `source_shape`, `evidence_status`, `activation_blocker`, `assessed_at`, `child_artifact_urls`;
- manifest contract odrzucający fałszywe deklaracje parser support, ACTIVE bez VERIFIED evidence, PLANNED bez blockera i niejednoznaczne child-artifact identity;
- produkcyjny single-artifact handler `municipal-pszok-html` ograniczony do jawnie wspieranych source identities i oczekiwanych TERC;
- PSZOK Bobolice publikowany bez wymyślonych współrzędnych (`location=null`);
- PSZOK Świeszyno publikujący tylko source-backed zakres materiałów, bez dopowiadania niewczytanych załączników;
- workflow wewnętrznego review i osobne readiness gates dla historycznego pilota, rollout `2026.2` i clean-runtime production path;
- publiczne endpointy opisane w [OpenAPI](../openapi/wastepl-v0.1.yaml).

## Fixture-independent production gate #45

Gate uruchamia osobną bazę `wastepl_production_gate` i stosuje structural migration profile bez migracyjnych seedów canonical pilot data. Następnie wykonuje rzeczywisty łańcuch:

`reference import → manifest 2026.2 → source fixtures → immutable artifacts → durable outbox → BullMQ workers → production parser handlers → canonical publish/review → consumer API`.

Pełny CI run `33182354045` potwierdził:

- wszystkie 6 źródeł `ACTIVE` zostało pobranych i przetworzonych przez rzeczywisty artifact runtime;
- raw PDF harmonogramów jest parsowany przez warstwę ekstrakcji PDF, a nie traktowany jako gotowy UTF-8 fixture;
- initial publish działa bez canonical schedule/facility seedów;
- replay nie tworzy nowych bieżących duplikatów;
- zmieniony harmonogram powoduje scoped replacement z historią i provenance;
- zmieniony companion FAQ PSZOK zachowuje canonical facility identity i tworzy nową immutable assertion history;
- symulowany `HTTP_503` nie usuwa wcześniej opublikowanych danych — last-known-good pozostaje dostępne;
- brak duplikatów bieżących collection events, canonical facilities i identycznych artifact assertions;
- wszystkie aktywne źródła kończą w jawnym terminal/review state;
- consumer API na runtime-produced danych osiąga `30/30` collection i `8/8` facilities;
- smoke test `/v1/health` przechodzi po pełnym gate.

Raport `production-pilot-readiness-report.json` jest archiwizowany przez CI również w przypadku failure. Zielony run #104 zarchiwizował artifact `production-pilot-readiness-report` (artifact ID `9690282397`).

PASS oznacza fixture-independent runtime readiness wyłącznie dla testowanego zakresu. Nie oznacza kompletnego pokrycia ośmiu gmin ani gotowości ogólnopolskiej.

## Source assessment — pozostałe gminy

Harmonogramy Bobolic, Sianowa, Świeszyna, Będzina, Polanowa i Tychowa pozostają `PLANNED`. Każde źródło ma zapisany rzeczywisty publication shape, stan evidence oraz machine-readable blocker. Tam, gdzie zweryfikowano dokładne child artifacts, ich URL-e są częścią manifestu zamiast być odtwarzane przez podobieństwo nazwy pliku.

Szczegółowy assessment znajduje się w [pilot-source-wave-2-assessment.md](research/pilot-source-wave-2-assessment.md).

## CI i bramki

Pełny run CI `33182354045` dla PR `#59` przeszedł wszystkie etapy:

- documentation check i contracts;
- migracje `0001–0016` na zwykłej bazie testowej;
- build i strict typecheck;
- pełne testy: domain `28/28`, worker `94/94`, API `43/43`;
- readiness historyczny `2026.1` oraz rollout `2026.2`;
- osobny fixture-independent production runtime gate na clean DB;
- extended runtime checks: changed facility companion, duplicates, coverage, source health, review queue i stale-source accounting;
- consumer API gate: collection `30/30`, facilities `8/8`;
- obowiązkową archiwizację production readiness report;
- smoke test `/v1/health`.

Testy API korzystające ze wspólnego PostgreSQL są wykonywane bez file parallelism, a DB-backed workspace suites sekwencyjnie. Usuwa to wcześniejszy wyścig między suite'ami bez osłabiania asercji aplikacji.

Golden gates potwierdzają stabilność znanego zestawu regresyjnego i rzeczywistego runtime publication path. Nie potwierdzają jeszcze kompletności danych dla wszystkich ośmiu gmin ani długiego soak testu z live JST.

## Znane ryzyka i ograniczenia

- Siedem źródeł pozostaje `PLANNED`; sześć gmin nadal nie ma aktywnego harmonogramu produkcyjnego.
- `ARTIFACT_PROCESSING_ENABLED` pozostaje domyślnie opt-in; jego włączenie dla środowiska staging/production powinno być osobną, kontrolowaną decyzją deploymentową.
- Fixture-independent gate korzysta z deterministycznych upstream fixtures; live-source staging/soak test pozostaje osobnym krokiem i nie powinien być częścią deterministycznego CI.
- Dane schedule w migracji `0004` nadal istnieją dla historycznych testów, ale nie są używane jako mechanizm publikacji w clean production gate.
- Golden collection ma 30 przypadków; docelowy gate przed pilotem konsumenckim wymaga minimum 100 realnych adresów.
- Brak trusted geometry dla części facilities jest zachowywany jako `null`, więc nie wszystkie punkty są jeszcze gotowe do prezentacji jako pinezki na mapie.
- Sianów używa źródłowej kategorii zbiorczej „odpady segregowane”; bez oficjalnego mapowania nie rozdzielamy jej automatycznie na PAPER/GLASS/METALS_PLASTICS.
- Będzino i część pozostałych gmin wymagają deterministycznego modelu multi-attachment/route coverage.
- Dane punktów systemu kaucyjnego nadal nie mają ogólnopolskiego produkcyjnego feedu.

## Porządek backlogu

Nakładające się zadania `#40–#43` zostały zamknięte jako duplikaty po przeniesieniu kryteriów do kanonicznych `#46–#49`. Rollout źródeł `2026.2` został scalony wcześniej. `#45` ma kompletną implementację i zielony fixture-independent gate w PR `#59`.

## Następne kroki

1. Scalić PR `#59` po finalnym doc-inclusive CI i zamknąć `#45`.
2. Uruchomić osobny staging/live-source soak dla sześciu aktywnych źródeł, bez przenoszenia zależności od stron JST do deterministycznego CI.
3. Rozszerzyć realne harmonogramy kolejnych gmin, zaczynając od najlepiej udokumentowanych Tychowo/Będzino, przy jednoczesnym pomiarze czasu onboardingu, reuse adapterów i manual-review rate.
4. Rozszerzyć walidację do minimum 100 realnych adresów w pilocie.
5. Dostarczyć source-ops/coverage API `#50`.
6. Dopiero po tych krokach rozwijać consumer PWA `#51`.

## Import referencyjny PRG/TERYT

Naprawa calendar-date idempotency została wcześniej scalona. Porównywanie PostgreSQL `date` nie zależy od UTC-konwersji lokalnego obiektu `Date`; testy obejmują `Europe/Warsaw`, `America/Los_Angeles` i `Pacific/Auckland`. Ten problem nie jest blockerem importu referencyjnego.
