# Architektura WastePL

## Kształt systemu

WastePL jest modułowym monolitem TypeScript: publiczne i wewnętrzne API NestJS/Fastify, worker BullMQ, współdzielona domena oraz konsumencka PWA React/Vite. PostgreSQL/PostGIS jest systemem zapisu, Redis obsługuje kolejki, a magazyn S3-compatible przechowuje niemutowalne artefakty źródłowe.

```text
public upstreams
      ↓
source manifest
      ↓
scheduler → conditional fetch → SHA-256 → immutable artifact
      ↓                                      ↓
processing outbox → parser dispatch → normalization
      ↓
validation → review/reconciliation → atomic publication
      ↓
PostgreSQL/PostGIS
      ↓
public API / internal data-ops API
      ↓
consumer PWA / integrations
```

Szczegółowe decyzje są zapisane w [ADR](../adr/). Kontrakty wykonawcze znajdują się w [OpenAPI](../../openapi/), [JSON Schema](../../schemas/) i [migracjach](../../db/migrations/).

## Pozyskanie i artefakty

Rejestr źródeł przechowuje URL, format, właściciela, polling i okres obowiązywania. Fetcher zachowuje ETag/Last-Modified, rejestruje każdą próbę oraz używa SHA-256 do deduplikacji. Powtórna identyczna treść i HTTP 304 nie tworzą nowego artefaktu.

Surowy artefakt jest niemutowalny. Korekta parsera tworzy nowy wynik przetwarzania i zachowuje wcześniejsze evidence zamiast modyfikować historię.

Worker dispatchuje parser na podstawie jawnej rejestracji źródła/formatu. Brak handlera, niekompletny bundle lub konflikt evidence jest obserwowalnym stanem błędu/review, a nie cichym fallbackiem.

## Normalizacja i publikacja

Parser zwraca dane razem z provenance: źródłem, artefaktem, czasem pobrania i parser key/version. Warstwa normalizacji stosuje kontrakty i reguły domenowe. Konflikty, niska pewność lub istotna zmiana trafiają do review.

Publikacja harmonogramów i facilities jest transakcyjna/atomowa, aby odbiorca nie zobaczył częściowo zaktualizowanego stanu.

Deterministyczne parsery pozostają pierwszym wyborem. OCR/AI może być jawnym adapterem/fallbackiem z confidence i review; nie może tworzyć oficjalnych identyfikatorów ani dopowiadać brakujących danych.

## Rozwiązywanie adresu

TERYT i PRG dostarczają referencji adresowej. Resolver normalizuje zapytanie, znajduje kandydatów i stosuje reguły obszaru obsługi: gmina, miejscowość, ulica, zakres/parzystość numeru, typ nieruchomości lub jawny wyjątek.

Niejednoznaczny najlepszy wynik zwraca konflikt zamiast arbitralnego wyboru.

Publiczny endpoint to `/v1/addresses/resolve`; pełne parametry i odpowiedzi określa [publiczne OpenAPI](../../openapi/wastepl-v0.1.yaml).

## Collection coverage

Architektura celowo rozdziela obecność źródła w gminie od pełnego pokrycia adresów.

Aktywny source może reprezentować bezpieczny podzbiór miejscowości lub trasy. Dlatego system nie może wyprowadzać `100% address coverage` z samego faktu, że wszystkie 8 gmin mają co najmniej jeden ACTIVE collection scope.

Docelowa metryka coverage opiera się na pełnym zbiorze oficjalnych adresów PRG i wyniku resolvera dla każdego adresu.

## Obiekty i provenance

PSZOK i punkt kaucyjny mają oddzielny `facilityKind` od możliwości przyjmowania materiałów. `UNKNOWN` jest odrębne od zamknięcia lub niedostępności. Współrzędne mogą być nieznane; system nie tworzy fikcyjnych punktów.

Godziny, dostęp, status i lokalizacja wymagają assertion/provenance. Dla pilota wszystkie 8 aktywnych PSZOK ma zweryfikowaną warstwę trusted geocoding opartą o referencję PRG/GUGiK.

## Live-source staging

Deterministyczne CI i fixtures nie są substytutem rzeczywistego testu upstreamów.

`live-source-staging` uruchamia produkcyjny fetch/parser path w izolowanym środowisku przeciwko realnym stronom JST/operatorów. Aktualny gate jest przygotowany dla 17 ACTIVE source identities z manifestu `2026.13`.

Samo przejście kodu gate'a w PR CI nie dowodzi, że aktualna flota 17 źródeł została właśnie pobrana live. Szczegóły i Definition of Done opisuje [runbook](../runbooks/live-source-staging-gate.md).

## Consumer PWA

`apps/pwa` jest cienkim klientem nad publicznym API i nie zawiera gminnych reguł biznesowych ani parserów.

Zaimplementowane są m.in.:

- address search/selection;
- harmonogram najbliższych odbiorów;
- source/provenance/freshness;
- PSZOK i mapa Leaflet/OpenStreetMap;
- local storage wybranego adresu;
- service worker/runtime cache;
- `.ics`;
- browser notification permission/test notification;
- Playwright E2E.

PWA nadal wymaga domknięcia installability assets, Lighthouse/a11y oraz produkcyjnej ścieżki scheduled Web Push, jeśli reminder ma działać niezależnie od `.ics`.

## Stan wdrożenia

Wdrożone są:

- immutable source artifacts;
- source registry/fetch/audit;
- scheduler/outbox i BullMQ runtime;
- wersjonowane manifesty;
- dispatch parserów;
- transakcyjny publisher;
- bundle coordination;
- temporal history;
- TERYT/PRG address/reference layer;
- collection i facility semantics;
- trusted PSZOK geocoding;
- review/source-ops API;
- readiness/production gates;
- onboarding metrics;
- consumer PWA;
- Playwright E2E.

Niedomknięte przed produkcją są przede wszystkim:

- branch protection/required CI;
- pełny PRG Address Coverage Census;
- aktualny pełny live-source soak 17/17 i cykliczny source monitoring;
- staging/production deployment;
- observability i alerting;
- backup/restore runbook i test restore;
- public API hardening/rate limits/security headers;
- stronger internal auth odpowiedni do modelu wdrożenia;
- PWA installability/a11y/Lighthouse;
- scheduled Web Push.

[Bieżący status](../current-status.md) jest kanonicznym opisem stanu operacyjnego.

## Jakość, bezpieczeństwo i operacje

- wejścia i dane są walidowane względem wersjonowanych kontraktów;
- migracje są kanoniczną definicją bazy;
- sekrety trafiają przez środowisko, nie do repozytorium;
- publiczne i wewnętrzne endpointy mają osobne kontrakty;
- parsery mają fixtures i testy regresyjne;
- integracje są testowane z PostGIS/Redis/S3-compatible storage;
- source health/readiness nie zastępuje monitoringu produkcyjnego;
- pełna gotowość produkcyjna wymaga infrastruktury, observability, backup/restore, security hardening i regularnego testowania realnych upstreamów.
