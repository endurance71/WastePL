# WastePL — plan dalszych prac 2026-09-07

> Status bazowy: `main` = `a13b66c726ab8a54fe65d46a0f0929e0330bd85b`, po PR #137. Dokument zastępuje plan operacyjny z 2026-08-29 jako bieżący punkt odniesienia. Starszy dokument pozostaje historycznym snapshotem.

## 1. Punkt startowy

Projekt ma działającą platformę danych, publiczne API, consumer PWA, pipeline ingestion, testy E2E, CodeQL i automatyczny live-source staging. Bieżący regionalny address coverage wynosi **12 816 / 25 030 = 51,20%** oficjalnych punktów PRG. Aktualny census zachowuje **0,00% ambiguity, 0 conflicts i 0 engine errors**.

Na aktualnym HEAD przeszły:

- `ci` run #277 — success;
- `codeql` run #20 — success.

Najnowszy `live-source-staging` run #8 / ID `34021554761` zakończył się sukcesem dla 17/17 ACTIVE sources, ale wykonał się na SHA `04bd1cb13d0e001813e5f7a1c36adce1acfe17bc`, czyli przed późniejszymi rozszerzeniami coverage #133–#137.

Branch `main` pozostaje `protected: false`. Issue #84 dokumentuje, że przy obecnym prywatnym repozytorium i planie GitHub Free natywne wymaganie PR/status checks nie jest dostępne bez zmiany planu lub widoczności repo.

## 2. Cel nadrzędny następnego etapu

Doprowadzić regionalny pilot do stanu, w którym można bezpiecznie uruchomić produkcyjny pilotaż z realnymi mieszkańcami, bez obniżania jakości mapowania adresów.

Warunki wejścia do publicznego pilota:

1. aktualny live-source staging zielony na bieżącym HEAD;
2. address coverage co najmniej **90%**, preferowane **95%+** populacji PRG pilota;
3. brak regresji: ambiguity = 0, conflicts = 0, engine errors = 0;
4. staging produkcyjny pod dedykowaną domeną;
5. działający monitoring, backup/restore i feedback loop;
6. jasna decyzja operacyjna w sprawie branch protection / kontroli kompensacyjnych;
7. minimalny zestaw telemetryczny do mierzenia aktywacji, skuteczności wyszukania adresu i zgłoszeń rozbieżności.

## 3. P0 — działania natychmiastowe

### P0.1 Zweryfikować live-source staging na aktualnym HEAD

**Cel:** usunąć lukę między zielonym runem #8 a obecnym `main`.

Do wykonania:

- uruchomić `live-source-staging` przez `workflow_dispatch` lub poczekać na najbliższy scheduled run;
- potwierdzić, że run używa SHA `a13b66c...` lub nowszego;
- sprawdzić `17/17 ACTIVE sources observed`;
- wymagane: `0 REVIEW_REQUIRED`, `0 critical failures`, `allExpectedObserved = true`;
- zachować i zweryfikować artifact raportu;
- zaktualizować `docs/current-status.md` o run ID, datę i HEAD.

**Definition of Done:** bieżący `main` ma zielony real-network live-source gate.

### P0.2 Branch governance — domknąć #84 decyzją

Dostępne warianty:

**A. GitHub Pro / plan wspierający ochronę prywatnego repo** — rekomendowany, jeśli kod ma pozostać prywatny.

Po odblokowaniu:

- require pull request before merging;
- require status check `ci`;
- blokować merge przy pending/failed CI;
- wyłączyć zwykłe direct push do `main`;
- po stabilizacji wymagać również CodeQL;
- zachować kontrolowany admin override tylko awaryjnie.

**B. Repo publiczne** — tylko jeśli strategia biznesowa dopuszcza ujawnienie całego kodu i know-how.

**C. Pozostanie na obecnym modelu** — tymczasowo, z kontrolami kompensacyjnymi:

- wszystkie zmiany przez branch + PR;
- CI i CodeQL na PR i push;
- squash merge dopiero po zielonych checkach;
- `--frozen-lockfile`;
- GitHub Actions przypięte do pełnych SHA;
- okresowy audyt, czy nie pojawiają się direct pushe.

**Rekomendacja:** wariant A przed wejściem w publiczny pilot.

## 4. P1 — address coverage: główny strumień produktowy

Obecny denominator: **25 030 adresów PRG**.

Obsłużone: **12 816**.

Pozostałe do 100%: **12 214**.

Do 90% potrzeba minimum 22 527 obsłużonych adresów, czyli jeszcze **9 711**.

Do 95% potrzeba minimum 23 779 obsłużonych adresów, czyli jeszcze **10 963**.

### Zasada pracy

Nie rozszerzać scope'u źródła tylko dlatego, że nazwa gminy lub dokument sugeruje szerszy zakres. Każde rozszerzenie musi mieć jednoznaczny dowód mapowania harmonogramu do adresu/miejscowości/trasy.

Nie wolno poprawiać coverage kosztem:

- ambiguity;
- konfliktów między źródłami;
- zgadywania zakresu;
- nadpisywania danych mniej wiarygodnym źródłem;
- utraty provenance.

### Kolejność źródeł

Używać `pnpm census:prioritize` i wybierać zakresy według ROI:

1. wysoka liczba odblokowanych adresów;
2. niski koszt implementacji;
3. niski poziom semantycznego ryzyka;
4. źródło oficjalne i stabilne;
5. możliwość zbudowania deterministycznego test fixture + real PRG reference.

### Proces dla każdej nowej partii coverage

