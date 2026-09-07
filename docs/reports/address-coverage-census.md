# Address Coverage Audit — audytowane pokrycie adresowe pilota WastePL

> Aktualizacja: 2026-09-07. Silnik: v2.1.0. Tryb: `AUDITED_REFERENCE_PACKS`. Pełny audyt resolvera całej populacji: **NIE**.

## Zakres pomiaru

Bieżący raport porównuje liczbę **oficjalnych adresów PRG znajdujących się w audytowanych, deterministycznych paczkach referencyjnych** z terytorialnym denominatorom PRG dla 8 gmin pilota.

Wynik **nie oznacza**, że wszystkie pozostałe adresy zostały uruchomione przez resolver i sklasyfikowane jako `UNSUPPORTED`. Obecne 12 214 adresów poza audytowanymi paczkami to **remaining unaudited**, a nie wynik pełnej klasyfikacji adres-po-adresie.

Pełny audyt wszystkich 25 030 adresów jest P0 i jest śledzony w **#144**. Do czasu jego wdrożenia zera ambiguity/errors/conflicts odnoszą się wyłącznie do aktywowanych paczek audytowych oraz ich deterministycznych gate'ów.

## Podsumowanie audited supported coverage

| Gmina | Baseline PRG | Audited supported | Remaining unaudited | Audited ambiguity | Audited coverage |
| :--- | ---: | ---: | ---: | ---: | ---: |
| Koszalin | 10 240 | 10 240 | 0 | 0 | **100%** |
| Manowo | 1 210 | 46 | 1 164 | 0 | **3.8%** |
| Bobolice | 2 080 | 65 | 2 015 | 0 | **3.13%** |
| Świeszyno | 2 430 | 646 | 1 784 | 0 | **26.58%** |
| Tychowo | 1 450 | 45 | 1 405 | 0 | **3.1%** |
| Sianów | 3 520 | 559 | 2 961 | 0 | **15.88%** |
| Polanów | 1 810 | 430 | 1 380 | 0 | **23.76%** |
| Będzino | 2 290 | 785 | 1 505 | 0 | **34.28%** |
| **RAZEM (Region)** | **25 030** | **12 816** | **12 214** | **0*** | **51.2%** |

\* `0` ambiguity jest wynikiem audytowanych paczek/gate'ów, a nie pełnej klasyfikacji wszystkich 25 030 adresów.

## Jakość i bezpieczeństwo — zakres audytowany

- **Measurement mode:** `AUDITED_REFERENCE_PACKS`
- **Quality scope:** `AUDITED_REFERENCE_PACKS_ONLY`
- **Full-population resolution verified:** `false`
- **Audytowane adresy:** 12 816 / 25 030
- **Known service-area conflicts w aktywowanych paczkach:** 0
- **Known overlapping rules w aktywowanych paczkach:** 0
- **Known ambiguity w aktywowanych paczkach:** 0
- **Known engine errors w aktywowanych paczkach:** 0
- **Nieaudytowany adres-po-adresie remainder:** 12 214

## Backlog wdrożeniowy

### Koszalin — 100%
- Audytowany subset: pełne miasto, 5 frakcji.
- Audytowane: **10 240 / 10 240**.

### Manowo — 3.8%
- Audytowany subset: legacy Trasa 2AB — Bonin, Dęborogi, Policko, Wyszebórz.
- Audytowane: **46 / 1 210**.
- Dzisiejszy live-source staging potwierdza, że `2AB.pdf` jest nadal HEALTHY i parsowalny.
- Bieżący indeks PGK rozdziela jednak harmonogram na `manowo3/*`; #143 prowadzi kontrolowaną migrację kanoniczności bez utraty 46/46 obecnych adresów.
- Kolejne trasy dopiero po zamrożeniu aktualnych artefaktów i paczek PRG.

### Bobolice — 3.13%
- Audytowany subset: Kłanino.
- Audytowane: **65 / 2 080**.
- Backlog: pozostałe H2, mixed media, zabudowa wielorodzinna/osłony.

### Świeszyno — 26.58%
- Audytowany subset: Chałupy + 18 czystych miejscowości Trasy II.
- Audytowane: **646 / 2 430**.
- Kolejne kandydaty: Konikowo i Niekłonice oraz pozostałe zakresy Trasy II, ale wymagają nowych paczek PRG i zero-overlap proof względem osłon/wspólnot.

### Tychowo — 3.1%
- Audytowane: **45 / 1 450**.
- Backlog: miasto Tychowo, obszary gęste i hard-to-reach.

### Sianów — 15.88%
- Audytowany subset: Dąbrowa, Grabówko, Skwierzynka i bezpieczny rural subset Borowiec.
- Audytowane: **559 / 3 520**.
- Po #140 źródłowa kategoria `odpady segregowane` pozostaje `OTHER`; WastePL nie inferuje `PAPER`, `GLASS` ani `METALS_PLASTICS` bez jawnego źródła.
- Route 13 — Karnieszewice, Kołzin i Płonka — jest kandydatem #141 po zamrożeniu aktualnego H2 artefaktu i paczek PRG.
- Miasto i `15-utrudnione` wymagają mapowania adresowego.

### Polanów — 23.76%
- Audytowany subset: Garbno + rejon wiejski A.
- Audytowane: **430 / 1 810**.
- Backlog: pozostałe H2, miasto i trudnodostępne/wielorodzinne.

### Będzino — 34.28%
- Audytowany subset: Trasa I + 8 czystych miejscowości Trasy II.
- Audytowane: **785 / 2 290**.
- Backlog: pozostałe miejscowości Trasy II, osłony oraz 44 posesje trudnodostępne.

## Wnioski i rekomendacje

1. **Audytowane supported coverage wynosi 51.2% (12 816 / 25 030).** To konserwatywny licznik adresów z deterministycznym dowodem, a nie pełny wynik klasyfikacji resolvera całej populacji.
2. **P0 #144:** zbudować pełny, wersjonowany zbiór 25 030 punktów PRG i sklasyfikować każdy adres przez runtime resolver przed publikowaniem globalnych wskaźników ambiguity/error/conflict.
3. **Sianów:** nie wracać do sztucznego splitu frakcji; kontynuować #141 wyłącznie source-backed.
4. **Manowo:** `2AB.pdf` jest nadal HEALTHY, więc nie ma outage'u; #143 jest migracją kanoniczności do aktualnego układu źródeł.
5. **Będzino/Świeszyno:** kolejne partie wymagają nowych paczek PRG i zero-overlap proof.
6. Szczegółowość danych WastePL nie może przekraczać szczegółowości oficjalnego źródła.
