# Retrospektywa Sprintu 01

## Cel

Sprint 01 miał udowodnić najkrótszy pion wartości: stabilny kontrakt danych, dwa deterministycznie obsługiwane harmonogramy oraz odpowiedź API `adres → obszar obsługi → daty odbioru` z provenance.

Szczegółowy, historyczny zakres akceptacji pozostaje w [specyfikacji Sprintu 01](../sprint-01.md).

## Dostarczono

- modularny monolit API/worker/domain i lokalną infrastrukturę PostGIS, Redis, MinIO;
- kanoniczne kontrakty JSON Schema, OpenAPI i migracje;
- immutable artifact ingestion z SHA-256, warunkowym HTTP, deduplikacją i audytem;
- deterministyczne fixtures/parsery Koszalin i Manowo;
- model adresu, service area, harmonogramu i jakości/provenance;
- endpoint `/v1/addresses/resolve` oraz kolekcję po adresie;
- golden gate 30 adresów z jednoznacznymi oczekiwaniami.

Kryterium Sprintu 01 dotyczyło 2 gmin i 30 adresów. Liczba 100 adresów należy do późniejszej bramki całego pilota ośmiu gmin i nie powinna być używana do opisu wyniku Sprintu 01.

## Co zadziałało

- Rozpoczęcie od kontraktów i pionu E2E ograniczyło rozjazd API, bazy i testów.
- Immutable artifacts i provenance powstały zanim dodano wiele parserów, co zachowało audytowalność.
- Jawne konflikty service-area oraz fixture-derived markers zapobiegły prezentowaniu niepewnego wyniku jako faktu.
- Golden data dało szybki sygnał regresji dla adresów i harmonogramów.

## Co ujawnił sprint

- Oficjalny adres nie wystarcza do wyboru harmonogramu; potrzebne są reguły obszaru obsługi.
- Format źródła i jego layout są częścią ryzyka operacyjnego. Jeden „uniwersalny parser PDF” nie jest realistyczną podstawą jakości.
- Fixtures są niezbędne dla CI, ale mogą stworzyć fałszywe poczucie pokrycia, jeżeli nie oddzieli się ich od produkcyjnych pobrań.
- PSZOK, punkty kaucyjne, source health, review i manifesty wymagają własnych kontraktów i zostały poprawnie przeniesione do kolejnych sprintów.

## Dług techniczny i procesowy

- Zwiększać próbę produkcyjną niezależnie od zestawu regresyjnego.
- Przechowywać każdą liczbę statusową z datą i SHA.
- Nie kopiować OpenAPI, DDL i JSON Schema do dokumentów narracyjnych.
- Konsolidować zadania, gdy kolejny sprint tworzy dwa issues dla tego samego rezultatu.
- Testować operacje datowe w UTC i strefie Europe/Warsaw; późniejszy importer PRG ujawnił ryzyko idempotencji poza UTC.

## Ocena

Sprint 01 osiągnął swój ograniczony cel techniczny. Nie ukończył pełnego pilota, nie potwierdził jakości dla ośmiu gmin i nie zweryfikował modelu biznesowego. Jego trwałym wynikiem jest audytowalny pion oraz kontrakty, na których zbudowano Sprinty 02–04.
