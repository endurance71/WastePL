# Onboarding economics i reuse adapterów

Ten dokument opisuje mierzalny model kosztu onboardingu źródeł WastePL. Celem nie jest tworzenie pozornie dokładnej wyceny na podstawie historii Git, tylko zebranie danych, które z czasem pozwolą odpowiedzieć, ile rzeczywistej pracy wymaga aktywacja i utrzymanie kolejnej gminy.

Źródłem prawdy jest `metrics/onboarding/pilot-koszalin-region-v0.1.json`, walidowany przez `schemas/onboarding-metrics-v0.1.schema.json` i `scripts/check-onboarding-metrics.mjs`. Agregat jest wersjonowany w `metrics/onboarding/pilot-koszalin-region-summary-v0.1.json` i CI odrzuca jego ręczne rozjechanie z rekordami źródłowymi.

## Jednostka pomiaru

Rekord odpowiada aktywacji `municipality × data type × source wave`, a nie całej gminie jako jednemu kosztowi. Koszalin ma więc osobny rekord dla harmonogramu i osobny dla PSZOK. Pozwala to odróżnić prosty pojedynczy PDF od wieloartefaktowego bundle i nie ukrywać review surface jednego typu danych w średniej dla całej gminy.

Każdy rekord przechowuje:

- TERC, typ danych, source wave, manifest pierwszej aktywacji i dokładne source keys;
- parser keys i klasę reuse: `REUSED_UNCHANGED`, `REUSED_WITH_CONFIGURATION`, `EXTENDED_EXISTING` albo `NEW_ADAPTER`;
- liczbę parent/child/active artifacts, sposób koordynacji, service-area complexity i manual review surfaces;
- sześć faz pracy: discovery, source assessment, parser implementation, regression fixture, address/service-area mapping i review;
- wynik first import oraz repeat update wraz z liczbą manual interventions i repo evidence.

## Zasada braku sztucznej precyzji

Historyczne aktywacje nie miały mierzonego human-active time. Wszystkie takie minuty pozostają `UNKNOWN`. Nie wolno rekonstruować ich z czasu między commitami, dat PR ani długości sesji. Pole czasu może stać się liczbą tylko jako `PROSPECTIVE_TIMER` albo jako jawne `HISTORICAL_EVIDENCE` z konkretnym evidence reference.

Baseline `2026.3` jest ostatnią wersją, dla której dopuszczamy historyczny backfill. Każdy source pierwszy raz aktywowany w późniejszym manifeście musi mieć `measurementMode=PROSPECTIVE`, a wszystkie sześć faz musi być zmierzone timerem. Brak rekordu dla nowego ACTIVE source zatrzymuje `contracts:check`.

## Stan pomiaru przez manifest 2026.3

| Miara | Wynik | Interpretacja |
| --- | ---: | --- |
| Rekordy aktywacji | 6 | Koszalin collection + PSZOK, Manowo collection, Bobolice PSZOK, Świeszyno PSZOK, Tychowo collection. |
| Zmierzone fazy human-time | 0 / 36 | Koszt czasowy historycznego onboardingu pozostaje nieznany. |
| Adapter reuse inny niż `NEW_ADAPTER` | 1 / 6 = 16,67% | Mała próba; nie wolno ekstrapolować na Polskę. |
| First import bez manual intervention | 5 / 6 = 83,33% | Jeden review surface dotyczy bundle PSZOK Koszalin. |
| First-import manual intervention rate | 1 / 6 = 16,67% | Poniżej pierwotnego celu `<25%`, ale tylko w obecnej małej próbie. |
| Repeat-update automation | 3 / 3 = 100% | Liczymy wyłącznie rekordy z jawnym repeat-update evidence. |

Wynik first-import i repeat-update mierzy zachowanie pipeline, nie czas człowieka. Dlatego można już oceniać stopień automatyzacji, ale nie można jeszcze uczciwie podać kosztu w roboczogodzinach na gminę.

## Backfill evidence

### Koszalin collection

`pgk-koszalin-pdf-text` był nowym parserem dla źródłowego układu. Clean production gate potwierdza automatyczny first import bez manual intervention. Historyczny czas implementacji pozostaje `UNKNOWN`.

### Koszalin PSZOK

Dwa źródła HTML tworzą obowiązkowy bundle `main + faq`. Pierwszy import kończy się częściowo `REVIEW_REQUIRED`, ponieważ Na Skwierzynkę 2 nie ma trusted geometry; to jest jedna policzalna manual-review surface. Zmiana FAQ jest przetwarzana automatycznie bez częściowego publish i bez utraty provenance głównej strony.

### Manowo collection

Istniejący parser PGK został rozszerzony o wariant Manowo i oficjalne SIMC. Production gate mierzy replay, upstream failure z last-known-good oraz changed-artifact replacement, dlatego repeat update ma jawne evidence.

### Bobolice i Świeszyno PSZOK

Oba źródła zostały aktywowane w tej samej fali przez nową klasę `municipal-pszok-html`. Nie zakładamy sztucznie, że jedna gmina była „pierwsza”, żeby drugiej przypisać reuse. Oba rekordy są więc historycznie `NEW_ADAPTER`, a czas pozostaje `UNKNOWN`.

### Tychowo collection

Wave 3 wymagał nowego parsera `municipal-collection-pdf-text`, ale wykorzystał istniejący artifact store, PDF extraction, BullMQ/outbox, schema validation i temporal publisher. Parent wskazuje dwa child PDF, natomiast ACTIVE jest wyłącznie bezpieczny standard subset. Wcześniejszy clean-runtime evidence potwierdza repeat update, a obecna 100-real-address bramka potwierdza first import i deterministic address coverage. Human-active minutes nie były mierzone i pozostają `UNKNOWN`.

## Jak mierzyć następną aktywację

Przed rozpoczęciem discovery należy utworzyć rekord `PROSPECTIVE`. Timer mierzy wyłącznie aktywną pracę człowieka w odpowiedniej fazie; oczekiwanie na CI, pobieranie, zewnętrzną odpowiedź lub bezczynność nie wchodzi do minut. Manual intervention jest osobnym zdarzeniem i nie jest zastępowany czasem pracy.

Po aktywacji rekord musi wskazywać manifest pierwszego `ACTIVE`, wszystkie source keys, parser/reuse class, source complexity, wynik pierwszego importu i evidence. Po pierwszej rzeczywistej zmianie źródła należy dopisać repeat-update observation. Dzięki temu kolejne fale dadzą rzeczywisty rozkład kosztu i reuse, zamiast jednorazowej estymacji.

## Go/no-go biznesowy

Na dziś można powiedzieć tylko, że w sześciu aktywacjach pipeline osiągnął first-import manual-intervention rate 16,67%, a trzy mierzone repeat updates były automatyczne. Nie ma jeszcze danych pozwalających podać medianę lub średnią roboczogodzin na gminę. Pierwsza kolejna aktywacja po `2026.3` ma dostarczyć pierwszy kompletny prospektywny pomiar czasu; dopiero potem warto porównywać engineering/data-ops effort między source shapes.
