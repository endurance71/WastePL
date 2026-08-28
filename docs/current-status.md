# Bieżący status WastePL

> Zweryfikowano: 2026-08-28, commit `4abd83abbc276ea2921760b00aa91d191a9139f8` (`main`).

## Etap

Sprinty 01–03 są ukończone. W Sprincie 04 scalono już runtime przetwarzania artefaktów (S04-01) oraz automatyczne, transakcyjne publikowanie harmonogramów kolekcji z historią wersji i publicznym provenance (S04-02).

Pierwszy production handler `pgk-koszalin-pdf-text` jest zarejestrowany, ale `ARTIFACT_PROCESSING_ENABLED` pozostaje domyślnie wyłączone do czasu przejścia fixture-independent pilot production gate. To nadal PoC/pilot infrastruktury danych, a nie ukończony produkt dla ośmiu gmin.

## Stan pilota

| Miara | Stan | Interpretacja |
| --- | ---: | --- |
| Gminy w manifeście | 8 | Zakres docelowej fali pilotażowej. |
| Gminy z aktywnym harmonogramem | 2 z 8 | Koszalin i Manowo mają aktywne źródła harmonogramów z parserem. |
| Źródła aktywne | 4 | Dwa harmonogramy oraz dwie strony składające się na pakiet PSZOK Koszalin. |
| Źródła planowane | 9 | Nie mają jeszcze kompletnej obsługi produkcyjnej. |
| Golden addresses | 30 z 30 | Deterministyczny zestaw regresyjny, nie 100 adresów produkcyjnych. |
| Golden facilities | 8 z 8 | Deterministyczny zestaw regresyjny obiektów. |

Rozbieżność 30 vs 100 jest zamierzona i jawna: 30 adresów to istniejące fixtures oraz bramka regresyjna; 100 realnych adresów w 8 gminach to kryterium wyjścia z pilota, które nie zostało jeszcze spełnione.

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
- workflow wewnętrznego review oraz readiness gate;
- publiczne endpointy opisane w [OpenAPI](../openapi/wastepl-v0.1.yaml).

## CI i bramki

S04-02 przeszło kompletny CI na aktualnym `main`: docs/contracts, migracje na pustym PostGIS, build, strict typecheck, wszystkie testy, immutable-artifact runtime integration, readiness, oba golden gates i API smoke.

Golden gates nadal potwierdzają stabilność znanego zestawu regresyjnego. Nie potwierdzają kompletności produkcyjnych danych dla ośmiu gmin.

## Znane ryzyka i ograniczenia

- Dziewięć źródeł pozostaje `PLANNED`; ich adaptery i produkcyjna walidacja nie są gotowe.
- Koordynator wieloartefaktowego źródła PSZOK (`#48`) nie jest jeszcze podłączony do production processing queue.
- Fixture-independent pilot production gate (`#45`) nie został jeszcze przeprowadzony, dlatego processing artefaktów pozostaje opt-in.
- Dane schedule w migracji `0004` i golden fixtures są deterministyczną podstawą regresji CI, a nie pełnymi surowymi pobraniami produkcyjnymi.
- Historia `collection_events` jest temporalna; historia `service_area_rules` nadal opiera się na immutable source artifacts/audit, a nie na wersjonowanych wierszach reguł.

## Porządek backlogu

Nakładające się zadania zostały skonsolidowane: `#40–#43` zamknięto jako duplikaty po przeniesieniu mocniejszych kryteriów do kanonicznych `#46–#49`. Zadania `#44` i `#45` pozostają osobnymi bramkami: rollout manifestu 2026.2 oraz fixture-independent production gate.

## Następne kroki

1. Zrealizować `#48`: koordynację wieloartefaktowych źródeł facilities.
2. Zrealizować `#49`: ocena wszystkich sześciu pozostałych gmin i aktywacja co najmniej dwóch kolejnych bez zgadywania danych.
3. Przygotować manifest 2026.2 (`#44`) wyłącznie dla faktycznie wspieranych źródeł.
4. Przeprowadzić fixture-independent pilot production gate (`#45`).
5. Rozszerzyć walidację do minimum 100 realnych adresów w ośmiu gminach przed pilotem konsumenckim.

## Naprawa PRG calendar dates

Osobna zmiana `fix/prg-calendar-date-idempotency` usuwa zależność porównywania SQL `date` od strefy czasowej procesu Node i zawiera testy dla `Europe/Warsaw`, `America/Los_Angeles` oraz `Pacific/Auckland`. Po przejściu CI ten punkt przestaje być znanym blockerem importu referencyjnego.
