# Roadmapa, pilot i metryki

> Stan zweryfikowany 2026-08-31 dla baseline `main` po PR `#82` (`c2722aa85269d90fe1a0d0eb3835cb2646fb30b1`). Roadmapa opisuje kolejność decyzji i bramek jakościowych, nie obietnicę terminu ani budżetu.

## Ukończone etapy

| Etap | Wynik |
| --- | --- |
| Sprint 01 | Kontrakty v0.1, pierwszy pion adres → harmonogram, golden gate 30 adresów. |
| Sprint 02 | Facility v0.2, PSZOK/deposit model, provenance, reconciliation i atomowa ingestia. |
| Sprint 03 | Oficjalne referencje TERYT/PRG, scheduler/outbox, review workflow, source manifest i readiness gate. |
| Sprint 04 | Produkcyjny artifact-processing worker, dispatch parserów, transakcyjny publisher, bundle coordination, source-ops API, fixture-independent production gate i real-100 consumer gate. |
| Sprint 05 do `2026.6` | Coverage expansion + onboarding economics; Sianów/Tychowo PSZOK oraz bezpieczny Polanów Garbno H2. Collection coverage wzrosło do 4/8. |

## Aktualna pozycja

WastePL ma utwardzony Data Platform PoC i wystarczająco dużo realnego coverage, aby po zamknięciu live-source gate rozpocząć pierwszy cienki produkt konsumencki. Najważniejszym ryzykiem nie jest już brak kolejnej abstrakcji backendowej, tylko utrzymywalność realnych upstreamów oraz ograniczone collection coverage.

Aktualny pilot:

- 8 gmin w manifeście;
- 7/8 gmin z co najmniej jednym ACTIVE typem danych;
- 4/8 gmin z ACTIVE collection schedule;
- 5/8 gmin z ACTIVE PSZOK;
- 10 ACTIVE source identities;
- formalny real-100 gate = 100/100;
- dodatkowy Polanów Garbno gate = 39/39;
- onboarding summary przez `2026.6`: 9 activation records, 3 prospective, reuse 4/9, first-import automation 8/9, repeat-update automation 3/3.

## P0 — domknąć real-source survivability `#60`

Przed rozpoczęciem PWA wymagany jest przynajmniej jeden rzeczywisty, ręcznie przejrzany `live-source-staging` run z aktualnego `main`.

Definition of Done:

- workflow uruchomiony przez `workflow_dispatch`;
- wszystkie 10 ACTIVE source identities mają jawny live outcome;
- publiczne upstreamy są naprawdę pobrane, a nie zastąpione fixtures;
- parser/template drift i canonical evidence są ocenione;
- Koszalin PSZOK bundle jest kompletny;
- archived JSON/Markdown report został ręcznie przejrzany;
- każde `FETCH_FAILED`, `PARSE_FAILED`, `WAITING_FOR_COMPANION` lub krytyczny brak evidence jest naprawiony albo jawnie zatrzymuje gate.

PR `#82` dostosował gate do `2026.6`, w tym do authoritative locality context wymaganego przez aktywny Polanów Garbno parser. Deterministyczne CI nie zastępuje jednak realnego soaka.

## P1 — thin consumer PWA `#51`

Po zamknięciu `#60` rozpocząć pierwszy konsumencki vertical. Nie budować jeszcze natywnych aplikacji iOS/Android ani systemu kont.

Zakres MVP:

1. resolve/search adresu przez WastePL API;
2. najbliższa zbiórka i następne terminy;
3. frakcja, data, source i freshness;
4. jawne stany `unsupported`, `ambiguous`, `stale`, `review` i błędy;
5. zapis adresu w local storage;
6. lista pobliskich PSZOK;
7. mapa tylko dla obiektów z trusted location;
8. mobile-first installable PWA;
9. podstawowy Lighthouse/a11y gate;
10. zero parserów i gminnych reguł biznesowych w frontendzie.

PWA ma walidować wartość dla użytkownika na już istniejącym API. React Native/Expo może zostać dodane później, jeśli zachowanie realnych użytkowników uzasadni koszt drugiego klienta.

## P1 — collection coverage 4/8 → 5/8

Rozszerzanie collection coverage powinno działać równolegle z PWA po zamknięciu #60. Następny subset wybierać według mierzalnego kosztu i ryzyka, nie według najłatwiejszej liczby do dopisania w statusie.

Kryteria wyboru:

- deterministyczny source/artifact capture;
- możliwość jednoznacznego address/service-area mapping;
- koszt nowego adaptera vs reuse/extension;
- stabilność upstreamu;
- liczba realnych adresów, które nowy subset odblokuje;
- ryzyko nakładania się difficult-access / building-type / route semantics;
- brak konieczności zgadywania canonical fractions.

Bieżący backlog kandydatów:

