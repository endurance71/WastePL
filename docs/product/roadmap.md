# Roadmapa WastePL — pilot, jakość, coverage i skalowanie

> Stan zweryfikowany 2026-09-04 względem `main` `5fe14ad2135061f47b60c40efc04eb6fad1aa4a5` oraz manifestu `pilot-koszalin-region@2026.13`. Roadmapa opisuje kolejność decyzji, zależności i bramki jakościowe. Nie jest obietnicą terminu ani budżetu.

## 1. Aktualna pozycja projektu

WastePL wyszedł poza czysty Data Platform PoC. Projekt ma działającą regionalną warstwę danych, publiczne API, worker ingestujący i publikujący harmonogramy, 17 ACTIVE source identities w 8 gminach, PWA dla mieszkańców, mapę PSZOK, `.ics`, Web Push, feedback mieszkańców, monitoring live sources i przygotowany fundament wdrożeniowy.

Najmocniejszą częścią projektu jest obecnie warstwa danych: provenance, temporalność, deterministyczne parsery, Source Registry, immutable artifacts, PostGIS, source health i mechanizmy readiness.

Największym ryzykiem nie jest już brak funkcji aplikacji. Ryzyka nadrzędne to:

- bardzo niskie pełne **address coverage** pilota: **1,66% (415 / 25 030 adresów PRG)**;
- brak technicznego wymuszenia CI na `main`;
- bieżący HEAD `main` nie ma pełnego runu CI;
- niepełne testy realnego offline/stale/network-failure w PWA;
- brak Lighthouse CI;
- production blueprint nie jest jeszcze pełnym wdrożeniem end-to-end;
- brak konkretnej ścieżki publikacji PWA, reverse proxy/TLS i realnego stagingu;
- backup istnieje lokalnie, ale nie ma jeszcze obowiązkowego off-site backupu;
- security automation jest niepełne: CodeQL, dependency audit/update automation, secret scanning i pinning krytycznych GitHub Actions;
- brak real-user telemetry i twardych danych unit economics z utrzymania źródeł.

Wniosek strategiczny: **nie dokładamy teraz dużych modułów produktowych. Najpierw stabilizujemy repo, runtime i produkcję, równolegle zwiększamy coverage, a dopiero potem uruchamiamy szerszy real-user pilot i skalowanie geograficzne.**

## 2. Stan bazowy pilota

- 8 gmin w manifeście `pilot-koszalin-region@2026.13`;
- 8/8 gmin z co najmniej jednym ACTIVE collection scope;
- 8/8 gmin z ACTIVE PSZOK;
- 17 ACTIVE source identities: 9 collection + 8 PSZOK;
- pełny denominator pilota: 25 030 oficjalnych adresów PRG;
- supported: 415;
- unsupported: 24 615;
- ambiguous: 0;
- address coverage regionu: 1,66%;
- 415/415 audytowanych realnych adresów PRG przechodzi przypisane gate'y;
- aktualny live-source soak: **17/17 PASS**, Run ID `33882827565`;
- PWA jest funkcjonalnym pre-production MVP;
- Web Push i `.ics` są zaimplementowane;
- feedback API i UI mieszkańca są zaimplementowane;
- production compose, DB backup i runbook istnieją jako blueprint;
- `main` pozostaje bez branch protection;
- najnowszy HEAD `5fe14ad...` nie ma pełnego workflow CI przypisanego do tego SHA.

## 3. Zasada metryk coverage

Nie używamy `8/8 gmin` jako synonimu pełnego pokrycia.

Raportujemy osobno:

1. **municipality source presence** — liczba gmin z co najmniej jednym aktywnym zakresem;
2. **address coverage** — `supported official PRG addresses / all official PRG addresses in pilot`;
3. **ambiguity rate** — udział adresów, dla których system nie może bezpiecznie wybrać jednego service area;
4. **audited-address correctness** — poprawność dat i frakcji w jawnie zdefiniowanej próbie audytowej;
5. **unsupported rate** — udział adresów, dla których WastePL jawnie odmawia podania harmonogramu zamiast zgadywać.

`415/415 PASS` oznacza 100% correctness w audytowanej próbce. Nie oznacza 100% coverage regionu.

## 4. Bramka P0 — repo, CI i wiarygodność źródeł prawdy

P0 blokuje traktowanie `main` jako wiarygodnego release candidate.

### P0.1 — uruchomić pełny CI dla aktualnego HEAD

