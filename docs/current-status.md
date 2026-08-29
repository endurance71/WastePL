# Bieżący status WastePL

> Zweryfikowano: 2026-08-29, commit `b789a66e01a69f2b1b4182c8c2a47fe72e8f0c54` (PR `#73`). Pełny CI #140 (`33250528439`) przeszedł docs/contracts, migracje, build/typecheck, wszystkie testy, readiness, fixture-independent production gate, Sianów PSZOK worker/API post-gates, real-100 consumer gate, Tychowo 45/45 i API smoke. Bieżąca zmiana tego dokumentu nie zmienia runtime i podlega finalnemu rerunowi przed merge.

## Etap

Sprinty 01–04 dostarczyły produkcyjnie utwardzony Data Platform PoC: Source Registry, immutable artifacts, scheduler/outbox, BullMQ runtime, deterministyczne parsery, transakcyjne publikowanie harmonogramów, temporalną historię, facilities reconciliation, bundle coordination, oficjalny TERYT/PRG backbone, source-ops API i fixture-independent production gates.

Sprint 05 rozszerza rzeczywiste coverage i mierzy koszt onboardingu. `#64` dało clean production consumer gate na dokładnie 100 realnych adresach GUGiK PRG. `#65` dodało machine-readable onboarding economics. PR `#73` dostarcza pierwszy post-`2026.3` rollout z obowiązkowym rekordem `PROSPECTIVE`: PSZOK Sianów.

WastePL nadal nie jest kompletnym produktem konsumenckim dla wszystkich ośmiu gmin. Brak danych jest traktowany jako brak pokrycia, nigdy jako powód do zgadywania harmonogramu.

## Stan pilota po rollout `2026.4`

| Miara | Stan | Interpretacja |
| --- | ---: | --- |
| Gminy w manifeście | 8 | Docelowy zakres pilota. |
| Gminy z jakimkolwiek aktywnym typem danych | 6 z 8 | Koszalin, Manowo, Bobolice, Świeszyno, Tychowo, Sianów. |
| Gminy z aktywnym harmonogramem | 3 z 8 | Koszalin, Manowo i bezpieczny subset Tychowa. Sianów collection nadal PLANNED. |
| Gminy z aktywnym PSZOK | 4 z 8 | Koszalin, Bobolice, Świeszyno, Sianów. |
| Źródła ACTIVE | 8 | Nowym ACTIVE w `2026.4` jest wyłącznie `sianow-pszok`. |
| Źródła PLANNED | 8 | Jawne blockery; brak silent fallback. |
| Real-address collection gate | 100/100 | 100% consumer API correctness. |
| Krytyczne schedule/date mismatches | 0 | Tolerancja = 0. |
| Ambiguous responses | 0 | Brak cichego rozstrzygania. |
| Golden facilities | 8/8 | 100% istniejącego clean-runtime facility packa. |
| Sianów PSZOK public API post-gate | PASS | Nowa canonical facility widoczna przez `/v1/facilities`. |

## Sianów PSZOK — rollout `2026.4`

Nowe źródło `sianow-pszok` korzysta z oficjalnej bezpośredniej strony Gminy i Miasta Sianów. Parser `municipal-pszok-html` został rozszerzony do `0.2.0` o jawny profil źródła, bez heurystycznego dopasowania obcych gmin.

Canonical facility:

- key: `pl-3209073-pszok-sianow-lubuszan-80`;
- adres źródłowy: `ul. Łubuszan 80, Sianów`;
- operator: Przedsiębiorstwo Gospodarki Komunalnej Sp. z o.o. w Koszalinie;
- godziny: poniedziałek 08:00–16:00, czwartek 08:00–16:00, sobota 08:00–14:00;
- access: `MUNICIPALITY_RESIDENTS`, `requiresProof=true`;
- geometry: `null` — źródło nie publikuje trusted coordinates, więc WastePL ich nie zgaduje;
- materiały są ograniczone do source-backed canonical subset.

CI #140 potwierdził na clean production DB:

