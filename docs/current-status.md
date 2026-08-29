# Bieżący status WastePL

> Zweryfikowano: 2026-08-29, commit `e364533e6667ab0d3b8ecd0f02f5819b51516fc5` (pełny CI run `33243809544`, #119, PR `#69`). Końcowa zmiana dokumentacyjna podlega finalnemu rerunowi przed merge.

## Etap

Sprinty 01–04 dostarczyły produkcyjnie utwardzony Data Platform PoC: rejestr źródeł, immutable artifacts, scheduler/outbox, BullMQ runtime, deterministyczne parsery, transakcyjne publikowanie harmonogramów, temporalną historię, facilities reconciliation, bundle coordination, oficjalny TERYT/PRG backbone, source-ops API oraz fixture-independent production gates.

Sprint 05 rozszerza rzeczywiste collection coverage i jakość pilota. PR `#68` został scalony do `main` jako commit `a82677fceffddf6af2287880a6403e57fa4e7f9d` i zamknął `#64`: clean production consumer gate obejmuje dokładnie 100 realnych adresów GUGiK PRG. PR `#69` implementuje warstwę pomiarową `#65`: machine-readable onboarding metrics, adapter reuse, source complexity oraz first-import/repeat-update automation bez rekonstruowania historycznych minut pracy.

WastePL nadal nie jest kompletnym produktem konsumenckim dla wszystkich ośmiu gmin. Brak danych jest traktowany jako brak pokrycia, a nie jako powód do zgadywania harmonogramu.

## Stan pilota po rollout `2026.3`

| Miara | Stan | Interpretacja |
| --- | ---: | --- |
| Gminy w manifeście | 8 | Docelowy zakres fali pilotażowej. |
| Gminy z jakimkolwiek aktywnym typem danych | 5 z 8 | Koszalin, Manowo, Bobolice, Świeszyno i Tychowo. |
| Gminy z aktywnym harmonogramem | 3 z 8 | Koszalin, Manowo i częściowe bezpieczne pokrycie Tychowa. |
| Gminy z aktywnym PSZOK | 3 z 8 | Koszalin, Bobolice i Świeszyno. |
| Źródła aktywne | 7 | 3 harmonogramy, 2 człony bundle PSZOK Koszalin, PSZOK Bobolice i PSZOK Świeszyno. |
| Źródła planowane | 8 | Źródła z jawnymi blockerami, w tym hard-to-reach Tychowo i Będzino. |
| Real-address collection gate | 100 z 100 | 100% consumer API correctness na rzeczywistych punktach PRG. |
| Krytyczne błędy harmonogramu | 0 | Tolerancja bramki wynosi 0. |
| Niejednoznaczne odpowiedzi | 0 | Żaden z 100 przypadków nie został cicho rozstrzygnięty. |
| Golden facilities | 8 z 8 | 100% w clean-runtime consumer API gate. |

## Realny golden pack 100 adresów

Frozen evidence snapshot znajduje się w `apps/worker/test/fixtures/reference/prg-pilot-real-100-20260828.json`. Został pozyskany z oficjalnych usług GUGiK i nie wymaga dostępu do internetu podczas pull-request CI.

Rozkład:

- Koszalin: 9/9;
- Manowo: 46/46;
- Tychowo: 45/45;
- łącznie: 100/100.

Każdy liczony przypadek posiada prawdziwy identyfikator `prg-adresy.*`. Production gate odrzuca syntetyczne `wastepl-gate-*`. `Bogusława II 1-3` jest utrzymywany jako jawny source-only support row z `prg_id=NULL` i nie jest liczony jako punkt PRG.

Consumer gate wymaga correctness co najmniej `0.99`, ale obecnie osiąga `1.0`; critical schedule/date mismatches = `0`, ambiguous responses = `0`, facility correctness = `8/8`.

## Tychowo

Praca nad realnym PRG ujawniła różnicę źródłową `Pobądź` vs oficjalne PRG/TERYT `Pobądz`, SIMC `0313704`. Parser `municipal-collection-pdf-text@0.1.1` obsługuje jeden jawny alias `Pobądź -> Pobądz`; nie używa fuzzy matching.

Aktywny standard subset Tychowa ma 3 service areas i 45/45 realnych przypadków rozwiązuje się do dokładnie jednego service area. Miasto Tychowo oraz hard-to-reach properties pozostają celowo poza aktywnym zakresem do czasu jednoznacznego modelu rozróżnień źródłowych.

## Onboarding economics `#65`

PR `#69` dodaje kontrakt `schemas/onboarding-metrics-v0.1.schema.json`, dane `metrics/onboarding/pilot-koszalin-region-v0.1.json`, sprawdzany agregat oraz `scripts/check-onboarding-metrics.mjs` wpięty do `contracts:check`.

Jednostką pomiaru jest `municipality × data type × source wave`. Baseline zawiera 6 aktywacji:

- Koszalin collection;
- Koszalin PSZOK;
- Manowo collection;
- Bobolice PSZOK;
- Świeszyno PSZOK;
- Tychowo collection.

Walidator przegląda historię manifestów i wylicza pierwszy manifest, w którym każdy source key stał się `ACTIVE`. Pilnuje zgodności TERC, data type i parser key, braku podwójnego pokrycia oraz tego, aby każdy obecny ACTIVE source miał rekord metryk.

Baseline automatyzacji:

| Miara | Wynik | Uwagi |
| --- | ---: | --- |
| First-import measured records | 6 | Wszystkie obecne aktywacje mają repo evidence. |
| First import bez manual intervention | 5/6 | Koszalin PSZOK ma jeden deterministyczny review surface. |
| First-import manual intervention rate | 1/6 = 16,67% | Poniżej celu `<25%`, ale to mała próba. |
| Repeat-update measured records | 3 | Tylko przypadki z jawnym repeat-update evidence. |
| Repeat-update automation | 3/3 = 100% | Powyżej celu `>=90%`, bez ekstrapolacji na skalę kraju. |
| Adapter reuse inny niż `NEW_ADAPTER` | 1/6 = 16,67% | Mała historyczna próba. |
| Human-effort phases measured | 0/36 | Historyczny czas pozostaje `UNKNOWN`. |
| Total engineering/data-ops time | `UNKNOWN` | Nie jest rekonstruowany z commitów, PR ani długości sesji. |

Historyczne pola czasu mogą być liczbą tylko wtedy, gdy istnieje jawne `HISTORICAL_EVIDENCE`; w przeciwnym razie pozostają `UNKNOWN`. Baseline `2026.3` jest ostatnią wersją dopuszczającą historyczny backfill. Każdy source pierwszy raz aktywowany po `2026.3` musi mieć `measurementMode=PROSPECTIVE`, a wszystkie sześć faz — discovery, source assessment, parser implementation, regression fixture, address/service-area mapping i review — muszą być zmierzone jako `PROSPECTIVE_TIMER`. Brak rekordu zatrzymuje CI.

Szczegółowa metodologia znajduje się w [onboarding-economics.md](onboarding-economics.md).

`#65` pozostaje otwarte mimo gotowej warstwy pomiarowej. Powód jest celowy: nie mamy jeszcze ani jednego pełnego prospektywnego pomiaru human-active time, więc nie można uczciwie podać kosztu roboczogodzin na gminę. Pierwsza kolejna aktywacja ma dostarczyć ten pomiar.

## Production runtime i provenance

W runtime są zarejestrowane m.in. `pgk-koszalin-pdf-text`, `municipal-collection-pdf-text`, `pgk-koszalin-pszok-html` i `municipal-pszok-html`.

Harmonogramy zachowują artifact UUID, SHA-256, parser key/version i source URL. Publikacje są transakcyjne, replay idempotentny, a poprzednie `collection_events` są zamykane przez `valid_to` zamiast hard-delete. Koszalin PSZOK używa bundle `main + faq` z `WAITING_FOR_COMPANION` i last-known-good semantics.

`ARTIFACT_PROCESSING_ENABLED` pozostaje deploymentowo opt-in.

## Będzino i pozostałe NO-GO

Będzino pozostaje `PLANNED`. Exact child artifact URLs są zamrożone, ale relacja route I/II, OSŁONY i zbioru trudnodostępnego do konkretnych adresów/lokalności nie jest jeszcze deterministyczna. WastePL nie publikuje tych danych użytkownikowi, dopóki relacja nie będzie jednoznaczna.

Sianów nadal ma blocker dotyczący źródłowej kolumny generic `odpady segregowane`. Świeszyno schedule wymaga stabilnego child capture ze starego hosta, a Bobolice collection i Polanów wymagają dalszego deterministycznego modelu bieżących child artifacts.

## Live-source staging/drift gate

Mechanizm live-source gate z `#60` jest odseparowany od PR CI i uruchamiany ręcznie. Pull-request CI pozostaje deterministyczne i nie zależy od dostępności serwisów gminnych lub GUGiK.

Pierwszy manualny live-source soak z aktualnego `main` nadal jest wymagany przed zewnętrznym pilotem konsumenckim.

## CI i bramki

Pełny CI #119 (`33243809544`) na PR `#69` przeszedł:

- documentation check;
- `contracts:check`, w tym nowy onboarding metrics contract/history validator;
- migracje;
- build i strict typecheck;
- pełny domain/worker/API test suite;
- historyczne readiness `2026.1` i `2026.2`;
- clean production runtime na 100 realnych adresach PRG;
- extended runtime checks;
- consumer API 100-address gate;
- realny Tychowo 45-address post-gate;
- raporty, artifacts i API smoke test.

## Pozostałe blokery przed zewnętrznym pilotem

- aktywny collection schedule nadal obejmuje tylko 3 z 8 gmin;
- pierwszy manualny live-source staging/soak po aktualnym `main` nie został wykonany;
- miasto Tychowo i hard-to-reach wyjątki pozostają celowo bez publikacji;
- Będzino wymaga deterministycznej relacji route/address;
- ogólnopolski produkcyjny feed punktów systemu kaucyjnego nie jest jeszcze ustalony;
- `ARTIFACT_PROCESSING_ENABLED` pozostaje opt-in;
- brakuje pierwszego prospektywnie zmierzonego human-active onboarding record do rzeczywistego kosztu czasu.

## Najbliższa kolejność

1. Scalić warstwę kontraktową `#69` po finalnym zielonym CI; `#65` pozostawić otwarte do pierwszego pełnego prospektywnego pomiaru.
2. Wybrać następną bezpieczną aktywację źródła i od początku prowadzić sześć timerów onboardingowych.
3. Kontynuować collection coverage tylko tam, gdzie service-area mapping jest deterministyczny.
4. Wykonać manualny live-source staging/soak na aktualnym `main`.
5. Dopiero po stabilizacji danych, obserwowalności i coverage przejść do consumer PWA.

## Stan decyzji

**Data Platform PoC: GO.**

**Automatyczna publikacja dla wspieranych źródeł: GO pod istniejącymi gate'ami.**

**Kryterium `#64` — 100 realnych adresów: DONE, scalone w PR `#68`.**

**Warstwa pomiarowa `#65`: implementacja #69 + CI #119 PASS; koszt human-time nadal UNKNOWN do pierwszej prospektywnej aktywacji.**

**Zewnętrzny szeroki pilot konsumencki: nadal NO-GO**, ponieważ pokrycie harmonogramów nie obejmuje jeszcze wszystkich ośmiu gmin i nie wykonano aktualnego live-source soak.
