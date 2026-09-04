# Roadmapa, pilot i metryki

> Stan zweryfikowany 2026-09-04 względem `main` `5502dae9b7989382b1237243dfb9ee0e65982543`. Roadmapa opisuje kolejność decyzji i bramki jakościowe, nie obietnicę terminu ani budżetu.

## Aktualna pozycja

WastePL wyszedł poza czysty Data Platform PoC: ma działającą regionalną warstwę danych, publiczne API, 17 ACTIVE source identities w 8 gminach, PWA z mapą PSZOK i `.ics` oraz Playwright E2E.

Najważniejszym ryzykiem nie jest już brak kolejnych adapterów sam w sobie. Ryzyka nadrzędne to:

- nieznane pełne **address coverage** całego pilota;
- utrzymywalność 17 realnych upstreamów;
- brak technicznego wymuszenia CI na `main`;
- niedomknięty production operations;
- niepełna installability/a11y/observability PWA;
- brak pełnego scheduled Web Push;
- niewystarczająco dojrzała ekonomia utrzymania do skalowania krajowego.

## Stan bazowy pilota

- 8 gmin w manifeście `pilot-koszalin-region@2026.13`;
- 8/8 gmin z co najmniej jednym ACTIVE collection scope;
- 8/8 gmin z ACTIVE PSZOK;
- 17 ACTIVE source identities: 9 collection + 8 PSZOK;
- 415/415 audytowanych realnych adresów PRG przechodzi przypisane gate'y;
- pełny denominator wszystkich adresów PRG w 8 gminach **nie został jeszcze policzony**;
- live-source gate jest skonfigurowany dla 17/17, ale aktualny pełny manualny soak 17/17 wymaga wykonania/potwierdzenia na bieżącym `main`;
- PWA działa jako thin client, ale pozostaje pre-production.

## Zasada metryk coverage

Od tej wersji roadmapy nie używamy samego `8/8` jako synonimu pełnego coverage.

Raportujemy osobno:

1. **municipality source presence** — liczba gmin z >=1 aktywnym zakresem;
2. **address coverage** — `supported official PRG addresses / all official PRG addresses in pilot`;
3. **ambiguity rate** — udział adresów z więcej niż jednym bezpiecznie nierozstrzygalnym service area;
4. **audited-address correctness** — poprawność dat/frakcji w audytowanych próbkach.

`415/415` jest wynikiem audited correctness dla zdefiniowanych zestawów, a nie dowodem 100% pokrycia całego regionu.

# P0 — repo governance

## Branch protection `#84`

`main` ma wymagać:

- zmian przez pull request;
- zakończonego wymaganym statusem CI;
- blokady merge przy pending/failed checks;
- blokady zwykłych direct pushy;
- kontrolowanego admin override tylko awaryjnie.

**Definition of Done:** nie da się zmergować PR do `main`, jeżeli wymagany CI nie jest zielony.

# P0 — potwierdzić bieżące źródła live

## Full live-source soak 17/17

Uruchomić `live-source-staging` ręcznie z aktualnego `main` po wszystkich zmianach `2026.13`.

Definition of Done:

- wszystkie 17 ACTIVE source identities mają jawny live outcome;
- pobranie odbywa się z realnych stron JST/operatorów;
- parser/template drift i canonical evidence są ocenione;
- każde `FETCH_FAILED`, `PARSE_FAILED`, `WAITING_FOR_COMPANION` i krytyczne `REVIEW_REQUIRED` zatrzymuje zamknięcie zadania;
- raport JSON/Markdown jest ręcznie przejrzany;
- run ID, SHA i wynik trafiają do `docs/current-status.md`.

Po pierwszym pełnym przebiegu uruchomić cykliczny source-health check poza deterministycznym PR CI.

# P0 — PRG Address Coverage Census

To jest następny najważniejszy milestone produktowy.

Dla wszystkich oficjalnych adresów PRG z 8 gmin zbudować raport:

| Gmina | Wszystkie PRG | Supported | Unsupported | Ambiguous | Coverage % |
| --- | ---: | ---: | ---: | ---: | ---: |
| Koszalin | TBD | TBD | TBD | TBD | TBD |
| Manowo | TBD | TBD | TBD | TBD | TBD |
| Bobolice | TBD | TBD | TBD | TBD | TBD |
| Świeszyno | TBD | TBD | TBD | TBD | TBD |
| Tychowo | TBD | TBD | TBD | TBD | TBD |
| Sianów | TBD | TBD | TBD | TBD | TBD |
| Polanów | TBD | TBD | TBD | TBD | TBD |
| Będzino | TBD | TBD | TBD | TBD | TBD |