- sync `pilot-koszalin-region@2026.4` z 8 ACTIVE sources;
- immutable artifact → production dispatcher → `municipal-pszok-html@0.2.0` → canonical facility;
- first import `PUBLISHED`;
- replay `PUBLISHED` i brak duplikacji;
- provenance assertions do dokładnego source artifact;
- source health `HEALTHY`;
- public `/v1/facilities?terc=3209073&kind=PSZOK` zwraca poprawną facility bez geometrii;
- harmonogram Sianowa pozostaje `PLANNED` z blockerem `GENERIC_SEGREGATED_COLUMN_NOT_CANONICALLY_MAPPED`.

## Realny golden pack 100 adresów

Frozen evidence znajduje się w `apps/worker/test/fixtures/reference/prg-pilot-real-100-20260828.json` i nie wymaga internetu w PR CI.

Rozkład:

- Koszalin: 9/9;
- Manowo: 46/46;
- Tychowo: 45/45;
- łącznie: 100/100.

Każdy liczony przypadek ma realny identyfikator `prg-adresy.*`. Production gate odrzuca syntetyczne `wastepl-gate-*`. `Bogusława II 1-3` pozostaje source-only support row z `prg_id=NULL` i nie jest liczony do 100 realnych punktów PRG.

CI #140: collection correctness `1.0` przy wymaganym minimum `0.99`, critical schedule/date mismatches = `0`, ambiguous responses = `0`, facilities = `8/8`.

## Tychowo

Realny PRG ujawnił różnicę źródłową `Pobądź` vs oficjalne PRG/TERYT `Pobądz`, SIMC `0313704`. Parser `municipal-collection-pdf-text@0.1.1` obsługuje jeden jawny alias `Pobądź -> Pobądz`; nie używa fuzzy matching.

Aktywny standard subset Tychowa ma 3 service areas i 45/45 realnych przypadków rozwiązuje się do dokładnie jednego service area. CI #140 ponownie potwierdził 45/45. Miasto Tychowo i hard-to-reach properties pozostają poza aktywnym zakresem do czasu jednoznacznego modelu źródłowego.

## Onboarding economics `#65`

Źródłem prawdy pozostają:

- `schemas/onboarding-metrics-v0.1.schema.json`;
- `metrics/onboarding/pilot-koszalin-region-v0.1.json`;
- `metrics/onboarding/pilot-koszalin-region-summary-v0.1.json`;
- `scripts/check-onboarding-metrics.mjs` w `contracts:check`.

Po `2026.4` baseline obejmuje 7 rekordów aktywacji. Sianów PSZOK jest pierwszym rekordem `PROSPECTIVE` i ma sześć wymaganych faz z timer evidence.

| Miara | Wynik |
| --- | ---: |
| Activation records | 7 |
| Prospective records | 1 |
| First-import manual intervention | 1/7 = 14,29% |
| Repeat-update automation | 3/3 = 100% |
| Adapter reuse inny niż `NEW_ADAPTER` | 2/7 = 28,57% |
| Human-effort phases measured | 6/42 |
| Fully measured records wg kontraktu | 1 |
| Zamknięte, audytowalne minuty Sianów PSZOK | 17 min |

Sianów jest sklasyfikowany jako `EXTENDED_EXISTING`: wykorzystuje istniejący artifact store, runtime, handler class, publisher i parser family, ale wymaga jawnego profilu source-key-specific.

17 minut to suma wyłącznie zamkniętych timer intervals. Jeden wcześniejszy follow-up interval rozpoczęto przed przerwaniem sesji bez zapisanego end boundary; nie jest rekonstruowany z timestampów Git ani imputowany. Dlatego 17 min jest **audytowalnym measured lower bound**, a nie sztucznie precyzyjną deklaracją pełnego czasu aktywnego. Historyczne rekordy nadal pozostają `UNKNOWN`.

`#65` pozostaje otwarte: pierwszy prospektywny rekord już istnieje i przechodzi contract gate, ale do mocnego wniosku o realnym koszcie onboardingu potrzebny jest co najmniej kolejny całkowicie zamknięty pomiar bez przerwanego interwału oraz większa próbka source shapes.

