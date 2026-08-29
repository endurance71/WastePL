# Bieżący status WastePL

> Zweryfikowano: 2026-08-29, commit `8cd0922d39594c6a7733c005e501c72d4921bd2a` (PR `#74`). Pełny CI #145 (`33252332977`) przeszedł docs/contracts, migracje, build/typecheck, wszystkie testy, readiness, fixture-independent production gate, Sianów i Tychowo PSZOK worker/API post-gates, real-100 consumer gate, Tychowo collection 45/45 i API smoke. Merge policy wymaga dodatkowo zielonego CI na finalnym headzie dokumentacyjnym.

## Etap

Sprinty 01–04 dostarczyły produkcyjnie utwardzony Data Platform PoC: Source Registry, immutable artifacts, scheduler/outbox, BullMQ runtime, deterministyczne parsery, transakcyjne publikowanie harmonogramów, temporalną historię, facilities reconciliation, bundle coordination, oficjalny TERYT/PRG backbone, source-ops API i fixture-independent production gates.

Sprint 05 rozszerza rzeczywiste coverage i mierzy koszt onboardingu. `#64` dało clean production consumer gate na dokładnie 100 realnych adresach GUGiK PRG. `#65` dodało machine-readable onboarding economics. Rollouty `2026.4` i `2026.5` dostarczają dwa kolejne PSZOK-i z obowiązkowymi rekordami `PROSPECTIVE`: Sianów i Tychowo.

WastePL nadal nie jest kompletnym produktem konsumenckim dla wszystkich ośmiu gmin. Brak danych jest traktowany jako brak pokrycia, nigdy jako powód do zgadywania harmonogramu.

## Stan pilota po rollout `2026.5`

| Miara | Stan | Interpretacja |
| --- | ---: | --- |
| Gminy w manifeście | 8 | Docelowy zakres pilota. |
| Gminy z jakimkolwiek aktywnym typem danych | 6 z 8 | Koszalin, Manowo, Bobolice, Świeszyno, Tychowo, Sianów. |
| Gminy z aktywnym harmonogramem | 3 z 8 | Koszalin, Manowo i bezpieczny subset Tychowa. |
| Gminy z aktywnym PSZOK | 5 z 8 | Koszalin, Bobolice, Świeszyno, Sianów, Tychowo. |
| Źródła ACTIVE | 9 | Nowym ACTIVE w `2026.5` jest wyłącznie `tychowo-pszok`. |
| Źródła PLANNED | 8 | Jawne blockery; brak silent fallback. |
| Real-address collection gate | 100/100 | 100% consumer API correctness. |
| Krytyczne schedule/date mismatches | 0 | Tolerancja = 0. |
| Ambiguous responses | 0 | Brak cichego rozstrzygania. |
| Golden facilities | 8/8 | 100% istniejącego clean-runtime facility packa. |
| Sianów PSZOK public API post-gate | PASS | Canonical facility zwracana przez `/v1/facilities`. |
| Tychowo PSZOK public API post-gate | PASS | Canonical facility zwracana przez `/v1/facilities`. |

Tychowo PSZOK zwiększa PSZOK coverage z 4/8 do 5/8, ale nie zwiększa any-data municipality coverage, bo Tychowo już miało aktywny harmonogram. Collection coverage pozostaje dokładnie 3/8.

## Tychowo PSZOK — rollout `2026.5`

Nowe źródło `tychowo-pszok` korzysta wyłącznie z oficjalnego, bezpośredniego BIP HTML. Parser `municipal-pszok-html` został rozszerzony do `0.3.0` o jawny profil Tychowa.

Canonical facility:

- key: `pl-3201043-pszok-tychowo-dolna-8`;
- adres źródłowy: `ul. Dolna 8, Tychowo`;
- godziny: wtorek, czwartek i sobota 08:00–14:30;
- materiały: bezpieczny canonical subset `PAPER`, `GLASS`, `BIO`, `BATTERIES`, `ELECTRONICS`, `BULKY`, `TYRES`, `CONSTRUCTION`;
- `location=null` — brak trusted coordinates w primary source;
- `access.scope=UNKNOWN`, `requiresProof=null`, operator `null` — primary BIP HTML nie publikuje tych reguł;
- `access.sourceKey=null` i `access_source_artifact_id=null` — brak fałszywego provenance dla nieopublikowanej reguły dostępu;
- wording o tworzywach nie jest cicho rozszerzany do `METALS_PLASTICS`.

Powiązany regulamin był użyty wyłącznie jako materiał research/corroboration. Nie jest mieszany do canonical single-artifact provenance.

CI #145 potwierdził na clean production DB:

- sync `pilot-koszalin-region@2026.5` z 9 ACTIVE sources;
- immutable artifact → production dispatcher → `municipal-pszok-html@0.3.0` → canonical facility;
- first import `PUBLISHED`;
- replay `PUBLISHED` i brak duplikacji;
- source-backed provenance bez access provenance dla `UNKNOWN`;
- source health `HEALTHY`;
- public `/v1/facilities?terc=3201043&kind=PSZOK` zwraca poprawny facility contract;
- standard collection Tychowa pozostaje ACTIVE, a difficult-address child pozostaje PLANNED z blockerem `EXPLICIT_ADDRESS_REFERENCE_GATE_NOT_YET_COMPLETE`.

## Sianów PSZOK — rollout `2026.4`

Źródło `sianow-pszok` nadal korzysta z oficjalnej bezpośredniej strony Gminy i Miasta Sianów. Po wspólnym rozszerzeniu parser family jego bieżący runtime provenance wskazuje `municipal-pszok-html@0.3.0`; canonical semantics Sianowa nie zostały zmienione.

Canonical facility:

- key: `pl-3209073-pszok-sianow-lubuszan-80`;
- adres: `ul. Łubuszan 80, Sianów`;
- operator: Przedsiębiorstwo Gospodarki Komunalnej Sp. z o.o. w Koszalinie;
- godziny: poniedziałek 08:00–16:00, czwartek 08:00–16:00, sobota 08:00–14:00;
- access: `MUNICIPALITY_RESIDENTS`, `requiresProof=true`;
- geometry: `null`;
- materiały ograniczone do source-backed canonical subset.

CI #145 ponownie potwierdził Sianów worker first import + replay + provenance oraz public API post-gate. Harmonogram Sianowa pozostaje `PLANNED` z blockerem `GENERIC_SEGREGATED_COLUMN_NOT_CANONICALLY_MAPPED`.

## Realny golden pack 100 adresów

Frozen evidence znajduje się w `apps/worker/test/fixtures/reference/prg-pilot-real-100-20260828.json` i nie wymaga internetu w PR CI.

Rozkład:

- Koszalin: 9/9;
- Manowo: 46/46;
- Tychowo: 45/45;
- łącznie: 100/100.

Każdy liczony przypadek ma realny identyfikator `prg-adresy.*`. Production gate odrzuca syntetyczne `wastepl-gate-*`. `Bogusława II 1-3` pozostaje source-only support row z `prg_id=NULL` i nie jest liczony do 100 realnych punktów PRG.

CI #145: collection correctness `1.0` przy wymaganym minimum `0.99`, critical schedule/date mismatches = `0`, facilities = `8/8`; osobny Tychowo post-gate ponownie potwierdził 45/45 deterministycznych adresów PRG.

## Tychowo collection

Realny PRG ujawnił różnicę źródłową `Pobądź` vs oficjalne PRG/TERYT `Pobądz`, SIMC `0313704`. Parser `municipal-collection-pdf-text@0.1.1` obsługuje jeden jawny alias `Pobądź -> Pobądz`; nie używa fuzzy matching.

Aktywny standard subset Tychowa ma 3 service areas i 45/45 realnych przypadków rozwiązuje się do dokładnie jednego service area. Miasto Tychowo i hard-to-reach properties pozostają poza aktywnym zakresem do czasu jednoznacznego modelu źródłowego. Dodanie PSZOK nie zmieniło tych reguł.

## Onboarding economics `#65`

Źródłem prawdy pozostają:

- `schemas/onboarding-metrics-v0.1.schema.json`;
- `metrics/onboarding/pilot-koszalin-region-v0.1.json`;
- `metrics/onboarding/pilot-koszalin-region-summary-v0.1.json`;
- `scripts/check-onboarding-metrics.mjs` w `contracts:check`.

Po `2026.5` baseline obejmuje 8 rekordów aktywacji, w tym dwa `PROSPECTIVE`.

| Miara | Wynik |
| --- | ---: |
| Activation records | 8 |
| Prospective records | 2 |
| First-import manual intervention | 1/8 = 12,5% |
| Repeat-update automation | 3/3 = 100% |
| Adapter reuse inny niż `NEW_ADAPTER` | 3/8 = 37,5% |
| Human-effort phases measured | 12/48 = 25% |
| Fully measured records wg kontraktu | 2 |
| Sianów PSZOK | 17 min zamkniętych timerów; measured lower bound |
| Tychowo PSZOK | 26 min; wszystkie sześć interwałów jawnie zamknięte |

Tychowo PSZOK ma pełny prospektywny pomiar:

- discovery 1 min;
- source assessment 1 min;
- parser implementation 2 min;
- regression fixture/runtime 2 min;
- address/service-area determination 0 min (17 sekund; PSZOK nie tworzy collection rules);
- review/rollout 20 min;
- razem **26 human-active minutes**.

