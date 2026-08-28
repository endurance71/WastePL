# Bieżący status WastePL

> Zweryfikowano: 2026-08-28, commit `85820c13a938cd2b175b6dbd86d3e5b0d8defb51` (PR `#56`).

## Etap

Sprinty 01–03 są ukończone. W Sprincie 04 scalono runtime przetwarzania artefaktów (S04-01) oraz automatyczne, transakcyjne publikowanie harmonogramów kolekcji z historią wersji i publicznym provenance (S04-02). S04-03 — koordynacja wieloartefaktowych źródeł facilities — jest zaimplementowane i przeszło pełny CI w PR `#56`; do `main` trafi po zakończeniu review/merge.

Production handlery `pgk-koszalin-pdf-text` oraz `pgk-koszalin-pszok-html` są zarejestrowane w artifact runtime. `ARTIFACT_PROCESSING_ENABLED` pozostaje jednak domyślnie wyłączone do czasu przejścia fixture-independent pilot production gate. WastePL nadal jest PoC/pilotem infrastruktury danych, a nie ukończonym produktem dla ośmiu gmin.

## Stan pilota

| Miara | Stan | Interpretacja |
| --- | ---: | --- |
| Gminy w manifeście | 8 | Zakres docelowej fali pilotażowej. |
| Gminy z aktywnym harmonogramem | 2 z 8 | Koszalin i Manowo mają aktywne źródła harmonogramów z parserem. |
| Źródła aktywne | 4 | Dwa harmonogramy oraz dwa człony bundle PSZOK Koszalin. |
| Źródła planowane | 9 | Nie mają jeszcze kompletnej obsługi produkcyjnej. |
| Golden addresses | 30 z 30 | Deterministyczny zestaw regresyjny, nie 100 adresów produkcyjnych. |
| Golden facilities | 8 z 8 | Deterministyczny zestaw regresyjny obiektów. |

Rozbieżność 30 vs 100 pozostaje jawna i zamierzona: 30 adresów to istniejące fixtures oraz bramka regresyjna; 100 realnych adresów w 8 gminach to kryterium wyjścia z pilota, które nie zostało jeszcze spełnione. S04-03 zwiększa niezawodność produkcyjnego pipeline facilities, ale nie zwiększa liczby gmin z aktywnym harmonogramem.

## Dostarczone możliwości

- rejestr źródeł, warunkowe pobieranie HTTP, SHA-256, deduplikacja i niemutowalne artefakty;
- wersjonowane manifesty źródeł i scheduler/outbox;
- artifact processing worker z weryfikacją SHA i dispatch po `parser_key`;
- parsery deterministyczne dla aktywnych źródeł PDF_TEXT i HTML;
- transakcyjne publikowanie harmonogramów z source ownership, idempotent replay i last-known-good rollback;
- temporalna historia `collection_events` przez `valid_from`/`valid_to` zamiast hard-delete;
- publiczne provenance harmonogramu: artifact UUID, SHA-256, parser key i parser version;
- normalizacja adresów TERYT/PRG i deterministyczne obszary obsługi;
- model PSZOK/punktów kaucyjnych, rekonsyliacja, świeżość i atomowe publikowanie pakietów;
- jawne bundle metadata w Source Registry i manifeście: `bundle_key`, rola, wymagane role i freshness window;
- stan `WAITING_FOR_COMPANION` odróżniający brak drugiego artefaktu od błędu parsera;
- deterministyczna koordynacja `koszalin-pszok-main` + `koszalin-pszok-faq` niezależnie od kolejności przyjścia;
- weryfikacja SHA companion artifact przed normalizacją oraz brak częściowej publikacji niekompletnego bundle;
- zachowanie last-known-good przy brakującym lub zbyt starym companionie;
- jawny `bundleHealth` w readiness report, z bramką na aktywne źródła pozostające w `WAITING_FOR_COMPANION`;
- workflow wewnętrznego review oraz readiness gate;
- publiczne endpointy opisane w [OpenAPI](../openapi/wastepl-v0.1.yaml).