Raport powinien identyfikować przyczynę każdego `unsupported`/`ambiguous`, np.:

- brak service area;
- brak source evidence;
- overlap reguł;
- route semantics;
- difficult access;
- building type;
- brak jednoznacznego canonical fraction mapping.

**Definition of Done:** pełny denominator PRG istnieje, wynik jest machine-readable i generuje mierzalny backlog coverage.

# P1 — domknąć coverage obecnych 8 gmin

Nie dodawać kolejnych gmin dla samego wzrostu licznika.

Priorytet rolloutów wyznaczać według relacji:

`liczba odblokowanych adresów / (czas wdrożenia + maintenance risk)`

Najpierw usuwać największe dziury ujawnione przez Address Coverage Census.

Przykładowe zakresy, które mogą wymagać dalszego rozszerzania po census:

- Bobolice — zakresy poza bezpiecznym Kłanino;
- Świeszyno — zakresy poza Chałupami;
- Będzino — pozostałe trasy, OSŁONY i difficult access;
- Sianów — zakresy z ogólną semantyką `odpady segregowane`;
- Polanów — kolejne dzieci tylko przy jednoznacznym evidence;
- Tychowo — city/hard-to-reach tylko przy bezpiecznym modelu źródłowym.

Target pilota przed skalowaniem: orientacyjnie **>=90–95% address coverage**, niski ambiguity rate i jawnie sklasyfikowane wyjątki. 100% nie jest wymagane za wszelką cenę, jeśli ostatnie procenty mają nieproporcjonalny koszt lub ryzyko.

# P1 — PWA do poziomu realnego pilota

## Installability

Domknąć:

- 192x192;
- 512x512;
- maskable icon;
- Apple touch icon;
- poprawny manifest;
- walidację instalacji na iOS Safari i Android Chrome.

## Browser E2E

Playwright jest już dodany. Rozszerzać testy przede wszystkim o krytyczne ścieżki użytkownika:

- address search → schedule;
- unsupported;
- ambiguous;
- API error;
- stale/review state;
- reload z local storage;
- offline cached schedule;
- PSZOK/map;
- `.ics`.

Utrzymywać osobne mobile viewports przynajmniej dla reprezentatywnego iPhone i Androida.

## Accessibility i Lighthouse

Dodać:

- axe;
- keyboard navigation;
- focus states i dialog focus management;
- aria labels;
- contrast audit;
- Lighthouse CI lub równoważną automatyczną bramkę.

Praktyczne progi początkowe:

- Accessibility >=95;
- Best Practices >=95;
- mobile Performance >=80.

Nie traktować 100/100 jako celu samego w sobie.

# P1/P2 — reminders

## MVP `.ics`

`.ics` jest obecnie najprostszą niezawodną ścieżką przyszłych przypomnień, ponieważ alarm wykonuje kalendarz systemowy użytkownika.

Może pozostać oficjalnym reminder MVP, dopóki Web Push nie ma pełnej ścieżki produkcyjnej.

## Scheduled Web Push

Jeżeli aplikacja ma samodzielnie przypominać o jutrzejszym odbiorze, potrzebna jest kompletna architektura:

`PushSubscription → API/storage → scheduler/queue → Web Push sender → service-worker push → notification`

Zakres:

- VAPID;
- anonymous installation ID;
- subscription/unsubscribe API;
- preference storage;
- timezone `Europe/Warsaw`;
- queue/scheduler;
- retry i cleanup wygasłych subskrypcji;
- service-worker `push` i `notificationclick`;
- obsługa zmiany/usunięcia harmonogramu.

Nie wprowadzać kont użytkowników tylko po to, aby dostarczyć reminder.

# P1 — staging i production foundation

Przed publicznym pilotem przygotować osobne środowisko stagingowe i produkcyjne.

Minimum:

- PWA/CDN;
- API;
- worker;
- managed PostgreSQL/PostGIS;
- Redis/BullMQ;
- object storage;
- secrets management;
- TLS/DNS;
- automatyczny deployment;
- backupy i udokumentowany restore.

Repozytorium nie powinno traktować lokalnego `docker-compose.yml` jako substytutu infrastruktury produkcyjnej.

# P1 — observability i source operations

Minimum operacyjne:

## API

- request count;
- 4xx/5xx;
- p95 latency;
- request/correlation ID.

## Worker

- queue depth;
- failed/retried jobs;
- processing duration;
- stalled jobs.

## Sources

- last successful fetch;
- last successful parse/publication;
- freshness;
- drift;
- `REVIEW_REQUIRED`;
- source owner / incident owner.

