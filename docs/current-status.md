# Bieżący status WastePL

> Zweryfikowano: 2026-08-28 w PR `#58`; pełny CI run `33173175360` przeszedł przed aktualizacją statusu.

## Etap

Sprinty 01–03 są ukończone. W Sprincie 04 dostarczono runtime przetwarzania artefaktów (S04-01), automatyczne transakcyjne publikowanie harmonogramów z historią wersji i publicznym provenance (S04-02), deterministyczną koordynację wieloartefaktowych źródeł facilities (S04-03) oraz drugą falę źródeł z wersjonowanym manifestem `pilot-koszalin-region@2026.2` (S04-04 / rollout S04-05).

Production handlery `pgk-koszalin-pdf-text`, `pgk-koszalin-pszok-html` i `municipal-pszok-html` są zarejestrowane w artifact runtime. `ARTIFACT_PROCESSING_ENABLED` pozostaje domyślnie wyłączone do czasu przejścia fixture-independent pilot production gate `#45`. WastePL jest nadal pilotem infrastruktury danych, a nie ukończonym produktem konsumenckim dla ośmiu gmin.

## Stan pilota

| Miara | Stan | Interpretacja |
| --- | ---: | --- |
| Gminy w manifeście | 8 | Zakres docelowej fali pilotażowej. |
| Gminy z jakimkolwiek aktywnym typem danych | 4 z 8 | Koszalin, Manowo, Bobolice i Świeszyno. |
| Gminy z aktywnym harmonogramem | 2 z 8 | Koszalin i Manowo. |
| Gminy z aktywnym PSZOK | 3 z 8 | Koszalin, Bobolice i Świeszyno. |
| Źródła aktywne | 6 | 2 harmonogramy, 2 człony bundle PSZOK Koszalin, PSZOK Bobolice i PSZOK Świeszyno. |
| Źródła planowane | 7 | Pozostają nieschedulowane i mają jawne blockery. |
| Golden addresses | 30 z 30 | Deterministyczny zestaw regresyjny, nie docelowe 100 realnych adresów. |
| Golden facilities | 8 z 8 | Deterministyczny zestaw regresyjny obiektów. |

Rozbieżność 30 vs 100 pozostaje jawna: 30 adresów to istniejąca bramka regresyjna; minimum 100 realnych adresów rozłożonych na pilot to nadal kryterium przed zewnętrznym pilotem konsumenckim.

Manifest `2026.1` pozostaje historyczny i nie został nadpisany. Rollout `2026.2` zachowuje stabilne source UUID/history dla niezmienionych tożsamości źródeł. Tylko dwa nowe źródła zostały promowane do `ACTIVE`: `bobolice-pszok` i `swieszyno-pszok`.

## Dostarczone możliwości

- rejestr źródeł, warunkowe pobieranie HTTP, SHA-256, deduplikacja i niemutowalne artefakty;
- wersjonowane manifesty źródeł i scheduler/outbox;
- artifact processing worker z weryfikacją SHA i dispatch po `parser_key`;
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
- workflow wewnętrznego review i osobne readiness gates dla historycznego pilota oraz rollout `2026.2`;
- publiczne endpointy opisane w [OpenAPI](../openapi/wastepl-v0.1.yaml).

## Source assessment — pozostałe gminy

Harmonogramy Bobolic, Sianowa, Świeszyna, Będzina, Polanowa i Tychowa pozostają `PLANNED`. Każde źródło ma zapisany rzeczywisty publication shape, stan evidence oraz machine-readable blocker. Tam, gdzie zweryfikowano dokładne child artifacts, ich URL-e są częścią manifestu zamiast być odtwarzane przez podobieństwo nazwy pliku.

Szczegółowy assessment znajduje się w [pilot-source-wave-2-assessment.md](research/pilot-source-wave-2-assessment.md).

## CI i bramki

Pełny run CI `33173175360` dla PR `#58` przeszedł wszystkie etapy:

- dokumentacja i contracts;
- migracje `0001–0016` na pustym PostGIS;
- build i strict typecheck;
- pełne testy domain/API/worker;
- runtime E2E Bobolice PSZOK i Świeszyno PSZOK;
- manifest `2026.1 → 2026.2` z zachowaniem source UUID;
- readiness historyczny oraz osobny readiness `2026.2`;
- golden collection i golden facilities;
- smoke test `/v1/health`.

Readiness `2026.2` sprawdza initial publish, immutable changed artifact, replay, symulowaną awarię źródła, zachowanie last-known-good oraz odzyskanie health. Raportuje też coverage per `TERC × dataType`, dzięki czemu obecność gminy w manifeście nie jest mylona z faktycznie schedulowanym źródłem.

Golden gates potwierdzają stabilność znanego zestawu regresyjnego. Nie potwierdzają jeszcze kompletności danych dla wszystkich ośmiu gmin ani długiego soak testu z live JST.

## Znane ryzyka i ograniczenia

- Siedem źródeł pozostaje `PLANNED`; sześć gmin nadal nie ma aktywnego harmonogramu produkcyjnego.
- Fixture-independent pilot production gate `#45` nie został jeszcze przeprowadzony, dlatego artifact processing pozostaje opt-in.
- Dane schedule w migracji `0004` są fixture-derived i nie mogą być traktowane jako dowód clean-runtime publication path.
- Golden collection ma 30 przypadków; docelowy gate przed pilotem konsumenckim wymaga minimum 100 realnych adresów.
- Brak trusted geometry dla części facilities jest zachowywany jako `null`, więc nie wszystkie punkty są jeszcze gotowe do prezentacji jako pinezki na mapie.
- Sianów używa źródłowej kategorii zbiorczej „odpady segregowane”; bez oficjalnego mapowania nie rozdzielamy jej automatycznie na PAPER/GLASS/METALS_PLASTICS.
- Będzino i część pozostałych gmin wymagają deterministycznego modelu multi-attachment/route coverage.
- Dane punktów systemu kaucyjnego nadal nie mają ogólnopolskiego produkcyjnego feedu.

## Porządek backlogu

Nakładające się zadania `#40–#43` zostały zamknięte jako duplikaty po przeniesieniu kryteriów do kanonicznych `#46–#49`. Rollout `#44` jest realizowany razem z source-wave `#49` w PR `#58`, ale zachowuje osobne kryteria akceptacji. Następna niezależna bramka to `#45`.

## Następne kroki

1. Przeprowadzić `#45`: clean DB → reference import → manifest 2026.2 → source fetch fixtures → immutable artifacts → outbox/workers → canonical publish/review → consumer API, bez migracji `0004` jako mechanizmu publikacji.
2. Porównać runtime-produced canonical output z golden collection/facility packs i potwierdzić >=99% dla testowanego scope.
3. Rozszerzyć realne harmonogramy kolejnych gmin, zaczynając od najlepiej udokumentowanych Tychowo/Będzino, przy jednoczesnym pomiarze czasu onboardingu i manual-review rate.
4. Rozszerzyć walidację do minimum 100 realnych adresów w pilocie.
5. Następnie dostarczyć source-ops/coverage API `#50` i dopiero po pozytywnym production gate rozwijać consumer PWA `#51`.

## Import referencyjny PRG/TERYT

Naprawa calendar-date idempotency została wcześniej scalona. Porównywanie PostgreSQL `date` nie zależy od UTC-konwersji lokalnego obiektu `Date`; testy obejmują `Europe/Warsaw`, `America/Los_Angeles` i `Pacific/Auckland`. Ten problem nie jest blockerem importu referencyjnego.