1. pozyskać oficjalne źródło harmonogramu;
2. zapisać immutable/frozen artifact lub referencję zgodnie z obecnym modelem;
3. pozyskać oficjalne punkty PRG/GUGiK;
4. zbudować reference loader/hydration;
5. jawnie opisać semantykę tras/rejonów/miejscowości;
6. dodać testy jednostkowe profilu;
7. uruchomić census;
8. wymagane: 0 ambiguity, 0 conflicts, 0 engine errors;
9. zaktualizować raport census i current status;
10. PR + zielone CI/CodeQL.

## 5. P1 — priorytet gmin

Kolejność powinna być liczona z aktualnego `census:prioritize`, ale operacyjnie należy w pierwszej kolejności atakować gminy z największym pozostałym denominator oraz dostępnymi bezpiecznymi dokumentami trasowymi.

Obszary wymagające dalszego rozszerzania:

- Sianów;
- Świeszyno;
- Będzino;
- Polanów;
- Bobolice;
- pozostałe niepełne zakresy Manowa i Tychowa, jeśli census nadal wskazuje luki.

Koszalin pozostaje wzorcem jakości: 100% address coverage i pełne 5 frakcji.

## 6. P2 — staging produkcyjny

Nie czekać ze stagingiem do 95% coverage. Można prowadzić ten strumień równolegle.

### P2.1 Infrastruktura

Na podstawie istniejącego `docker-compose.prod.yml` i runbooka:

- uruchomić dedykowany staging;
- skonfigurować domenę i TLS;
- oddzielić DB/Redis/object storage od środowiska developerskiego;
- potwierdzić health check i DB ping;
- skonfigurować rotację logów;
- potwierdzić automatyczny backup;
- wykonać realny test restore na osobnej bazie.

### P2.2 Smoke tests po deploy

Automatycznie sprawdzić minimum:

- health endpoint;
- address search;
- schedule lookup dla zestawu golden addresses;
- PSZOK endpoint;
- PWA asset loading;
- service worker registration;
- offline cold start;
- Web Push subscribe/unsubscribe;
- feedback endpoint;
- rate limiting/security headers.

## 7. P2 — pilot użytkowników

Po przekroczeniu sensownego coverage i uruchomieniu staging/production rozpocząć mały pilot zamiast od razu promować produkt szeroko.

### Proponowany rollout

**Etap A — 10–20 osób**

- Koszalin + kilka wspieranych miejscowości z innych gmin;
- ręczna weryfikacja zgłoszeń;
- obserwacja failure modes.

**Etap B — 50–100 osób**

- wszystkie aktywne gminy;
- mierzenie success rate wyszukania adresu;
- analiza push opt-in;
- telemetryka retencji i feedbacku.

**Etap C — publiczny regionalny pilot**

Dopiero po potwierdzeniu jakości danych i stabilności upstreamów.

## 8. Telemetria i KPI

Nie zbierać surowych adresów w analityce, jeśli nie jest to konieczne.

Minimalny zestaw KPI:

- address search success rate;
- unsupported-address rate;
- schedule lookup success rate;
- liczba aktywnych instalacji PWA;
- push permission acceptance rate;
- aktywne push subscriptions;
- liczba discrepancy reports / 1000 lookupów;
- stale-source incidents;
- median source recovery time;
- live-source staging pass rate;
- coverage PRG %;
- średni koszt/roboczogodziny onboardingu kolejnej gminy.

## 9. P3 — przygotowanie do skalowania poza pilot

Nie rozpoczynać masowego onboardingu Polski przed zmierzeniem kosztu utrzymania regionalnego pilota.

Przed skalowaniem przygotować:

- szablony connectorów dla głównych typów źródeł;
- klasyfikację źródeł: HTML/PDF/XLS/API/BIP/vendor;
- automatyczne wykrywanie driftu strukturalnego;
- onboarding scorecard gminy;
- koszt obsługi źródła / miesiąc;
- SLA freshness;
- dashboard source health;
- mechanizm szybkiego quarantine źródła;
- procedurę manual review;
- politykę wersjonowania manifestów.

## 10. Kolejność wykonania

Najbliższa kolejka robocza:

1. **P0:** live-source staging na bieżącym HEAD;
2. **P0:** decyzja GitHub Pro/public/kompensacja dla #84;
3. **P1:** kolejna partia address coverage według `census:prioritize`;
4. **P1:** powtarzać coverage batches aż do >=90%;
5. **P2 równolegle:** uruchomić realny staging i test restore;
6. **P2:** smoke-test suite dla deploy;
7. **P2:** mikro-pilot użytkowników;
8. **P1:** dojść do preferowanego 95%+ coverage;
9. **P2:** regionalny publiczny pilot;
10. **P3:** dopiero po danych z pilota planować skalowanie wojewódzkie/ogólnopolskie.

## 11. Kryterium zatrzymania złej ścieżki

Jeśli nowe źródło wymaga zgadywania semantyki lub generuje ambiguity/conflicts, nie wymuszać jego aktywacji. Oznaczyć zakres jako wymagający dodatkowego dowodu i przejść do kolejnego źródła o wyższym ROI.

WastePL powinien zwrócić `unsupported` zamiast wiarygodnie wyglądającego, ale błędnego harmonogramu.

## 12. Najbliższy checkpoint

Po każdym wzroście coverage o około 5 punktów procentowych lub po istotnej zmianie infrastruktury wykonać pełny checkpoint:

- HEAD i ostatnie PR-y;
- CI + CodeQL;
- live-source staging;
- address census;
- ambiguity/conflicts/errors;
- otwarte issue/PR;
- staging health;
- backup/restore;
- aktualizacja `docs/current-status.md` oraz tego planu, jeśli zmieniają się priorytety.
