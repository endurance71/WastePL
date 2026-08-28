# Roadmapa, pilot i metryki

> Stan zweryfikowany 2026-08-28 dla commita `1a58639d026d7cbeea453bea968f888982a0a79f`. Roadmapa jest kierunkiem realizacji, nie obietnicą terminu ani budżetu.

## Ukończone etapy

| Etap | Wynik |
| --- | --- |
| Sprint 01 | Kontrakty v0.1, pion adres–harmonogram, 2 gminy i golden gate 30 adresów. |
| Sprint 02 | Facility v0.2, PSZOK/punkty kaucyjne, provenance, rekonsyliacja i atomowa ingestia. |
| Sprint 03 | Oficjalne referencje TERYT/PRG, scheduler/outbox, review, manifest pilota i readiness gate. |
| Sprint 04-01 | Worker przetwarzania artefaktów i dispatch parserów z rejestru. |

## Bieżący Sprint 04

Kolejność wykonawcza po S04-01:

1. automatyczny, transakcyjny publisher kolekcji i idempotentne przetwarzanie;
2. koordynator źródeł wieloartefaktowych;
3. kolejne adaptery oraz aktywacja następnej fali gmin;
4. internal source-ops API i operacyjny rollout manifestu;
5. fixture-independent gate dla 100 realnych adresów;
6. konsumencka PWA po osiągnięciu jakości danych.

Issues `#41–#45` oraz `#47–#51` częściowo opisują te same rezultaty. `#40` pokrywa się z już scalonym S04-01. Przed dalszą realizacją backlog powinien zostać skonsolidowany pod kątem właściciela, zależności i jednego kryterium akceptacji. Ta dokumentacja nie zmienia backlogu.

## Bramka wyjścia z pilota

Pilot jest ukończony dopiero, gdy:

- wszystkie 8 gmin ma aktywne, monitorowane źródła wymagane dla uzgodnionego zakresu;
- próba 100 realnych adresów, niezależna od fixtures, przechodzi uzgodniony próg zgodności;
- każdy wynik zachowuje źródło, świeżość, verification status i ostrzeżenia;
- zmiana lub awaria źródła jest wykrywana, trafia do właściciela i ma zmierzony czas naprawy;
- nie ma krytycznych, nierozstrzygniętych konfliktów danych.

Golden gate 30/30 adresów i 8/8 obiektów pozostaje bramką regresyjną CI, nie dowodem spełnienia powyższych warunków.

## Metryki

- Coverage: procent adresów z jednoznacznym service area i harmonogramem.
- Correctness: zgodność dat/frakcji/obiektu z aktualnym źródłem w audytowanej próbie.
- Provenance completeness: procent odpowiedzi z kompletnym dowodem i okresem obowiązywania.
- Freshness: opóźnienie od zmiany źródła do zatwierdzonej publikacji.
- Source health: udział udanych pobrań i parse'ów oraz liczba źródeł bez aktywnego handlera.
- Operations: liczba review, false positives i median time to resolution.
- Unit economics: koszt wdrożenia i miesięcznego utrzymania adaptera na gminę.

Progi liczbowe dla bramki 100 adresów powinny zostać zatwierdzone przed uruchomieniem próby i zapisane w wersjonowanym readiness report, aby uniknąć dopasowania kryteriów do wyniku.

## Horyzont po pilocie

- fala 20 gmin: sprawdzenie ponownego użycia adapterów i procesu data-ops;
- fala około 100 gmin: regionalne partnerstwa, SLA, monitoring kosztu i incydentów;
- rollout krajowy: dopiero po dowodzie ekonomii utrzymania oraz stabilności kontraktów;
- aplikacja i powiadomienia: budowane na jakości danych, z prywatnością zaprojektowaną przed zbieraniem danych użytkownika;
- verified data/API dla partnerów: wersjonowanie, limity, support i jasna odpowiedzialność.

Decyzja o przejściu między falami opiera się na metrykach jakości i kosztu, nie wyłącznie na liczbie dodanych gmin.