Uruchomić pełny workflow `ci` dla aktualnego `main` `5fe14ad2135061f47b60c40efc04eb6fad1aa4a5` lub nowszego HEAD zawierającego te zmiany.

Wymagane:

- `pnpm install --frozen-lockfile`;
- `docs:check`;
- `contracts:check`;
- migracje od pustej bazy;
- build;
- typecheck;
- testy unit/integration;
- readiness gates;
- production pilot gate;
- Playwright E2E + a11y;
- smoke test API.

**DoD:** aktualny HEAD ma udokumentowany zielony pełny run CI. Nie wolno przepisywać liczby testów ani statusu na podstawie założenia.

### P0.2 — uruchamiać CI także po pushu do `main`

Dodać do `.github/workflows/ci.yml`:

```yaml
on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:
```

To jest dodatkowa warstwa ochronna. Nie zastępuje branch protection.

**DoD:** każdy commit trafiający na `main` automatycznie otrzymuje pełną weryfikację CI.

### P0.3 — branch protection / repository ruleset `#84`

`main` ma wymagać:

- zmian przez pull request;
- wymaganego statusu `ci`;
- blokady merge przy pending/failed checks;
- blokady zwykłych direct pushy;
- kontrolowanego admin override wyłącznie awaryjnie i świadomie;
- aktualnej gałęzi przed merge, jeśli repozytorium na to pozwala.

**DoD:** kontrolny PR z failing/pending CI nie może zostać zmergowany, a zielony PR może zostać zmergowany zgodnie z polityką.

### P0.4 — naprawić `docs/current-status.md`

Naprawić błędny pełny SHA zapisany w dokumencie oraz zaktualizować status do rzeczywistego, zweryfikowanego HEAD po wykonaniu P0.1.

Dodatkowo rozszerzyć `docs:check`, aby opcjonalnie wykrywał nieistniejący commit SHA lub jawnie zaznaczyć, że SHA jest tylko historycznym punktem weryfikacji.

**DoD:** `current-status.md` wskazuje istniejący commit i nie twierdzi, że nowszy HEAD przeszedł CI, jeżeli tego nie potwierdzono.

### P0.5 — aktualizować liczbę testów tylko z artefaktu CI

Obecne historyczne `78/78 PASS` jest starsze niż dodany test feedback flow `TC-2.5`.

Nie wpisywać nowej liczby ręcznie przed uruchomieniem pełnego CI.

**DoD:** liczba testów w dokumentacji jest pobrana z aktualnego raportu Playwright dla zweryfikowanego HEAD albo dokumentacja używa semantyki bez kruchej liczby typu „pełny suite PASS”.

### P0.6 — zamknąć stale alert `#101`

Issue `#101` dotyczy wcześniejszego nieudanego live-source runu. Po nim naprawiono drift i wykonano Run ID `33882827565` z wynikiem 17/17 PASS.

**DoD:** issue zostaje zamknięty jako resolved z odniesieniem do poprawki i zielonego live-source runu.

### P0.7 — utrzymać live-source soak jako stałą bramkę

Full live-source soak 17/17 jest obecnie **ZROBIONY** dla manifestu `2026.13`.

Stan referencyjny:

- Run ID `33882827565`;
- 17/17 PASS;
- 8 HEALTHY;
- 9 CHANGED_BUT_PARSEABLE;
- 0 FAIL;
- 0 REVIEW_REQUIRED.

Live soak nie może być traktowany jako jednorazowy milestone. Ma pozostać regularnym health gate dla aktywnych upstreamów.

**DoD:** aktualne źródła mają regularny live outcome, a drift prowadzi do alertu/review zamiast cichego publikowania podejrzanych danych.

## 5. Bramka P1-A — prawdziwa jakość PWA przed publicznym stagingiem

PWA jest funkcjonalna, ale określenie „pilot-ready” wymaga jeszcze domknięcia runtime failure modes.

### P1-A.1 — prawdziwy test offline Playwright

Obecny test emituje event `offline`, ale nie odcina realnie sieci.

Dodać scenariusz z rzeczywistym:

```ts
await context.setOffline(true)
```

po przygotowaniu danych/cache.

Test ma potwierdzić, że użytkownik nadal widzi wcześniej pobrany harmonogram i czytelny stan offline.

### P1-A.2 — cold-start offline

Zweryfikować zachowanie po:

1. wcześniejszym użyciu aplikacji online;
2. zamknięciu strony;
3. przejściu offline;
4. ponownym otwarciu PWA.