Alertować na warunki wymagające reakcji, nie na każdy pojedynczy transient failure.

# P1 — security/reproducibility hardening

Backlog przed produkcją:

- globalna walidacja requestów i sensowne payload limits;
- security headers;
- public rate limiting;
- wzmocnienie internal API poza statyczny klucz tam, gdzie wymaga tego model wdrożenia;
- rotacja sekretów;
- `pnpm install --frozen-lockfile`;
- pinning obrazów infrastrukturalnych;
- Dependabot/Renovate;
- CodeQL/dependency audit/secret scanning;
- pinning GitHub Actions.

# P2 — real-user pilot

Po domknięciu PWA i produkcji uruchomić małą grupę realnych testerów z różnych gmin i typów zabudowy.

Mierzyć funnel:

`app open → address search → address selected → schedule shown → calendar/reminder enabled → return visit`

KPI:

- address search success rate;
- unsupported rate;
- ambiguous rate;
- time-to-first-schedule;
- `.ics`/reminder activation;
- repeat usage;
- zgłoszone wrong-date/fraction cases.

Dodać prosty feedback `Czy harmonogram dla tego adresu jest poprawny? Tak/Nie` z możliwością przekazania bezpiecznych szczegółów błędu.

# P2 — unit economics

Kontynuować machine-readable onboarding metrics, ale rozszerzyć je o realny czas operacyjny:

- discovery;
- source analysis;
- adapter/config;
- tests;
- review;
- deployment;
- repeat update;
- incident/maintenance.

Kluczowe wskaźniki:

- średni human-active onboarding cost per source/gmina;
- miesięczny maintenance/source-ops cost;
- adapter reuse;
- repeat-update automation;
- incidents per active source;
- MTTR.

Obecna próbka jest zbyt mała do wiarygodnego forecastu dla 2477 gmin.

# P3 — fala ~20 gmin

Rozszerzenie regionalne dopiero po osiągnięciu bramki pilota.

Preferować klaster geograficzny/operatorowy, aby maksymalizować reuse formatów, operatorów i procesów.

Nie skalować tylko dlatego, że nowe źródła przechodzą CI.

## Bramka przed falą ~20 gmin

Wymagane:

- branch protection i wymuszony CI;
- regularny live-source monitoring;
- znane pełne address coverage obecnych 8 gmin;
- zaakceptowany poziom coverage i ambiguity;
- installable PWA z browser E2E/a11y/Lighthouse;
- production monitoring + backup/restore;
- real-user pilot;
- znany koszt miesięcznego utrzymania;
- więcej niż symboliczna próbka repeat-update automation;
- brak krytycznych nierozstrzygniętych wrong-date mismatches.

# Metryki sterujące decyzjami

- **Municipality source presence** — gminy z >=1 aktywnym zakresem.
- **Address coverage** — udział wszystkich oficjalnych adresów PRG z jednoznacznym harmonogramem.
- **Correctness** — zgodność dat/frakcji z aktualnym źródłem w audytowanej próbie.
- **Ambiguity** — udział adresów, których system nie może bezpiecznie rozstrzygnąć.
- **Provenance completeness** — kompletność source/artifact/parser evidence.
- **Freshness** — czas od zmiany upstreamu do bezpiecznej publikacji.
- **Source health** — fetch/parse success i drift.
- **Operations** — review, incidents, MTTR i false positives.
- **Unit economics** — human-active onboarding i maintenance per source/municipality.
- **Adapter reuse** — udział aktywacji bez tworzenia całkiem nowego adaptera.
- **Repeat-update automation** — udział kolejnych aktualizacji bez interwencji człowieka.
- **User value** — successful address lookup, reminder/calendar activation i repeat usage.

# Czego teraz nie robić

- nie dodawać kolejnych gmin przed policzeniem coverage obecnych 8;
- nie traktować `8/8` jako 100% address coverage;
- nie zgadywać route/building/fraction/coordinate semantics;
- nie traktować fixture CI jako substytutu realnego live soaka;
- nie budować kont użytkowników bez potrzeby;
- nie skalować krajowo przed dowodem unit economics i source operations;
- nie dodawać nowych funkcji, które nie zwiększają coverage/correctness, nie obniżają kosztu utrzymania ani nie poprawiają realnego UX mieszkańca.

## Kolejność wykonawcza

**branch protection → current live soak 17/17 → PRG Address Coverage Census → domknięcie coverage 8 gmin → PWA installability + E2E/a11y/Lighthouse → reminders → staging/prod + observability → real-user pilot → unit economics → fala ~20 gmin.**