CI queue/runtime nie jest liczony do human effort. Historycznych minut nadal nie rekonstruujemy z commitów, PR ani długości sesji. Sianów pozostaje uczciwie opisany jako 17-minutowy lower bound z powodu jednego niezamkniętego historycznie interwału; Tychowo jest pierwszym rekordem bez tej luki.

Kontrakt `#65` w CI #145 raportuje: 9 ACTIVE sources pokrytych przez 8 activation records, first-import manual intervention `1/8`, repeat automation `3/3`, human effort coverage `12/48`.

## Live-source staging/drift gate `#60`

PR `#72` został scalony do `main` jako `0d85caa3b37dfdbc139e8080e721c5b707a9535d` i usunął hardcoded manifest `2026.2`. Gate wybiera najnowszy `pilot-koszalin-region-*`, sortuje wersje numerycznie i korzysta z frozen real-100 PRG backbone.

W `2026.5` policy test potwierdza, że najnowszy manifest ma 9 ACTIVE sources i obejmuje `tychowo-collection-standard-2026`, `sianow-pszok` oraz `tychowo-pszok`. Facility sources wymagają canonical evidence, a ukończony bundle nie pozostaje fałszywie w `WAITING_FOR_COMPANION`.

**Ważne:** deterministyczne CI potwierdza mechanizm, ale nie zastępuje rzeczywistego soaka. `#60` pozostaje otwarte, dopóki z aktualnego `main` nie zostanie wykonany i ręcznie przejrzany `workflow_dispatch` przeciw publicznym upstreamom. Dostępny w tej sesji konektor GitHub nie udostępnia operacji `workflow_dispatch`, więc run nie jest pozorowany ani zastępowany fixture CI.

## Production runtime i provenance

W runtime są zarejestrowane m.in.:

- `pgk-koszalin-pdf-text`;
- `municipal-collection-pdf-text`;
- `pgk-koszalin-pszok-html`;
- `municipal-pszok-html@0.3.0`.

Harmonogramy i facilities zachowują artifact UUID, SHA-256, parser key/version i source provenance. Publikacje są transakcyjne, replay idempotentny, collection history jest temporalna, a Koszalin PSZOK używa bundle `main + faq` z last-known-good semantics.

`ARTIFACT_PROCESSING_ENABLED` pozostaje deploymentowo opt-in.

## Pozostałe NO-GO / blockery

- Sianów collection: generic `odpady segregowane` nie ma bezpiecznego canonical splitu;
- Będzino: route I/II, OSŁONY i trudnodostępne nie mają jeszcze deterministycznej relacji route/address;
- Świeszyno schedule: legacy child host wymaga stabilnego artifact capture;
- Bobolice collection: mixed image/attachment H2 wymaga deterministycznego child adaptera;
- Polanów: current H2 child set nie jest jeszcze kanonicznie enumerowany;
- Tychowo city i hard-to-reach: nadal poza safe collection subsetem;
- ogólnopolski produkcyjny feed punktów systemu kaucyjnego nie jest ustalony.

## Najbliższa kolejność

1. Wykonać i ręcznie przejrzeć `live-source-staging` z aktualnego `main`, gdy dostępne będzie wywołanie `workflow_dispatch`; dopiero wtedy domknąć `#60`.
2. Przenieść priorytet z kolejnych prostych PSZOK-ów na wzrost collection coverage ponad 3/8 — najpierw tam, gdzie da się deterministycznie domknąć child artifacts i service-area mapping.
3. Zachować prospektywne timery dla każdej następnej aktywacji i mierzyć realny repeat update po zmianie upstreamu.
4. PWA `#51` rozpocząć dopiero po spełnieniu live-soak start gate i przy zachowaniu obecnych data-quality gates.

## Stan decyzji

**Data Platform PoC: GO.**

**Automatyczna publikacja dla wspieranych źródeł: GO pod istniejącymi gate'ami.**

**Rollout `2026.5`: pełny code/runtime gate PASS w CI #145; merge policy wymaga zielonego CI również na finalnym headzie dokumentacyjnym.**

**Collection coverage: 3/8 — bez sztucznego zaliczania facility activation jako harmonogramu.**

**PSZOK coverage: 5/8.**

**#65: dwa PROSPECTIVE records; drugi ma wszystkie sześć faz jawnie zamknięte, a machine-readable targety first-import/repeat-update są spełnione.**

**#60: mechanizm śledzi najnowszy manifest, teraz 9 ACTIVE; rzeczywisty live soak nadal PENDING.**

**Zewnętrzny szeroki pilot konsumencki: NO-GO**, dopóki nie zostanie wykonany aktualny live-source soak i nie wzrośnie deterministyczne collection coverage.