Osobno sprawdzić zachowanie użytkownika, który nigdy wcześniej nie pobrał danego adresu.

### P1-A.3 — stale cache / freshness UX

Dodać scenariusze dla nieaktualnych danych lokalnych:

- cached schedule + brak sieci;
- cached schedule starszy niż akceptowany freshness threshold;
- upstream/API niedostępny podczas próby odświeżenia;
- jednoznaczny komunikat, że użytkownik widzi dane z określonego czasu, a nie świeżo potwierdzony harmonogram.

### P1-A.4 — timeout i network failure API

Dodać real-browser scenariusze:

- timeout;
- aborted connection;
- DNS/network-style failure symulowany na poziomie Playwright;
- 5xx;
- odpowiedź malformed/niezgodna z kontraktem, jeśli klient może ją otrzymać.

**DoD P1-A.1–P1-A.4:** PWA ma bezpieczne i czytelne zachowanie online, offline, stale i przy awarii API bez pokazywania użytkownikowi fałszywie świeżych danych.

### P1-A.5 — Lighthouse CI

Dodać automatyczny LHCI do pipeline.

Początkowe progi mogą być pragmatyczne i później zaostrzane. Rekomendowany start:

- Performance >= 85;
- Accessibility >= 95;
- Best Practices >= 90;
- SEO >= 90;
- brak krytycznych błędów installability/PWA.

Nie traktować Lighthouse jako substytutu Playwright ani axe.

### P1-A.6 — feedback flow w pełnym CI

Najnowszy feedback mieszkańca (`ScheduleFeedbackModal`, `TC-2.5`) musi przejść ten sam pełny pipeline, co pozostałe krytyczne flow.

**DoD bramki P1-A:** aktualny PWA build przechodzi Playwright na wymaganej macierzy, real offline/cold-start/stale/error tests, axe WCAG 2.2 AA i Lighthouse thresholds.

## 6. Bramka P1-B — bezpieczeństwo i pełny deployment end-to-end

Obecny `docker-compose.prod.yml` jest fundamentem, nie dowodem gotowego wdrożenia produkcyjnego.

### P1-B.1 — nie publikować PostgreSQL/Redis/MinIO do publicznej sieci

Usunąć publiczne bindy dla backendowych usług albo ograniczyć je do loopbacka tam, gdzie administracja lokalna jest rzeczywiście potrzebna.

Docelowo:

- PostgreSQL — tylko internal Docker network;
- Redis — tylko internal Docker network;
- MinIO API/console — tylko internal/private/admin path;
- publicznie wystawione wyłącznie kontrolowane endpointy reverse proxy/API/PWA.

### P1-B.2 — reverse proxy i TLS

Wybrać i opisać jedną produkcyjną ścieżkę, np. Caddy/Nginx/Traefik + Cloudflare albo równoważną architekturę.

Docelowy model:

```text
Internet
  -> TLS / reverse proxy
     -> PWA
     -> WastePL API
        -> internal Docker network
           -> PostgreSQL
           -> Redis
           -> MinIO
           -> worker
```

### P1-B.3 — konkretny deployment PWA

Obecny production compose nie wdraża `apps/pwa`.

Wybrać i wdrożyć jedną ścieżkę:

- statyczny build serwowany przez reverse proxy/container;
- Cloudflare Pages;
- inny jawnie zaakceptowany hosting statyczny.

Wymagane:

- spójny `VITE_API_BASE_URL`/config runtime;
- service worker działający pod docelową domeną;
- poprawne cache headers;
- poprawny fallback SPA;
- HTTPS wymagany dla Web Push/PWA.

### P1-B.4 — realny staging z domeną

Uruchomić odseparowany staging z prawdziwą domeną/subdomeną, TLS i środowiskowymi sekretami.

Staging ma używać realnej topologii podobnej do produkcji, a nie tylko lokalnego `docker compose`.

### P1-B.5 — off-site backup

Lokalny `pg_dump` z SHA-256 pozostaje potrzebny, ale kopia na tym samym VPS nie jest wystarczającym DR.

Dodać:

- automatyczny backup off-site do niezależnego storage;
- retencję;
- szyfrowanie lub bezpieczne zarządzanie dostępem;
- regularny test restore;
- alert przy braku poprawnego backupu.

### P1-B.6 — security automation

Dodać:

