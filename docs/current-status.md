# Bieżący status WastePL

> Zweryfikowano: 2026-08-28, commit `1a58639d026d7cbeea453bea968f888982a0a79f` (`main`).

## Etap

Sprinty 01–03 są ukończone. Pierwszy zakres Sprintu 04 — runtime przetwarzania artefaktów i dispatch parserów — został scalony. Kolejnym etapem jest dalsza realizacja Sprintu 04, zaczynając od automatycznego publikowania kolekcji oraz konsolidacji nakładających się zadań.

To nadal PoC/pilot infrastruktury danych, a nie ukończony produkt dla ośmiu gmin.

## Stan pilota

| Miara | Stan | Interpretacja |
| --- | ---: | --- |
| Gminy w manifeście | 8 | Zakres docelowej fali pilotażowej. |
| Gminy z aktywnym harmonogramem | 2 z 8 | Koszalin i Manowo mają aktywne źródła harmonogramów z parserem. |
| Źródła aktywne | 4 | Dwa harmonogramy oraz dwie strony składające się na pakiet PSZOK Koszalin. |
| Źródła planowane | 9 | Nie mają jeszcze kompletnej obsługi produkcyjnej. |
| Golden addresses | 30 z 30 | Deterministyczny zestaw regresyjny Sprintu 01, nie 100 adresów produkcyjnych. |
| Golden facilities | 8 z 8 | Deterministyczny zestaw regresyjny obiektów. |

Rozbieżność 30 vs 100 jest zamierzona i jawna: 30 adresów to istniejące fixtures oraz bramka regresyjna; 100 realnych adresów w 8 gminach to kryterium wyjścia z pilota, które nie zostało jeszcze spełnione.

## Dostarczone możliwości

- rejestr źródeł, warunkowe pobieranie HTTP, SHA-256, deduplikacja i niemutowalne artefakty;
- wersjonowane manifesty źródeł i scheduler/outbox;
- parsery deterministyczne dla aktywnych źródeł PDF_TEXT i HTML;
- normalizacja adresów TERYT/PRG, obszary obsługi, harmonogramy i pochodzenie danych;
- model PSZOK/punktów kaucyjnych, rekonsyliacja, świeżość i atomowe publikowanie pakietów;
- workflow wewnętrznego review oraz readiness gate;
- publiczne endpointy opisane w [OpenAPI](../openapi/wastepl-v0.1.yaml), w tym `/v1/addresses/resolve`.

## CI i bramki

Ostatni workflow CI przed tym przeglądem zakończył się powodzeniem: [run 33154490926](https://github.com/endurance71/WastePL/actions/runs/33154490926). Pipeline uruchamia migracje na pustym PostGIS, build, typecheck, testy, readiness gate i smoke test API. Golden gates przechodzą dla 30 adresów i 8 obiektów fixture-derived.

Przejście golden gates potwierdza stabilność znanego zestawu regresyjnego. Nie potwierdza kompletności produkcyjnych danych dla ośmiu gmin.

## Znane ryzyka i ograniczenia

- Import PRG ma znany problem idempotencji dat w strefach innych niż UTC: konwersja wartości `date` przez lokalny obiekt `Date` może przesunąć dzień przy porównaniu importów. Naprawa kodu importera jest poza zakresem tej konsolidacji dokumentacji.
- Dziewięć źródeł pozostaje `PLANNED`; ich adaptery i produkcyjna walidacja nie są gotowe.
- Otwarte zadania Sprintu 04 częściowo się pokrywają: issues `#41–#45` i `#47–#51`, a `#40` pokrywa ukończony już zakres S04-01. Backlog wymaga konsolidacji, lecz ta zmiana go nie modyfikuje.
- Dane schedule w migracji `0004` i golden fixtures są deterministyczną podstawą CI, a nie pełnymi surowymi pobraniami produkcyjnymi.

## Następne kroki

1. Skonsolidować zakres i zależności otwartych zadań Sprintu 04.
2. Zrealizować automatyczny publisher kolekcji z transakcją i idempotencją.
3. Dodać koordynację wieloartefaktowych źródeł i kolejne adaptery.
4. Aktywować pozostałe gminy oraz wykonać fixture-independent gate na 100 realnych adresach.
5. Naprawić i przetestować idempotencję importu PRG poza UTC w osobnej zmianie kodu.