## CI i bramki

PR `#56` przeszedł kompletny workflow CI `33162321872`: docs/contracts, migracje na pustym PostGIS, build, strict typecheck, wszystkie testy, readiness 0.2, golden collection, golden facilities oraz API smoke test.

Testy S04-03 obejmują m.in.:

- `main` bez FAQ → `WAITING_FOR_COMPANION` bez częściowego publish;
- odróżnienie nigdy-niewidzianego companionu od companionu przeterminowanego względem freshness window;
- równoważny bundle przy kolejności `main → FAQ` i `FAQ → main`;
- zmianę tylko FAQ z zachowaniem niezmienionego artefaktu `main` w provenance wejściowym;
- `WAITING → unchanged poll → nadal WAITING → PUBLISHED → HEALTHY` bez sztucznego zwiększania failure count;
- idempotentny manifest sync z trwałym bundle metadata;
- istniejące E2E facilities nadal weryfikują atomowy publish, exact artifact/parser provenance, replay bez duplikatów i rollback transakcji.

Golden gates potwierdzają stabilność znanego zestawu regresyjnego. Nie potwierdzają kompletności produkcyjnych danych dla ośmiu gmin ani niezawodności zewnętrznych stron JST w długim soak teście.

## Znane ryzyka i ograniczenia

- Dziewięć źródeł pozostaje `PLANNED`; ich adaptery i produkcyjna walidacja nie są gotowe.
- Fixture-independent pilot production gate (`#45`) nie został jeszcze przeprowadzony, dlatego artifact processing pozostaje opt-in.
- Dane schedule w migracji `0004` i golden fixtures są deterministyczną podstawą regresji CI, a nie pełnymi surowymi pobraniami produkcyjnymi.
- Historia `collection_events` jest temporalna; historia `service_area_rules` nadal opiera się na immutable source artifacts/audit, a nie na wersjonowanych wierszach reguł.
- Bundle PSZOK Koszalin jest obecnie pierwszym production bundle; potrzebujemy kolejnych źródeł wieloartefaktowych, aby sprawdzić reużywalność modelu poza jednym dostawcą/układem publikacji.
- Przy równoległym przetworzeniu dwóch członów bundle unikalne constraints oraz retryable transaction failure chronią przed trwałym duplikatem; dedykowana serializacja per bundle może zostać dodana, jeżeli obserwacje staging pokażą realną konkurencję wymagającą dodatkowego locka.

## Porządek backlogu

Nakładające się zadania zostały skonsolidowane: `#40–#43` zamknięto jako duplikaty po przeniesieniu mocniejszych kryteriów do kanonicznych `#46–#49`. Zadania `#44` i `#45` pozostają osobnymi bramkami: rollout manifestu 2026.2 oraz fixture-independent production gate.

## Następne kroki

1. Scalić zweryfikowane S04-03 / `#48` po finalnym review PR `#56`.
2. Zrealizować `#49`: ocena wszystkich sześciu pozostałych gmin i aktywacja co najmniej dwóch kolejnych bez zgadywania danych.
3. Przygotować manifest 2026.2 (`#44`) wyłącznie dla faktycznie wspieranych źródeł.
4. Przeprowadzić fixture-independent pilot production gate (`#45`) od clean DB przez realne źródła/artifacts do consumer API.
5. Rozszerzyć walidację do minimum 100 realnych adresów w ośmiu gminach przed pilotem konsumenckim.

## Import referencyjny PRG/TERYT

Naprawa calendar-date idempotency została scalona do `main` w PR `#55`. Porównywanie PostgreSQL `date` nie zależy już od UTC-konwersji lokalnego obiektu `Date`; testy obejmują `Europe/Warsaw`, `America/Los_Angeles` oraz `Pacific/Auckland`. Ten problem nie jest już znanym blockerem importu referencyjnego.