- CodeQL lub równoważny SAST;
- dependency audit w CI;
- Dependabot/Renovate lub inną automatyzację aktualizacji zależności;
- secret scanning w dostępnej formie;
- pinning krytycznych GitHub Actions do pełnych SHA tam, gdzie uzasadnione;
- przegląd nagłówków bezpieczeństwa po wdrożeniu reverse proxy.

### P1-B.7 — monitoring i alerting na realnym stagingu

Obecne structured logs i health endpointy są fundamentem.

Dodać realne obserwacje:

- uptime API/PWA;
- DB health;
- queue backlog/failures;
- worker heartbeat;
- live-source failures/drift;
- push dispatch failures;
- backup failures;
- 5xx/error rate;
- podstawowe latency p50/p95;
- alert channel i procedurę incident response.

**DoD bramki P1-B:** istnieje działający staging end-to-end pod HTTPS, backendowe porty nie są publicznie wystawione bez potrzeby, PWA jest wdrażana jawnie, backup ma kopię off-site i restore test, a monitoring potrafi wygenerować użyteczny alert.

## 7. Bramka P1-C — zwiększanie address coverage obecnych 8 gmin

To jest główny bottleneck wartości użytkowej.

### Stan Census v2

| Gmina | Wszystkie PRG | Supported | Unsupported | Ambiguous | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: |
| Koszalin | 10 240 | 9 | 10 231 | 0 | **0,09%** |
| Manowo | 1 210 | 46 | 1 164 | 0 | **3,80%** |
| Bobolice | 2 080 | 65 | 2 015 | 0 | **3,13%** |
| Świeszyno | 2 430 | 167 | 2 263 | 0 | **6,87%** |
| Tychowo | 1 450 | 45 | 1 405 | 0 | **3,10%** |
| Sianów | 3 520 | 31 | 3 489 | 0 | **0,88%** |
| Polanów | 1 810 | 39 | 1 771 | 0 | **2,15%** |
| Będzino | 2 290 | 13 | 2 277 | 0 | **0,57%** |
| **RAZEM** | **25 030** | **415** | **24 615** | **0** | **1,66%** |

Pełny raport: `docs/reports/address-coverage-census.md`.

### P1-C.1 — model priorytetyzacji źródeł

Każdy kandydat do onboardingu powinien mieć score oparty co najmniej o:

`odblokowane adresy / (czas wdrożenia + maintenance risk)`

W praktyce score powinien uwzględniać także:

- liczbę adresów PRG możliwych do odblokowania;
- reuse istniejącego adaptera;
- stabilność upstreamu;
- przewidywaną częstotliwość zmian;
- ryzyko OCR/image-only/mixed media;
- trudność mapowania service area;
- ryzyko ambiguous/wrong-date;
- szacowany miesięczny maintenance effort.

### P1-C.2 — Koszalin jako pierwszy kandydat o największym potencjale

Koszalin ma 10 240 adresów PRG i tylko 9 supported.

Pierwszy cel:

- znaleźć pełne miejskie źródła PGK/operatora;
- zmapować rejony/trasy/frakcje bez zgadywania;
- odblokować możliwie duży procent miasta jednym lub małą liczbą stabilnych adapterów;
- utrzymać ambiguity <1% i zero znanych wrong-date mismatches w próbie audytowej.

Koszalin ma pierwszy priorytet ze względu na potencjał odblokowania największej liczby adresów, ale po każdej analizie score należy przeliczać.

### P1-C.3 — następne źródła według ROI, nie sztywnej kolejności

Wstępni kandydaci:

- Sianów — rozbicie ogólnej semantyki odpadów segregowanych i miasto/pozostałe trasy;
- Będzino — Trasa II, osłony śmietnikowe, difficult access;
- Świeszyno — Trasy II i III;
- Bobolice — pozostałe arkusze/rewiry operatora;
- Tychowo — miasto i hard-to-reach;
- Polanów — kolejne sołectwa i miasto;
- Manowo — Trasa I i pozostałe zakresy.

Nie utrwalać tej kolejności, jeśli kolejny census/source discovery pokaże lepszy stosunek odblokowanych adresów do kosztu i ryzyka.

### P1-C.4 — target coverage

Cel przed skalowaniem poza ósemkę:

- **>=90–95% address coverage** całego regionu pilota lub jawnie zaakceptowane wyjątki;
- ambiguity <1%;
- unsupported scopes jawnie sklasyfikowane;
- zero krytycznych nierozstrzygniętych wrong-date/fraction mismatches w audytowanej próbie;
- regularny live-source health monitoring.

