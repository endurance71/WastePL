# Onboarding economics i reuse adapterów

> Stan dokumentu zaktualizowany 2026-09-04 dla danych przez manifest `pilot-koszalin-region@2026.13`.

Ten dokument opisuje mierzalny model kosztu onboardingu źródeł WastePL. Celem nie jest tworzenie pozornie dokładnej wyceny na podstawie historii Git, tylko zebranie danych, które z czasem pozwolą odpowiedzieć, ile rzeczywistej pracy wymaga aktywacja i utrzymanie kolejnej gminy/źródła.

## Źródło prawdy

Machine-readable źródłem prawdy jest:

- `metrics/onboarding/pilot-koszalin-region-v0.1.json`;
- `schemas/onboarding-metrics-v0.1.schema.json`;
- `scripts/check-onboarding-metrics.mjs`;
- agregat `metrics/onboarding/pilot-koszalin-region-summary-v0.1.json`.

CI odrzuca rozjazd agregatu z rekordami źródłowymi. Ten dokument jest warstwą interpretacyjną i nie powinien ręcznie nadpisywać machine-readable liczb.

## Jednostka pomiaru

Rekord odpowiada aktywacji `municipality × data type × source wave`, a nie całej gminie jako jednemu kosztowi. Jedna gmina może mieć osobne rekordy dla collection, PSZOK lub kolejnych rozszerzeń zakresu.

Pozwala to odróżnić prosty pojedynczy PDF od wieloartefaktowego bundle i nie ukrywać review surface jednego typu danych w średniej dla całej gminy.

Każdy rekord przechowuje m.in.:

- TERC, typ danych, source wave, manifest pierwszej aktywacji i dokładne source keys;
- parser keys i klasę reuse: `REUSED_UNCHANGED`, `REUSED_WITH_CONFIGURATION`, `EXTENDED_EXISTING` albo `NEW_ADAPTER`;
- source/artifact complexity, sposób koordynacji i manual review surfaces;
- sześć faz pracy: discovery, source assessment, parser implementation, regression fixture, address/service-area mapping i review;
- wynik first import;
- repeat-update evidence;
- liczbę manual interventions.

## Zasada braku sztucznej precyzji

Historyczne aktywacje bez mierzonego human-active time pozostają `UNKNOWN`. Nie wolno rekonstruować minut z czasu między commitami, dat PR ani długości sesji.

Pole czasu może być liczbą tylko wtedy, gdy ma jawne evidence, np. prospektywny timer lub inne zatwierdzone źródło pomiaru.

Nie imputujemy brakujących faz tylko po to, aby wyliczyć efektowną średnią.

## Stan pomiaru przez `2026.13`

| Miara | Wynik | Interpretacja |
| --- | ---: | --- |
| Activation records | **16** | Łączna liczba rekordów aktywacji w obecnym pilocie. |
| Prospective records | **10** | Aktywacje mierzone prospektywnie po historycznym baseline. |
| Historical backfill records | **6** | Historyczne rekordy z ograniczoną wiedzą o czasie pracy. |
| First-import automation | **15/16 = 93,75%** | Większość pierwszych importów bez manual intervention. |
| First-import manual intervention | **1/16 = 6,25%** | Wynik dobry dla obecnej próbki, ale nie krajowy forecast. |
| Repeat-update automation | **3/3 = 100%** | Tylko rekordy z jawnym repeat-update evidence. Próbka jest mała. |
| Adapter reuse inne niż `NEW_ADAPTER` | **11/16 = 68,75%** | Obiecujący sygnał reuse; nie ekstrapolować na cały kraj. |
| Human-effort phase observations | **60/96 = 62,50%** | 6 faz × 16 rekordów = 96 możliwych obserwacji. |
| Fully measured records | **10** | Rekordy z kompletnym pomiarem wszystkich wymaganych faz. |

Wynik first-import i repeat-update mierzy zachowanie pipeline, nie pełny koszt człowieka. Dlatego można już oceniać stopień automatyzacji, ale nadal nie można uczciwie podać jednej wiarygodnej średniej roboczogodzin na gminę dla całej Polski.

## Co można już powiedzieć

Na obecnej próbce:

- first-import automation jest wysoka: 93,75%;
- observed adapter reuse jest wyraźnie wyższy niż w początkowym baseline;
- trzy jawnie zmierzone repeat updates były automatyczne;
- większość nowych aktywacji ma już prospektywny model pomiaru;
- pipeline wykazuje techniczny reuse między source shapes i kolejnymi falami.

Te wyniki są pozytywne, ale mają ograniczenia:

- repeat-update sample = tylko 3;
- nie wszystkie fazy historyczne są znane;
- obecny region może mieć większy reuse niż losowa próbka krajowa;
- brakuje regularnego pomiaru miesięcznego maintenance/source-ops cost;
- aktywacja source nie jest tym samym co pełne address coverage gminy.

## Najważniejszy brak: koszt utrzymania

Onboarding cost sam nie odpowiada na pytanie, czy WastePL skaluje się ekonomicznie.

Dla każdego aktywnego source/gminy trzeba zacząć mierzyć także:

- czas reakcji na drift;
- review time;
- incident handling;
- parser fixes;
- upstream URL/attachment changes;
- manual verification;
- deployment/recovery effort;
- liczbę miesięcy bez interwencji.

Docelowe KPI:

- human-active onboarding time per activation;
- human-active maintenance time per active source/month;
- maintenance cost per municipality/month;
- incidents per active source;
- MTTR;
- adapter reuse rate;
- repeat-update automation rate.

## Jak mierzyć kolejne aktywacje

Przed rozpoczęciem discovery należy utworzyć rekord `PROSPECTIVE`. Timer mierzy wyłącznie aktywną pracę człowieka w odpowiedniej fazie; oczekiwanie na CI, pobieranie, zewnętrzną odpowiedź lub bezczynność nie wchodzi do minut.

Manual intervention jest osobnym zdarzeniem i nie jest zastępowany czasem pracy.

Po aktywacji rekord musi wskazywać:

- manifest pierwszego `ACTIVE`;
- wszystkie source keys;
- parser/reuse class;
- source complexity;
- wynik first import;
- evidence dla pomiaru faz.

Po pierwszej rzeczywistej zmianie źródła należy dopisać repeat-update observation.

## Powiązanie z address coverage

Ekonomia nie może być oceniana wyłącznie per liczba aktywowanych sources.

Dwa źródła o podobnym koszcie mogą odblokować zupełnie inną liczbę adresów. Dlatego priorytet rozszerzeń powinien uwzględniać relację:

`liczba nowych supported PRG addresses / (human effort + maintenance risk)`

Pełny PRG Address Coverage Census ma dostarczyć denominatora potrzebnego do takiej oceny.

## Go/no-go biznesowy

Przed skalowaniem do kolejnych ~20 gmin potrzebujemy więcej niż dobrej first-import automation.

Minimalny zestaw dowodów:

- pełne address coverage obecnych 8 gmin jest znane;
- regularny live-source monitoring działa operacyjnie;
- większa próbka repeat updates potwierdza automatyzację;
- human-active onboarding jest mierzony prospektywnie;
- miesięczny maintenance/source-ops cost jest znany przynajmniej dla reprezentatywnej próbki;
- adapter reuse nie pogarsza correctness;
- nie ma krytycznych wrong-date mismatches w audytowanych zakresach.

Dopiero wtedy można budować wiarygodny model marży i kosztu obsługi 20, 100 lub 2477 gmin.
