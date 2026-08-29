# Bieżący status WastePL

> Zweryfikowano: 2026-08-29, commit `67b25bf8b0db4fd0dff002b33e477478c0065bee` (pełny CI run `33242598823`, #115, PR `#67`). Zmiana dokumentacyjna podlega jeszcze finalnemu rerunowi przed merge.

## Etap

Sprinty 01–04 dostarczyły produkcyjnie utwardzony Data Platform PoC: rejestr źródeł, immutable artifacts, scheduler/outbox, BullMQ runtime, deterministyczne parsery, transakcyjne publikowanie harmonogramów, temporalną historię, facilities reconciliation, bundle coordination, oficjalny TERYT/PRG backbone, source-ops API oraz fixture-independent production gates.

Sprint 05 rozszerza rzeczywiste collection coverage i jakość pilota. Po PR `#66` aktywne harmonogramy obejmują Koszalin, Manowo i bezpieczną część Tychowa. PR `#67` implementuje kryterium `#64`: minimum 100 realnych adresów opartych o zamrożony snapshot GUGiK PRG oraz pełną consumer API bramkę jakości.

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

## Realny golden pack 100 adresów `#64`

Frozen evidence snapshot znajduje się w `apps/worker/test/fixtures/reference/prg-pilot-real-100-20260828.json`. Został pozyskany z oficjalnych usług GUGiK i nie wymaga dostępu do internetu podczas pull-request CI.

Rozkład 100 dokładnych punktów PRG:

- Koszalin: 9;
- Manowo: 46;
- Tychowo: 45.

Każdy liczony przypadek posiada prawdziwy identyfikator `prg-adresy.*`. Production gate odrzuca syntetyczne identyfikatory `wastepl-gate-*`. Snapshot zachowuje TERC, SIMC, ULIC, numer budynku, kod pocztowy, geometrię EPSG:2180 i oczekiwany service-area key.

`Bogusława II 1-3` pozostaje ważnym przypadkiem regresyjnym ze źródła harmonogramu Koszalina, ale nie jest liczony do 100 adresów: jest to zakres/adres miejsca gromadzenia odpadów, a nie jeden dokładny punkt PRG. W clean runtime jest utrzymywany jako jawny support row z `prg_id=NULL`.

## Wynik clean production gate #115

Run `33242598823` na commicie `67b25bf8b0db4fd0dff002b33e477478c0065bee` przeszedł pełny pipeline. W izolowanej bazie `wastepl_production_gate` structural migrations rozpoczynają się z zerową liczbą canonical collection/facility rows.

Reference/runtime wynik:

- import TERC: 8 rekordów, 0 rejected;
- zamrożony PRG: 100 realnych adresów, 100 inserted, 0 rejected;
- syntetyczne PRG IDs: 0;
- source-only support addresses: 1;
- manifest `pilot-koszalin-region@2026.3`: 8 gmin, 15 source identities, 7 ACTIVE, 8 PLANNED;
- po initial runtime publish: 471 current collection events, 3 collection publications i 3 gminy z canonical collection data;
- Tychowo: 3 aktywne service areas;
- facilities: 3 canonical entities i 5 początkowych source assertions;
- replay identycznego artefaktu: `DEDUPLICATED` bez dodatkowej publikacji;
- symulowany `HTTP_503`: health `FETCH_FAILED`, last-known-good zachowane;
- zmieniony artefakt Manowa: current logical event set pozostaje stabilny, 66 poprzednich eventów przechodzi do historii temporalnej;
- duplicate current collection events: 0;
- duplicate canonical facilities: 0;
- duplicate artifact assertions: 0.

## Consumer API quality gate

Consumer gate działa na tej samej czystej bazie po rzeczywistym artifact runtime i wykonuje `/v1/collection` dla wszystkich 100 realnych adresów.

Wynik #115:

| Gmina | TERC | Wynik |
| --- | --- | ---: |
| Tychowo | `3201043` | 45/45 |
| Manowo | `3209042` | 46/46 |
| Koszalin | `3261011` | 9/9 |
| **Łącznie** | — | **100/100** |

Dodatkowe warunki:

- correctness: `1.0` przy wymaganym minimum `0.99`;
- critical schedule/date mismatches: `0` przy tolerancji `0`;
- ambiguous responses: `0`;
- facility correctness: `8/8`;
- mismatch report: pusty.

Każdy potencjalny mismatch ma zaplanowane evidence obejmujące PRG ID, SIMC, ULIC, geometrię, source key/URL/fixture/event profile oraz published artifact provenance.

## Tychowo — realny reference gate

Praca nad `#64` ujawniła błąd, którego wcześniejszy syntetyczny reference context nie wykrywał: źródłowy harmonogram zapisuje miejscowość jako `Pobądź`, natomiast oficjalny PRG/TERYT używa `Pobądz`, SIMC `0313704`.

Parser `municipal-collection-pdf-text@0.1.1` obsługuje wyłącznie ten jeden jawny source alias `Pobądź -> Pobądz`. Nie stosuje fuzzy matching. Dataset niesie warning provenance `SOURCE_LOCALITY_ALIAS:Pobądź->Pobądz`.

Tychowo post-gate #115 potwierdził:

- 45/45 realnych adresów PRG aktywnych;
- 45/45 ma dokładnie jedno deterministyczne pokrycie service area;
- ambiguous service areas: 0;
- parser: `municipal-collection-pdf-text@0.1.1`;
- source health: `HEALTHY`;
- co najmniej jeden opublikowany artefakt źródła.

Miasto Tychowo i hard-to-reach properties nadal są celowo poza aktywnym zakresem, dopóki oficjalne rozróżnienia nie mogą zostać odwzorowane bez `AMBIGUOUS_SERVICE_AREA`.

## Production handlery i provenance

W runtime są zarejestrowane m.in.:

- `pgk-koszalin-pdf-text`;
- `municipal-collection-pdf-text`;
- `pgk-koszalin-pszok-html`;
- `municipal-pszok-html`.

Harmonogramy zachowują artifact UUID, SHA-256, parser key/version i source URL. Publikacje są transakcyjne, replay idempotentny, a poprzednie `collection_events` są zamykane przez `valid_to` zamiast hard-delete.

`ARTIFACT_PROCESSING_ENABLED` pozostaje deploymentowo opt-in; zmiana domyślnego enablementu nie jest częścią `#64`.

## Facilities i bundle

Koszalin używa deterministycznego bundle `koszalin-pszok-main` + `koszalin-pszok-faq` z `WAITING_FOR_COMPANION`. Extended production gate nadal sprawdza zmianę samego FAQ, zachowanie aggregate access provenance z głównego źródła, source attribution quantity limits oraz brak duplikatów.

Bobolice i Świeszyno pozostają aktywne dla PSZOK bez wymyślania geometrii lub zakresu danych, których źródło nie potwierdza.

## Będzino — evidence-backed NO-GO

Będzino nadal pozostaje `PLANNED`. Exact child artifact URLs są zamrożone, ale blocker dotyczy deterministycznego mapowania route I/II, OSŁONY i zbioru trudnodostępnego do konkretnych adresów/lokalności. WastePL nie publikuje tych danych użytkownikowi, dopóki relacja nie będzie jednoznaczna.

Szczegóły są w [assessment fali 3](research/pilot-source-wave-3-assessment.md).

## Live-source staging/drift gate

Mechanizm live-source gate z `#60` jest odseparowany od PR CI i uruchamiany ręcznie. Pull-request CI pozostaje deterministyczne i nie zależy od dostępności serwisów gminnych lub GUGiK.

Pierwszy manualny live-source soak z aktualnego `main` nadal jest wymagany przed zewnętrznym pilotem konsumenckim.

## Source-ops API

Internal source-ops API pod `/internal/v1/source-ops/*` raportuje health, coverage, pending outbox i review queues na podstawie Source Registry. Coverage jest wielowymiarowe: jedna gmina może mieć osobny wiersz dla `COLLECTION_SCHEDULE` i `PSZOK`. Gate `2026.3` wymaga dokładnego zestawu ośmiu pilotażowych TERC, a nie błędnie zakłada ośmiu wierszy coverage.

## CI i bramki

Pełny CI #115 (`33242598823`) potwierdził:

- documentation check i contracts;
- wszystkie migracje;
- build i strict typecheck;
- pełny domain/worker/API test suite;
- historyczne readiness `2026.1` i `2026.2`;
- clean production runtime na 100 realnych adresach PRG;
- extended runtime checks;
- consumer API 100-address gate;
- realny Tychowo 45-address post-gate;
- wymagane raporty i artifacts.

Wcześniejszy run #114 prawidłowo wykrył błąd samej asercji raportowej: `coverage()` zwraca wiersze per gmina i data type, więc dla 8 gmin otrzymano 11 wierszy. Asercja została poprawiona na dokładny zbiór ośmiu TERC bez osłabiania wymagań dotyczących danych.

## Pozostałe blokery przed zewnętrznym pilotem

- aktywny collection schedule nadal obejmuje tylko 3 z 8 gmin;
- pierwszy manualny live-source staging/soak po aktualnym merge nie został wykonany;
- miasto Tychowo i hard-to-reach wyjątki pozostają celowo bez publikacji;
- Będzino wymaga deterministycznej relacji route/address;
- ogólnopolski produkcyjny feed punktów systemu kaucyjnego nie jest jeszcze ustalony;
- `ARTIFACT_PROCESSING_ENABLED` pozostaje opt-in;
- nadal trzeba mierzyć realny koszt/czas onboardingu i utrzymania kolejnych gmin.

## Najbliższa kolejność

1. Scalić `#67` po finalnym zielonym CI i zamknąć `#64`.
2. Zrealizować `#65`: audytowalne metryki onboardingu/adapters reuse bez wymyślania historycznych minut pracy.
3. Kontynuować aktywację kolejnych gmin tylko tam, gdzie coverage jest deterministyczne.
4. Wykonać manualny live-source staging/soak na aktualnym `main`.
5. Dopiero po stabilizacji danych i obserwowalności przejść do consumer PWA.

## Stan decyzji

**Data Platform PoC: GO.**

**Automatyczna publikacja dla wspieranych źródeł: GO pod istniejącymi gate'ami.**

**Kryterium `#64` 100 realnych adresów: implementacja i pełny CI #115 PASS; oczekuje na merge PR `#67`.**

**Zewnętrzny szeroki pilot konsumencki: nadal NO-GO**, ponieważ pokrycie harmonogramów nie obejmuje jeszcze wszystkich ośmiu gmin i nie wykonano aktualnego live-source soak.