Nie wymuszać 100% za wszelką cenę, jeżeli ostatnie procenty mają nieproporcjonalnie wysoki koszt lub ryzyko błędnego harmonogramu.

## 8. P2 — kontrolowany real-user pilot

Nie czekać z każdym testem użytkownika do osiągnięcia 95% całego regionu, ale nie zapraszać użytkowników spoza bezpiecznie obsługiwanych zakresów bez jasnej informacji o ograniczeniach.

### P2.1 — bramka wejścia dla kontrolowanej kohorty

Kontrolowany pilot może ruszyć, gdy:

- P0 jest zamknięte;
- P1-A i P1-B są zamknięte;
- wybrana kohorta testowa ma **>=95% coverage swoich zapraszanych adresów** albo użytkownicy są rekrutowani wyłącznie z jednoznacznie supported scopes;
- live-source soak jest aktualnie zielony;
- feedback mieszkańca działa;
- monitoring i rollback są gotowe.

To pozwala zbierać feedback wcześniej bez udawania, że cały region jest już obsługiwany.

### P2.2 — telemetry funnel

Mierzyć:

`app open -> address search -> address selected -> schedule shown -> reminder/calendar enabled -> return visit`

KPI produktowe:

- address search success rate;
- unsupported rate;
- ambiguous rate;
- time-to-first-schedule;
- schedule load success;
- `.ics` activation;
- Web Push opt-in;
- repeat usage / retention;
- feedback confirmation rate;
- wrong-date reports;
- missing-fraction reports;
- source freshness widziany przez użytkownika.

### P2.3 — feedback mieszkańców

Aktualnie **ZAIMPLEMENTOWANE**:

- `ScheduleFeedbackModal`;
- potwierdzenie poprawności harmonogramu;
- zgłoszenia `WRONG_DATE`, `MISSING_FRACTION`, `OTHER`;
- endpoint `/v1/feedback/schedule-discrepancy`;
- migracja `0018_feedback.sql`;
- test E2E `TC-2.5`.

Pozostaje potwierdzenie tego flow w aktualnym pełnym CI oraz później analiza rzeczywistych zgłoszeń z pilota.

## 9. P2 — unit economics i operacje

Machine-readable onboarding metrics pozostają źródłem danych, ale przed skalowaniem trzeba zebrać realne koszty operacyjne.

Mierzyć osobno:

- discovery;
- source analysis;
- adapter/config;
- parser implementation;
- service-area mapping;
- tests;
- review;
- deployment;
- repeat update;
- source drift incident;
- manual review;
- miesięczny maintenance.

Kluczowe wskaźniki:

- human-active onboarding time per source;
- human-active onboarding time per municipality;
- monthly maintenance/source-ops cost;
- adapter reuse rate;
- repeat-update automation rate;
- incidents per active source/month;
- drift detection rate;
- MTTR;
- false-positive review rate;
- koszt na 1000 supported addresses.

Obecna próbka nadal jest za mała do wiarygodnej ekstrapolacji na cały kraj.

## 10. P3 — decyzja o rozszerzeniu do kolejnych 20–50 gmin

Nie skalować geograficznie tylko dlatego, że technicznie można dodać kolejny adapter.

Bramka przed falą 20–50 gmin:

- branch protection i required CI działają;
- każdy `main` commit jest weryfikowany;
- live-source monitoring jest regularny;
- obecne 8 gmin osiąga uzgodnione >=90–95% coverage lub ma jawnie zaakceptowane wyjątki;
- ambiguity pozostaje <1%;
- PWA przechodzi real offline/stale/error E2E, a11y i Lighthouse;
- staging/production deployment jest sprawdzony;
- off-site backup i restore test działają;
- monitoring i incident response działają;
- real-user pilot dostarczył wiarygodne KPI;
- znany jest realny miesięczny koszt utrzymania;
- jest więcej niż symboliczna próbka repeat-update automation;
- brak krytycznych nierozstrzygniętych wrong-date mismatches.

Preferować klastry geograficzne/operatorowe i formatowe, które maksymalizują adapter reuse oraz obniżają marginalny koszt każdej kolejnej gminy.

## 11. Metryki sterujące decyzjami

