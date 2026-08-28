# Architektura WastePL

## Kształt systemu

WastePL jest modułowym monolitem TypeScript: publiczne i wewnętrzne API NestJS/Fastify, worker BullMQ oraz współdzielona domena. PostgreSQL/PostGIS jest systemem zapisu, Redis obsługuje kolejki, a magazyn S3-compatible przechowuje niemutowalne artefakty źródłowe.

```text
source manifest
    ↓
scheduler → conditional fetch → SHA-256 → immutable artifact
    ↓                                      ↓
processing outbox → parser dispatch → normalization
    ↓
validation → review/reconciliation → atomic publication
    ↓
PostgreSQL/PostGIS → public API / internal data-ops API
```

Szczegółowe decyzje i ich konsekwencje są zapisane w [ADR](../adr/). Kontrakty wykonawcze znajdują się w [OpenAPI](../../openapi/), [JSON Schema](../../schemas/) i [migracjach](../../db/migrations/).

## Pozyskanie i artefakty

Rejestr źródeł przechowuje URL, format, ownera, polling i okres obowiązywania. Fetcher zachowuje ETag/Last-Modified, rejestruje każdą próbę oraz używa SHA-256 do deduplikacji. Powtórna identyczna treść i HTTP 304 nie tworzą nowego artefaktu. Surowy artefakt jest niemutowalny; korekta parsera tworzy nowy wynik przetwarzania, nie zmienia historii.

Runtime S04-01 wiąże outbox z rejestrem handlerów i dispatchuje parser według manifestu. Obsługa produkcyjna jest obecnie jawnie ograniczona do zarejestrowanych parserów; brak handlera jest obserwowalnym błędem, a nie cichym fallbackiem.

## Normalizacja i publikacja

Parser zwraca dane wraz z dowodem: URL, artefakt, czas pobrania i fragment źródła. Warstwa normalizacji stosuje kontrakty i reguły domenowe. Konflikty, niska pewność lub istotna zmiana trafiają do review. Publikacja pakietu obiektu jest atomowa, aby odbiorca nie zobaczył częściowo zaktualizowanego stanu.

Deterministyczne parsery są pierwszym wyborem. OCR/AI jest dopuszczalny jako jawny adapter/fallback z confidence i review; nie może samodzielnie tworzyć oficjalnych identyfikatorów ani ukrywać braku danych.

## Rozwiązywanie adresu

TERYT i PRG dostarczają oficjalnej referencji. Resolver normalizuje zapytanie, znajduje kandydatów i stosuje reguły obszaru obsługi: gmina, miejscowość, ulica, zakres/parzystość numeru, typ nieruchomości lub jawny wyjątek. Niejednoznaczny najlepszy wynik zwraca konflikt zamiast arbitralnego wyboru.

Publiczny endpoint to `/v1/addresses/resolve`; pełne parametry i odpowiedzi określa [publiczne OpenAPI](../../openapi/wastepl-v0.1.yaml).

## Obiekty i provenance

PSZOK i punkt kaucyjny mają oddzielny `facilityKind` od możliwości przyjmowania materiałów. `UNKNOWN` jest odrębne od zamknięcia lub niedostępności. Współrzędne mogą być nieznane; system nie tworzy fikcyjnych punktów. Godziny, dostęp i status wymagają assertion powiązanego ze źródłem. Rekonsyliacja wielu źródeł stosuje jawne reguły pierwszeństwa i świeżości.

## Stan wdrożenia

Wdrożone są: immutable artifacts, registry/fetch/audit, scheduler i outbox, wersjonowane manifesty, dispatch parserów, aktywne adaptery Koszalin/Manowo, referencje TERYT/PRG, harmonogramy, facility v0.2, review i readiness gate.

Planowane w dalszym Sprint 04 są: transakcyjny publisher kolekcji, koordynacja wielu artefaktów, kolejne adaptery i aktywacja gmin, pełniejsze internal source-ops API oraz PWA. [Bieżący status](../current-status.md) rozdziela stan wdrożony od planowanego.

## Jakość, bezpieczeństwo i operacje

- wejścia są walidowane względem wersjonowanych kontraktów;
- migracje są jedyną kanoniczną definicją bazy;
- sekrety trafiają przez środowisko, nie do repozytorium;
- publiczne i wewnętrzne endpointy mają osobne kontrakty;
- parsery posiadają fixtures i testy regresyjne, a integracje testy PostGIS/Redis/S3;
- readiness gate i source health nie są zastępstwem monitoringu produkcyjnego;
- retencja artefaktów, backup, autoryzacja internal API i limity publicznego API muszą zostać domknięte przed produkcją.