- Bobolice — mixed image/attachment H2;
- Świeszyno — legacy child host;
- Będzino — route I/II, OSŁONY, difficult access;
- Sianów — generic `odpady segregowane`;
- kolejne bezpieczne dzieci Polanowa — tylko osobnymi deterministic gates;
- Tychowo city/hard-to-reach — dopiero po jednoznacznym modelu źródłowym.

## P1 — trusted facility geocoding

Dla mapy PSZOK nie wolno wprowadzać pozornej precyzji.

Priorytet dowodu lokalizacji:

1. współrzędne opublikowane w oficjalnym źródle;
2. jednoznaczne dopasowanie oficjalnego adresu do PRG;
3. `location=null`, jeśli nie ma bezpiecznego dowodu.

Geocoding ma mieć własny provenance i nie może udawać informacji dostarczonej przez gminę.

## P2 — powiadomienia

Dopiero po walidacji podstawowego UX PWA:

- przypomnienia lokalne/Web Push;
- wybierany przez użytkownika czas przypomnienia;
- obsługa zmian harmonogramu i stale/review states;
- bez systemu kont, dopóki produkt rzeczywiście go nie potrzebuje.

## P2 — system kaucyjny / punkty zwrotu

Traktować jako osobny strumień danych. Nie blokuje MVP harmonogramów i PSZOK.

Przed ogólnopolską mapą ustalić:

- wiarygodny national feed lub zestaw feedów;
- licencję i prawo do wykorzystania danych;
- freshness/update semantics;
- jakość geolokalizacji;
- deduplikację punktów/operatorów;
- odpowiedzialność za nieaktualne lokalizacje.

Nie budować ręcznie utrzymywanej ogólnopolskiej mapy jako substytutu brakującego feedu.

## Bramka wyjścia z 8-gminnego pilota

Pilot jest operacyjnie domknięty dopiero, gdy:

- uzgodniony zakres danych dla 8 gmin ma jawny ACTIVE albo świadomie zaakceptowany unsupported scope;
- real-address gates przechodzą ustalone progi z zerową tolerancją dla krytycznych wrong-date mismatches;
- live-source soak jest wykonywany regularnie i ma ownerów incydentów;
- source/provenance/freshness/review semantics są zachowane w API;
- onboarding i repeat-update economics mają wystarczającą liczbę prospektywnych obserwacji;
- nie ma krytycznych nierozstrzygniętych konfliktów danych.

Sama liczba ACTIVE sources nie jest bramką wyjścia.

## P2 — fala 20 gmin

Nie uruchamiać pełnej fali 20 gmin tylko dlatego, że pojedyncze rollouts przechodzą CI. Najpierw potrzebny jest lepszy dowód skalowalności.

Wymagane sygnały:

- rosnący adapter reuse;
- więcej pełnych `PROSPECTIVE` onboarding records;
- repeat updates bez ręcznej ingerencji;
- akceptowalny human-active onboarding time;
- znany miesięczny maintenance/source-ops cost;
- działający proces drift/incident ownership;
- brak degradacji correctness przy wzroście coverage.

Dopiero potem rozszerzać regionalnie do ~20 gmin, następnie ~100, a rollout krajowy rozważać po dowodzie ekonomii utrzymania.

## Metryki sterujące decyzjami

- **Coverage** — udział adresów z jednoznacznym service area i harmonogramem.
- **Correctness** — zgodność dat/frakcji z aktualnym źródłem w audytowanej próbie.
- **Ambiguity** — liczba przypadków, których system nie może bezpiecznie rozstrzygnąć.
- **Provenance completeness** — kompletność source/artifact/parser evidence.
- **Freshness** — czas od zmiany upstreamu do bezpiecznej publikacji.
- **Source health** — fetch/parse success i drift.
- **Operations** — review, incidents, MTTR i false positives.
- **Unit economics** — human-active onboarding i maintenance per source/municipality.
- **Adapter reuse** — udział aktywacji bez tworzenia całkiem nowego adaptera.
- **Repeat-update automation** — udział kolejnych aktualizacji bez interwencji człowieka.

## Czego teraz nie robić

- nie budować natywnego iOS/Android przed walidacją thin PWA;
- nie dodawać kont, social features ani CMS bez sygnału produktowego;
- nie pompować łatwego PSZOK coverage kosztem collection coverage;
- nie zgadywać route/building/fraction/coordinate semantics;
- nie traktować fixture CI jako zamiennika realnego public-upstream soaka;
- nie skalować krajowo przed dowodem unit economics i source-ops.

## Kolejność wykonawcza

**`#60 live soak → #51 thin PWA + collection 4/8→5/8 → trusted facility geocoding → notifications → deposit feed → fala 20 gmin`.**

Decyzje między etapami opierają się na jakości, utrzymywalności i koszcie, nie wyłącznie na liczbie dodanych gmin.
