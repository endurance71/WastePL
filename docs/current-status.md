# Bieżący status WastePL

> Zweryfikowano: 2026-08-28, commit `d235456587ebb3723f881968183ba0f74539be06` (pełny CI run `33191470822`, #110, PR `#66`). Końcowe zmiany dokumentacyjne podlegają finalnemu rerunowi PR przed merge.

## Etap

Sprinty 01–03 są ukończone. Sprint 04 dostarczył kompletny testowany pion self-updating Data Platform PoC: runtime przetwarzania artefaktów, transakcyjne publikowanie harmonogramów, wieloartefaktową koordynację facilities, rollout `pilot-koszalin-region@2026.2`, fixture-independent production gate `#45`, odseparowany live-source staging/drift gate `#60` oraz wewnętrzny source-ops/coverage API `#50`.

Sprint 05 rozpoczął rozszerzanie rzeczywistego collection coverage. PR `#66` dodaje wersjonowany manifest `2026.3`, nowy produkcyjny parser `municipal-collection-pdf-text` i bezpieczne częściowe pokrycie Tychowa. Będzino pozostaje jawnie `PLANNED`: wszystkie 14 aktualnie listowanych załączników BIP są zamrożone jako evidence, ale relacja route I/II/OSŁONY/trudnodostępne nie jest jeszcze wystarczająco deterministyczna do publikacji mieszkańcom.

Production handlery `pgk-koszalin-pdf-text`, `municipal-collection-pdf-text`, `pgk-koszalin-pszok-html` i `municipal-pszok-html` są zarejestrowane w artifact runtime. Surowe źródła `PDF_TEXT` przechodzą przez ekstrakcję tekstu z raw PDF przed deterministycznym adapterem. `ARTIFACT_PROCESSING_ENABLED` pozostaje deploymentowo opt-in.

WastePL jest produkcyjnie utwardzonym Data Platform PoC z działającą automatyczną publikacją dla kilku różnych kształtów źródeł. Nadal nie jest kompletnym produktem konsumenckim dla ośmiu gmin.

## Stan pilota po rollout `2026.3`

| Miara | Stan | Interpretacja |
| --- | ---: | --- |
| Gminy w manifeście | 8 | Zakres docelowej fali pilotażowej. |
| Gminy z jakimkolwiek aktywnym typem danych | 5 z 8 | Koszalin, Manowo, Bobolice, Świeszyno i Tychowo. |
| Gminy z aktywnym harmonogramem | 3 z 8 | Koszalin, Manowo oraz częściowe, bezpieczne pokrycie Tychowa. |
| Gminy z aktywnym PSZOK | 3 z 8 | Koszalin, Bobolice i Świeszyno. |
| Źródła aktywne | 7 | 3 harmonogramy, 2 człony bundle PSZOK Koszalin, PSZOK Bobolice i PSZOK Świeszyno. |
| Źródła planowane | 8 | Nieschedulowane źródła/entrypointy z jawnymi blockerami, w tym hard-to-reach Tychowo i Będzino. |
| Golden addresses | 30 z 30 | Historyczna clean-runtime consumer API bramka; nie docelowe 100 realnych adresów. |
| Golden facilities | 8 z 8 | 100% w dotychczasowej clean-runtime consumer API bramce. |
| Tychowo clean runtime | PASS | 3 service areas, 30 LOCALITY rules, 273 current events. |

Rozbieżność 30 vs 100 pozostaje jawna. Nowy Tychowo runtime gate dowodzi produkcyjnej publikacji danych, ale nie zastępuje kryterium `#64`: minimum 100 realnych adresów rozłożonych na aktywne pokrycie pilota przed zewnętrznym pilotem konsumenckim.

Manifesty `2026.1` i `2026.2` pozostają historyczne i nie zostały nadpisane. `2026.3` zachowuje wszystkie wcześniejsze source identities, dodaje dwa bezpośrednie child-source Tychowa i promuje do `ACTIVE` wyłącznie `tychowo-collection-standard-2026`.

## Dostarczone możliwości

- rejestr źródeł, conditional HTTP, SHA-256, deduplikacja i niemutowalne artefakty;
- wersjonowane manifesty źródeł i scheduler/outbox;
- artifact processing worker z weryfikacją SHA i dispatch po `parser_key`;
- bezpieczna ekstrakcja tekstu z raw PDF dla źródeł `PDF_TEXT`;
- deterministyczne parsery dla wspieranych źródeł PGK i profilowanych źródeł JST;
- transakcyjne publikowanie harmonogramów z source ownership, idempotent replay i last-known-good;
- temporalna historia `collection_events` przez `valid_from`/`valid_to` zamiast hard-delete;
- publiczne provenance harmonogramu: artifact UUID, SHA-256, parser key i parser version;
- normalizacja adresów TERYT/PRG i deterministyczne obszary obsługi;
- runtime lookup nazw miejscowości do TERYT/SIMC dla parsera Tychowa zamiast produkcyjnego hardcodowania identyfikatorów;
- model PSZOK/punktów kaucyjnych, rekonsyliacja, świeżość i atomowe publikowanie;
- deterministyczna koordynacja bundle `koszalin-pszok-main` + `koszalin-pszok-faq` z `WAITING_FOR_COMPANION`;
- assessment metadata w Source Registry: `source_shape`, `evidence_status`, `activation_blocker`, `assessed_at`, `child_artifact_urls`;
- manifest contract odrzucający fałszywe deklaracje parser support, ACTIVE bez VERIFIED evidence, PLANNED bez blockera i niejednoznaczne child-artifact identity;
- PSZOK Bobolice bez wymyślonych współrzędnych (`location=null`);
- PSZOK Świeszyno publikujący tylko source-backed zakres materiałów;
- manual-only live-source staging/drift workflow z izolowaną bazą i bucketem;
- internal source-ops API pod `/internal/v1/source-ops/*` z auth i bezpiecznym operational provenance;
- coverage matrix ACTIVE/PLANNED/schedulable/healthy/failing/stale według gminy i typu danych;
- contract guard zabraniający wystawiania storage URI, credentials i raw error messages;
- publiczne endpointy opisane w [OpenAPI](../openapi/wastepl-v0.1.yaml), a endpointy data-ops w osobnym internal OpenAPI.

## Bazowy fixture-independent production gate #45

Dotychczasowy gate nadal uruchamia osobną bazę `wastepl_production_gate` i sprawdza historyczny zakres `2026.2` przez rzeczywisty łańcuch:

`reference import → manifest 2026.2 → source fixtures → immutable artifacts → durable outbox → BullMQ workers → production parser handlers → canonical publish/review → consumer API`.

Run #110 ponownie potwierdził, że ta istniejąca bramka pozostaje zielona po dodaniu Tychowa. Obejmuje m.in. initial publish, replay, changed schedule/facility companion, failure/last-known-good, brak bieżących duplikatów oraz consumer API `30/30` collection i `8/8` facilities.

Nowy Tychowo gate nie zastępuje tego zakresu — jest osobnym dodatkowym clean-runtime testem, dzięki czemu rozszerzenie pilota nie może ukryć regresji wcześniejszych sześciu aktywnych źródeł.

## Tychowo clean-runtime gate `2026.3`

Dedykowany gate uruchamia osobną bazę `wastepl_tychowo_gate`, stosuje structural migrations i rozpoczyna z zerową liczbą canonical collection rows. Referencje TERC/SIMC są importowane przez `PgOfficialReferenceImporter`; test-only SIMC-y są celowo inne niż produkcyjne, żeby udowodnić brak hardcodowania identyfikatorów w parserze.

Run #110 potwierdził:

- import 8 TERC i 35 lokalności bez odrzuconych rekordów;
- sync manifestu `2026.3`: 8 gmin, 15 source identities, 7 ACTIVE, 8 PLANNED;
- `tychowo-collection-standard-2026` przechodzi przez immutable artifact → outbox → BullMQ → `municipal-collection-pdf-text@0.1.0` → schema validation → `PgCollectionPublisher`;
- publikacja tworzy 3 service areas i 30 reguł `LOCALITY`;
- powstaje 273 bieżących eventów z frakcjami dokładnie `BIO`, `GLASS`, `MIXED`, `OTHER`, `PAPER`;
- źródłowe `tworzywa sztuczne` pozostaje `OTHER` z notą provenance, a nie jest fałszywie poszerzane do `METALS_PLASTICS`;
- replay identycznych bajtów daje `DEDUPLICATED` i jedną publikację;
- symulowany `HTTP_503` ustawia health `FETCH_FAILED`, ale zachowuje 273 last-known-good events;
- zmieniony artefakt tworzy drugą publikację, zamyka poprzednie 273 eventy i pozostawia 273 nowych current rows.

Raport z runu #110 został zarchiwizowany w artifact `9693964683`, digest `sha256:8486020dc8481845c7bf9b85b9d0de0e626e7317c0e619edea182bb3c05bf593`.

## Bezpieczny zakres Tychowa

Standardowy PDF jest aktywny tylko tam, gdzie source evidence nie pokazuje konfliktu z osobnym harmonogramem trudnodostępnym. Rollout obejmuje 30 miejscowości w trzech grupach.

Celowo nie publikujemy:

- miasta Tychowo, ponieważ oficjalny dokument ma osobny schedule dla wspólnot mieszkaniowych, a obecny resolver nie używa `building_type` do selekcji;
- miejscowości, dla których drugi PDF wykazuje wyjątki trudnodostępne nieodwzorowane jeszcze jako jednoznaczne adresy;
- sparse bulky dates, gdy linear PDF extraction nie zachowuje wystarczająco pewnego położenia kolumny/miesiąca.

`tychowo-collection-difficult-2026` pozostaje `PLANNED` z blockerem `EXPLICIT_ADDRESS_REFERENCE_GATE_NOT_YET_COMPLETE`.

## Będzino — evidence-backed NO-GO

BIP Będzina ma 14 aktualnie listowanych załączników, w tym cztery pliki `od_lipca` reprezentujące kandydatów H2. Wszystkie exact URL-e są zapisane w manifeście `2026.3`, ale źródło pozostaje `PLANNED`.

Problemem nie jest już znalezienie plików. Blocker to deterministyczna relacja route I/II/OSŁONY/trudnodostępne do adresów/lokalności oraz ich wzajemna ważność i overlap. Machine-readable blocker: `H2_ROUTE_I_II_OSLONY_AND_DIFFICULT_COVERAGE_NOT_YET_ADDRESS_DETERMINISTIC`.

Szczegółowy assessment i evidence znajdują się w [pilot-source-wave-3-assessment.md](research/pilot-source-wave-3-assessment.md).

## Live-source staging/drift gate #60

Mechanizm został scalony w PR `#61`. Workflow jest wyłącznie `workflow_dispatch` i celowo nie należy do pull-request CI. Używa izolowanej bazy, odseparowanego bucketu, lokalnego Redis/BullMQ i tych samych production parser handlers.

Pierwszy manualny live run z `main` nadal jest wymagany przed PWA/pilotem. Dostępne połączenie automatyzacyjne z GitHub nie udostępnia obecnie akcji `workflow_dispatch`, dlatego issue pozostaje otwarte do rzeczywistego ręcznego runu.

## Source-ops API #50

PR `#62` dostarczył:

- `/internal/v1/source-ops/sources` — health, stale, failure count, poll timestamps i bezpieczne latest artifact/processing provenance;
- `/internal/v1/source-ops/coverage` — coverage per gmina/data type, rozdzielając ACTIVE od PLANNED i failure od braku wsparcia;
- `/internal/v1/source-ops/summary` — zbiorczy health, pending outbox i review queues.

API jest data-driven po Source Registry i naturalnie korzysta z najnowszego manifest version. Testy bronią naturalnego sortowania wersji (`2099.10 > 2099.2`), auth oraz braku `storage_uri` i raw error messages. Po sync `2026.3` nowe ACTIVE/PLANNED Tychowo i NO-GO Będzino są więc reprezentowane przez ten sam operacyjny model bez osobnego endpointu.

## CI i bramki

Pełny CI #110 (`33191470822`) przeszedł:

- documentation check i contracts;
- migracje na zwykłej bazie testowej;
- build i strict typecheck;
- pełny domain/worker/API test suite;
- readiness `2026.1` i `2026.2`;
- bazowy fixture-independent production runtime gate;
- extended runtime gate;
- consumer API production gate;
- nowy osobny Tychowo clean-runtime gate `2026.3`;
- obowiązkowy upload obu production readiness reports;
- smoke `/v1/health`.

Pierwszy run PR #66 (#109) został prawidłowo zatrzymany przez `docs:check` na zduplikowanych nagłówkach assessmentu. Nagłówki zostały naprawione bez wyłączania checka; run #110 jest pełnym zielonym dowodem implementacji.

## Znane ryzyka i ograniczenia

- Pięć gmin nadal nie ma aktywnego harmonogramu; Tychowo jest aktywne tylko częściowo.
- `ARTIFACT_PROCESSING_ENABLED` pozostaje deploymentowo opt-in.
- Pull-request CI używa deterministycznych fixtures; pierwszy manualny live-source run #60 nadal jest wymagany.
- Golden collection nadal ma 30 przypadków; `#64` wymaga minimum 100 realnych adresów i ma być następną główną bramką.
- Miasto Tychowo i hard-to-reach properties są celowo bez schedule zamiast ryzykować błędne daty.
- Będzino wymaga deterministycznego modelu multi-attachment/route/address coverage.
- Brak trusted geometry dla części facilities jest zachowywany jako `null`.
- Sianów nadal ma źródłową kategorię zbiorczą „odpady segregowane” bez wystarczającego mapowania do wszystkich kanonicznych frakcji.
- Dane punktów systemu kaucyjnego nadal nie mają ogólnopolskiego produkcyjnego feedu.
- Największa niewiadoma biznesowa pozostaje czas/koszt onboardingu i utrzymania gminy; `#65` zbiera audytowalne metryki bez rekonstruowania fikcyjnych minut pracy.

## Porządek backlogu

- `#45` — ukończone: fixture-independent production gate;
- `#50` — ukończone: internal source-ops/coverage API;
- `#60` — mechanizm live-source gate scalony, issue otwarte do pierwszego manualnego live runu;
- `#63` — fala Tychowo + Będzino: Tychowo ma bezpieczny partial GO, Będzino evidence-backed NO-GO; zamknięcie po merge PR #66;
- `#64` — następny główny krok: minimum 100 realnych adresów;
- `#65` — ekonomika onboardingu gmin i reuse adapterów;
- `#51` — consumer PWA nadal celowo zablokowane przez #64 i pierwszy przejrzany live run #60.

## Następne kroki

1. Scalić PR `#66` po finalnym zielonym CI dokumentacyjnego headu i zamknąć `#63`.
2. Rozpocząć `#64`: zbudować minimum 100 realnych adresów dla aktywnego pilota, z osobnymi expected schedules i provenance.
3. Kontynuować `#65` na podstawie mierzalnych danych z Tychowa/Będzina, bez zgadywania human-active time.
4. Wykonać i przejrzeć pierwszy ręczny live-source run `#60`, gdy dostępny jest `workflow_dispatch`.
5. Consumer PWA `#51` dopiero po przejściu bramek danych i live-source.

## Import referencyjny PRG/TERYT

Naprawa calendar-date idempotency jest scalona. Porównywanie PostgreSQL `date` nie zależy od UTC-konwersji lokalnego obiektu `Date`; testy obejmują `Europe/Warsaw`, `America/Los_Angeles` i `Pacific/Auckland`. Ten problem nie jest blockerem importu referencyjnego.