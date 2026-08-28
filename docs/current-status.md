# Bieżący status WastePL

> Zweryfikowano: 2026-08-28, commit `d3d99df6af65a3a5cf40e1f7b3b9105beb8a0a79` (PR `#62`, pełny CI run `33187181468`, run #108; merge `d7d3ff8f9276b6d0244745e97006b2601bc93458`).

## Etap

Sprinty 01–03 są ukończone. W Sprincie 04 dostarczono kompletny testowany pion self-updating Data Platform PoC: runtime przetwarzania artefaktów, transakcyjne publikowanie harmonogramów, wieloartefaktową koordynację facilities, rollout `pilot-koszalin-region@2026.2`, fixture-independent production gate `#45`, odseparowany live-source staging/drift gate `#60` oraz wewnętrzny source-ops/coverage API `#50`.

PR `#59` zamknął clean-runtime production gate, PR `#61` dodał mechanizm ręcznego live-source staging, a PR `#62` dodał operacyjną obserwowalność bez potrzeby bezpośredniego SQL. Mechanizm #60 jest na `main`, ale pierwsze ręczne `workflow_dispatch` z live JST nadal nie zostało wykonane i issue pozostaje otwarte celowo.

Production handlery `pgk-koszalin-pdf-text`, `pgk-koszalin-pszok-html` i `municipal-pszok-html` są zarejestrowane w artifact runtime. Surowe źródła `PDF_TEXT` przechodzą przez ekstrakcję tekstu z raw PDF przed deterministycznym adapterem. Fixture-independent gate potwierdza, że testowany zakres pilota można odbudować na osobnej czystej bazie przez rzeczywistą ścieżkę runtime bez preseedowanych canonical collection/facility rows.

`ARTIFACT_PROCESSING_ENABLED` pozostaje domyślnie opt-in dla środowisk deploymentowych. Przejście gate nie jest równoznaczne z uruchomieniem zewnętrznego pilota.

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

Rozbieżność 30 vs 100 pozostaje jawna: 30 adresów to istniejąca bramka regresyjna; minimum 100 realnych adresów rozłożonych na aktywne pokrycie pilota jest nadal kryterium przed zewnętrznym pilotem konsumenckim i ma osobne zadanie `#64`.

Manifest `2026.1` pozostaje historyczny i nie został nadpisany. Rollout `2026.2` zachowuje stabilne source UUID/history dla niezmienionych tożsamości źródeł. W 2026.2 nowe `ACTIVE` względem 2026.1 są `bobolice-pszok` i `swieszyno-pszok`.

## Dostarczone możliwości

- rejestr źródeł, warunkowe pobieranie HTTP, SHA-256, deduplikacja i niemutowalne artefakty;
- wersjonowane manifesty źródeł i scheduler/outbox;
- artifact processing worker z weryfikacją SHA i dispatch po `parser_key`;
- bezpieczna ekstrakcja tekstu z raw PDF dla źródeł `PDF_TEXT`;
- deterministyczne parsery dla wspieranych aktywnych źródeł PDF_TEXT i HTML;
- transakcyjne publikowanie harmonogramów z source ownership, idempotent replay i last-known-good;
- temporalna historia `collection_events` przez `valid_from`/`valid_to` zamiast hard-delete;
- publiczne provenance harmonogramu: artifact UUID, SHA-256, parser key i parser version;
- normalizacja adresów TERYT/PRG i deterministyczne obszary obsługi;
- model PSZOK/punktów kaucyjnych, rekonsyliacja, świeżość i atomowe publikowanie;
- deterministyczna koordynacja bundle `koszalin-pszok-main` + `koszalin-pszok-faq` z `WAITING_FOR_COMPANION`;
- jawne assessment metadata w Source Registry: `source_shape`, `evidence_status`, `activation_blocker`, `assessed_at`, `child_artifact_urls`;
- manifest contract odrzucający fałszywe deklaracje parser support, ACTIVE bez VERIFIED evidence, PLANNED bez blockera i niejednoznaczne child-artifact identity;
- PSZOK Bobolice publikowany bez wymyślonych współrzędnych (`location=null`);
- PSZOK Świeszyno publikujący tylko source-backed zakres materiałów;
- workflow wewnętrznego review i osobne readiness gates dla historycznego pilota, rollout `2026.2` i clean-runtime production path;
- manual-only live-source staging/drift workflow z odseparowaną bazą i bucketem, wykorzystujący realny HTTP i production handlery bez zapisu do produkcji;
- internal source-ops API pod `/internal/v1/source-ops/*` z auth `x-wastepl-admin-key` + `x-wastepl-actor`;
- filtrowany widok źródeł z health/stale/last success/failure/next poll oraz bezpiecznym provenance latest artifact/processing;
- coverage matrix ACTIVE/PLANNED/schedulable/healthy/failing/stale według gminy i typu danych;
- source-ops summary obejmujące health, artifact outbox i pending review queues;
- contract guard zabraniający wystawiania storage URI, credentials i raw error messages w internal API;
- publiczne endpointy opisane w [OpenAPI](../openapi/wastepl-v0.1.yaml), a endpointy data-ops w osobnym internal OpenAPI.

## Fixture-independent production gate #45

Gate uruchamia osobną bazę `wastepl_production_gate` i stosuje structural migration profile bez migracyjnych seedów canonical pilot data. Następnie wykonuje rzeczywisty łańcuch:

`reference import → manifest 2026.2 → source fixtures → immutable artifacts → durable outbox → BullMQ workers → production parser handlers → canonical publish/review → consumer API`.

Finalny run CI #108 ponownie potwierdził po dodaniu source-ops API, że:

- wszystkie 6 źródeł `ACTIVE` przechodzi przez rzeczywisty artifact runtime w clean scenario;
- raw PDF harmonogramów jest parsowany przez warstwę ekstrakcji PDF;
- initial publish działa bez canonical schedule/facility seedów;
- replay nie tworzy nowych bieżących duplikatów;
- changed schedule powoduje scoped replacement z historią i provenance;
- changed companion FAQ PSZOK zachowuje canonical facility identity i immutable assertion history;
- symulowany `HTTP_503` nie usuwa previously published last-known-good data;
- brak duplikatów bieżących collection events, canonical facilities i identycznych assertions;
- consumer API na runtime-produced danych osiąga `30/30` collection i `8/8` facilities;
- smoke test `/v1/health` przechodzi.

PASS oznacza fixture-independent runtime readiness wyłącznie dla testowanego zakresu. Nie oznacza kompletnego pokrycia ośmiu gmin ani gotowości ogólnopolskiej.

## Live-source staging/drift gate #60

Mechanizm został scalony w PR `#61`. Workflow jest wyłącznie `workflow_dispatch` i celowo nie należy do pull-request CI. Używa izolowanej bazy `wastepl_live_source_gate`, odseparowanego bucketu `wastepl-live-source-*`, lokalnego Redis/BullMQ i tych samych production parser handlers.

Gate ma wykrywać realny source/template drift i rozróżniać `HEALTHY`, `CHANGED_BUT_PARSEABLE`, `REVIEW_REQUIRED`, `FETCH_FAILED`, `PARSE_FAILED` i `WAITING_FOR_COMPANION`. Nie promuje źródeł, nie zmienia manifestu i nie publikuje canonical data do produkcji.

Pierwszy manualny live run z `main` nadal jest wymagany przed PWA/pilotem. Aktualne połączenie automatyzacyjne z GitHub nie udostępnia akcji `workflow_dispatch`, dlatego nie zastępujemy tego triggerem `push` i nie oznaczamy #60 jako ukończonego bez rzeczywistego runu.

## Source-ops API #50

PR `#62` został scalony po pełnym CI #108. Operator może bez SQL uzyskać:

- `/internal/v1/source-ops/sources` — health, stale, failure count, poll timestamps, latest artifact SHA/status/parser/version i latest processing outcome z filtrami;
- `/internal/v1/source-ops/coverage` — coverage per gmina/data type, rozdzielając ACTIVE od PLANNED i failure od braku wsparcia;
- `/internal/v1/source-ops/summary` — zbiorczy health, pending outbox i review queues.

API nie zwraca `storage_uri`, credentials, raw parser/fetch messages ani stack traces. PostgreSQL E2E wprost zapisuje sekretopodobny storage URI i raw error message, a następnie weryfikuje brak tych danych w odpowiedzi.

## Source assessment — pozostałe harmonogramy

Harmonogramy Bobolic, Sianowa, Świeszyna, Będzina, Polanowa i Tychowa pozostają `PLANNED`. Każde źródło ma zapisany rzeczywisty publication shape, stan evidence i machine-readable blocker.

Najbliższa fala `#63` koncentruje się na Tychowie i Będzinie, ponieważ reprezentują dwa różne problemy integracyjne:

- Tychowo: `ATTACHMENT_INDEX`, evidence `VERIFIED`, blocker `PDF_TEMPLATE_NOT_YET_REGRESSION_CAPTURED`;
- Będzino: `MULTI_ROUTE_PDF_SET`, evidence `PARTIAL`, blocker `MULTI_ATTACHMENT_H2_SET_REQUIRES_CHILD_DISCOVERY_AND_ROUTE_COVERAGE_MODEL`.

Szczegółowy wcześniejszy assessment znajduje się w [pilot-source-wave-2-assessment.md](research/pilot-source-wave-2-assessment.md).

## CI i bramki

Pełny CI run `33187181468` (#108) dla finalnego headu PR `#62` przeszedł wszystkie etapy:

- documentation check i contracts;
- migracje `0001–0016`;
- build i strict typecheck;
- pełne testy: domain `28/28`, worker `96/96`, API `49/49`;
- w tym source-ops PostgreSQL E2E `6/6`;
- readiness historyczny `2026.1` oraz rollout `2026.2`;
- fixture-independent production runtime gate;
- extended runtime gate;
- consumer API gate: collection `30/30`, facilities `8/8`;
- upload production readiness report;
- smoke test `/v1/health`.

Production readiness artifact z runu #108 ma ID `9692243673`.

Golden gates potwierdzają stabilność znanego zestawu regresyjnego i rzeczywistego runtime publication path. Nie potwierdzają jeszcze kompletności danych dla wszystkich ośmiu gmin ani długiego soak testu z live JST.

## Znane ryzyka i ograniczenia

- Siedem źródeł pozostaje `PLANNED`; sześć gmin nadal nie ma aktywnego harmonogramu produkcyjnego.
- `ARTIFACT_PROCESSING_ENABLED` pozostaje domyślnie opt-in dla deploymentu.
- Fixture-independent CI korzysta z deterministycznych upstream fixtures; pierwszy manualny live-source run #60 nadal jest wymagany.
- Dane schedule w migracji `0004` nadal istnieją dla historycznych testów, ale nie są mechanizmem publikacji w clean production gate.
- Golden collection ma 30 przypadków; `#64` wymaga minimum 100 realnych adresów.
- Brak trusted geometry dla części facilities jest zachowywany jako `null`.
- Sianów używa źródłowej kategorii zbiorczej „odpady segregowane”; bez oficjalnego mapowania nie rozdzielamy jej automatycznie na PAPER/GLASS/METALS_PLASTICS.
- Będzino wymaga deterministycznego modelu multi-attachment/route coverage.
- Dane punktów systemu kaucyjnego nadal nie mają ogólnopolskiego produkcyjnego feedu.
- Największa niewiadoma biznesowa to czas/koszt onboardingu i utrzymania gminy oraz realny reuse adapterów; mierzy to `#65`.

## Porządek backlogu

- `#45` — ukończone: fixture-independent production gate;
- `#50` — ukończone: internal source-ops/coverage API;
- `#60` — mechanizm live-source gate scalony, issue otwarte do pierwszego manualnego live runu;
- `#63` — następna fala realnego collection coverage: Tychowo + Będzino;
- `#64` — rozszerzenie golden collection do minimum 100 realnych adresów;
- `#65` — ekonomika onboardingu gmin i reuse adapterów;
- `#51` — consumer PWA, celowo zablokowane przez #63, #64 i pierwszy przejrzany live run #60.

## Następne kroki

1. Wykonać i przejrzeć pierwszy ręczny live-source run `#60` z `main`, gdy dostępny jest `workflow_dispatch`.
2. Zrealizować `#63`: Tychowo + Będzino z exact child artifacts i produkcyjnym runtime, bez fałszywego `ACTIVE` przy niepełnym evidence.
3. Równolegle od początku `#63` zbierać rzeczywiste metryki onboardingu/reuse/manual review do `#65`.
4. Rozszerzyć clean-runtime golden gate do minimum 100 realnych adresów w `#64`.
5. Dopiero po #63 + #64 + pierwszym zaakceptowanym live runie #60 rozpocząć consumer PWA `#51`.

## Import referencyjny PRG/TERYT

Naprawa calendar-date idempotency jest scalona. Porównywanie PostgreSQL `date` nie zależy od UTC-konwersji lokalnego obiektu `Date`; testy obejmują `Europe/Warsaw`, `America/Los_Angeles` i `Pacific/Auckland`. Ten problem nie jest blockerem importu referencyjnego.