## Live-source staging/drift gate `#60`

PR `#72` został scalony do `main` jako `0d85caa3b37dfdbc139e8080e721c5b707a9535d` i usunął hardcoded manifest `2026.2`. Gate wybiera najnowszy `pilot-koszalin-region-*`, sortuje wersje numerycznie i korzysta z frozen real-100 PRG backbone.

W `2026.4` policy test potwierdza, że najnowszy manifest ma 8 ACTIVE sources i zawiera zarówno `tychowo-collection-standard-2026`, jak i `sianow-pszok`. Facility sources wymagają canonical evidence, a ukończony bundle nie pozostaje fałszywie w `WAITING_FOR_COMPANION`.

**Ważne:** deterministyczne CI potwierdza mechanizm, ale nie zastępuje rzeczywistego soaka. `#60` pozostaje otwarte, dopóki z aktualnego `main` nie zostanie wykonany i ręcznie przejrzany `workflow_dispatch` przeciw publicznym upstreamom. Workflow używa izolowanej bazy/bucketu i nie zapisuje danych produkcyjnych.

## Production runtime i provenance

W runtime są zarejestrowane m.in.:

- `pgk-koszalin-pdf-text`;
- `municipal-collection-pdf-text`;
- `pgk-koszalin-pszok-html`;
- `municipal-pszok-html`.

Harmonogramy i facilities zachowują artifact UUID, SHA-256, parser key/version i source provenance. Publikacje są transakcyjne, replay idempotentny, collection history jest temporalna, a Koszalin PSZOK używa bundle `main + faq` z last-known-good semantics.

`ARTIFACT_PROCESSING_ENABLED` pozostaje deploymentowo opt-in.

## Pozostałe NO-GO / blockery

- Sianów collection: generic `odpady segregowane` nie ma bezpiecznego canonical splitu;
- Będzino: route I/II, OSŁONY i trudnodostępne nie mają jeszcze deterministycznej relacji route/address;
- Świeszyno schedule: legacy child host wymaga stabilnego artifact capture;
- Bobolice collection: mixed image/attachment H2 wymaga deterministycznego child adaptera;
- Polanów: current H2 child set nie jest jeszcze kanonicznie enumerowany;
- Tychowo city i hard-to-reach: nadal poza safe subsetem;
- ogólnopolski produkcyjny feed punktów systemu kaucyjnego nie jest ustalony.

## Najbliższa kolejność

1. Scalić PR `#73` po finalnym zielonym CI dokumentacyjnego heada.
2. Uruchomić i ręcznie przejrzeć `live-source-staging` z aktualnego `main`; dopiero wtedy domknąć `#60`.
3. Wykonać następną bezpieczną aktywację z całkowicie zamkniętym pomiarem PROSPECTIVE, żeby poszerzyć próbkę `#65`.
4. Kontynuować collection coverage tylko tam, gdzie fraction semantics i service-area mapping są deterministyczne.
5. PWA `#51` rozpocząć dopiero po spełnieniu live-soak start gate i przy zachowaniu obecnych data-quality gates.

## Stan decyzji

**Data Platform PoC: GO.**

**Automatyczna publikacja dla wspieranych źródeł: GO pod istniejącymi gate'ami.**

**Rollout `2026.4`: code/runtime gates PASS; final docs rerun przed merge.**

**Collection coverage: 3/8 — bez sztucznego zaliczania Sianów PSZOK jako harmonogramu.**

**#65: pierwszy PROSPECTIVE record istnieje; 17 min zamkniętych timerów to measured lower bound; issue pozostaje otwarte dla kolejnego pełnego pomiaru.**

**#60: mechanizm śledzi najnowszy manifest, teraz 8 ACTIVE; rzeczywisty live soak nadal PENDING.**

**Zewnętrzny szeroki pilot konsumencki: NO-GO**, dopóki nie zostanie wykonany aktualny live-source soak i nie wzrośnie deterministyczne collection coverage.