- **Municipality source presence** — gminy z >=1 aktywnym zakresem.
- **Address coverage** — udział oficjalnych adresów PRG z jednoznacznym harmonogramem.
- **Unsupported rate** — udział adresów bez bezpiecznie dostępnego harmonogramu.
- **Correctness** — zgodność dat/frakcji z aktualnym źródłem w audytowanej próbie.
- **Ambiguity** — udział adresów, których system nie może bezpiecznie rozstrzygnąć.
- **Provenance completeness** — kompletność source/artifact/parser evidence.
- **Freshness** — czas od zmiany upstreamu do bezpiecznej publikacji.
- **Source health** — fetch/parse success i drift.
- **Operations** — review, incidents, MTTR i false positives.
- **Unit economics** — human-active onboarding i maintenance per source/municipality.
- **Cost per supported addresses** — koszt operacyjny odniesiony do realnie odblokowanej populacji adresów.
- **Adapter reuse** — udział aktywacji bez tworzenia całkiem nowego adaptera.
- **Repeat-update automation** — udział kolejnych aktualizacji bez interwencji człowieka.
- **User value** — successful address lookup, schedule shown, reminder/calendar activation i repeat usage.
- **Resident-reported correctness** — udział potwierdzeń poprawności i zgłoszonych rozbieżności.

## 12. Czego teraz nie robić

- nie budować dużych nowych modułów przed rozwiązaniem P0/P1;
- nie dodawać kolejnych gmin dla samego wzrostu licznika;
- nie traktować `8/8` jako 100% address coverage;
- nie wpisywać „PASS” dla HEAD, którego CI faktycznie nie uruchomiono;
- nie zgadywać liczby testów po zmianie suite;
- nie udawać realnego offline przez sam `window.dispatchEvent(new Event('offline'))`;
- nie traktować local DB backup na tym samym VPS jako pełnego DR;
- nie wystawiać PostgreSQL/Redis/MinIO publicznie bez konkretnej potrzeby;
- nie zgadywać route/building/fraction/coordinate semantics;
- nie traktować fixture CI jako substytutu realnego live soaka;
- nie budować kont użytkowników bez uzasadnionej potrzeby produktowej;
- nie skalować krajowo przed dowodem unit economics i source operations;
- nie dodawać funkcji, które nie zwiększają coverage/correctness, nie obniżają kosztu utrzymania ani nie poprawiają realnego UX mieszkańca.

## 13. Kolejność wykonawcza

Kolejność bazowa:

1. **P0:** pełny CI aktualnego HEAD;
2. **P0:** CI na push do `main`;
3. **P0:** branch protection / required CI / blokada direct push;
4. **P0:** naprawa `current-status.md` i wiarygodnej liczby testów;
5. **P0:** zamknięcie stale `#101`;
6. **P1-A:** real offline + cold-start + stale + network failure tests;
7. **P1-A:** Lighthouse CI + potwierdzenie feedback flow w pełnym CI;
8. **P1-B:** zamknięcie publicznych portów backendowych;
9. **P1-B:** reverse proxy + TLS + deployment PWA;
10. **P1-B:** real staging z domeną;
11. **P1-B:** off-site backup + restore test;
12. **P1-B:** CodeQL/dependency audit/update automation/secret scanning/action pinning;
13. **P1-B:** monitoring + alerting na realnym stagingu;
14. **P1-C, równolegle po P0:** zwiększanie address coverage według ROI;
15. **P1-C:** najpierw zweryfikować pełny potencjał Koszalina, następnie dynamicznie wybierać Sianów/Będzino/pozostałe zakresy według score;
16. **P2:** kontrolowany pilot na bezpiecznie obsługiwanej kohorcie;
17. **P2:** telemetry + real feedback + unit economics;
18. **P1-C/P2:** domknięcie pełnego regionu do >=90–95% coverage lub zaakceptowanych wyjątków;
19. **P3:** decyzja o kolejnych 20–50 gminach na podstawie danych, nie intuicji.

## 14. Najważniejsza bramka biznesowo-techniczna

WastePL ma udowodnić trzy rzeczy przed agresywnym skalowaniem:

1. **Coverage:** potrafimy przejść z 1,66% do >=90–95% bez ręcznej, nieutrzymywalnej pracy dla każdego adresu i każdej gminy.
2. **Economics:** znamy realny koszt onboardingu oraz miesięcznego utrzymania źródła/gminy i koszt ten maleje wraz z reuse adapterów.
3. **User value:** mieszkańcy rzeczywiście znajdują swój adres, ufają harmonogramowi, aktywują przypomnienia i wracają do aplikacji.

Jeżeli te trzy warunki się potwierdzą, obecny fundament techniczny jest wystarczająco mocny, aby przejść z regionalnego pilota do skalowania WastePL jako krajowej warstwy danych i produktu dla mieszkańców.