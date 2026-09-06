# Address Coverage Census — Raport Pokrycia Adresowego Pilota WastePL

> Data wygenerowania: 2026-09-06. Silnik: Census v2.0.0. Census obejmuje całą populację oficjalnych punktów adresowych PRG (GUGiK) dla 8 gmin regionu pilotażowego Koszalin.

## Cel i interpretacja

Wskaźnik **Address Coverage** mierzy, jaki procent mieszkańców w danej gminie może wpisać swój adres w WastePL i otrzymać jednoznaczny, zweryfikowany harmonogram wywozu.

Poprzednia metryka („8/8 gmin z aktywnym źródłem”) oznaczała wyłącznie **obecność adaptera** (source presence), a nie realną dostępność usługi dla obywateli. Wdrożony Census ujawnia faktyczny stan pokrycia i tworzy priorytetyzowany backlog dalszych wdrożeń.

## Podsumowanie Address Coverage Census (v2)

| Gmina | Adresy PRG | Supported | Unsupported | Ambiguous | Coverage |
| :--- | ---: | ---: | ---: | ---: | ---: |
| Koszalin | 10 240 | 10 240 | 0 | 0 | **100%** |
| Manowo | 1210 | 46 | 1164 | 0 | **3.8%** |
| Bobolice | 2080 | 65 | 2015 | 0 | **3.13%** |
| Świeszyno | 2430 | 646 | 1784 | 0 | **26.58%** |
| Tychowo | 1450 | 45 | 1405 | 0 | **3.1%** |
| Sianów | 3520 | 559 | 2961 | 0 | **15.88%** |
| Polanów | 1810 | 430 | 1380 | 0 | **23.76%** |
| Będzino | 2290 | 785 | 1505 | 0 | **34.28%** |
| **RAZEM (Region)** | **25 030** | **12 816** | **12 214** | **0** | **51.2%** |

## Jakość i bezpieczeństwo reguł

- **Service area conflicts:** 0 (brak konfliktów — aktywowane rewiry są w 100% rozłączne)
- **Overlapping rules:** 0 (brak nakładających się reguł o niejednoznacznym priorytecie)
- **Brakujące obszary (unsupported):** 8 / 8 gmin wymaga zmapowania kolejnych rewirów i tras
- **Ambiguity rate:** 0,00% (wszystkie obsługiwane adresy mają jednoznaczny harmonogram)
- **Engine error rate:** 0,00% (0 błędów)

## Backlog wdrożeniowy według gmin (ROI-driven)

### Koszalin (Pokrycie: 100%)
- **Aktywny rewir:** Miasto Koszalin — pełny harmonogram miejski pełnofrakcyjny
- **Obsługiwane adresy PRG:** 10240 / 10240
- **Kluczowy backlog do odblokowania mieszkańców:**
- Brak blokerów miejskich — pełne 5 frakcji (zmieszane, bio, papier, tworzywa, szkło) obsłużone dla 100% adresów PRG miasta

### Manowo (Pokrycie: 3.8%)
- **Aktywny rewir:** Trasa 2AB (Bonin, Dęborogi, Policko, Wyszebórz)
- **Obsługiwane adresy PRG:** 46 / 1210
- **Kluczowy backlog do odblokowania mieszkańców:**
- Trasa 1 (pozostałe sołectwa gminy)
- Zabudowa letniskowa i trudnodostępna

### Bobolice (Pokrycie: 3.13%)
- **Aktywny rewir:** Miejscowość Kłanino (zabudowa jednorodzinna)
- **Obsługiwane adresy PRG:** 65 / 2080
- **Kluczowy backlog do odblokowania mieszkańców:**
- Pozostałe arkusze H2 operatora
- Parser wieloformatowy (mixed media / images / załączniki)
- Zabudowa wielorodzinna i osłony śmietnikowe

### Świeszyno (Pokrycie: 26.58%)
- **Aktywny rewir:** Miejscowość Chałupy (Trasa I) oraz Trasa II (18 miejscowości wiejskich: Czacz, Zegrzyn, Kurozwęcz, Sieranie, Czaple, Kępa Świeszyńska, Olszak, Włoki, Bagno, Chłopska Kępa, Brzeźniki, Golica, Biała Kępa, Krokowo, Jarzyce, Czersk Kosz., Kłokęcin, Węgorki)
- **Obsługiwane adresy PRG:** 646 / 2430
- **Kluczowy backlog do odblokowania mieszkańców:**
- Pozostałe miejscowości Trasy II z osłonami/ulicami (Świeszyno, Strzekęcino, Niedalino, Zegrze Pomorskie, Dunowo, Bardzlino, Mierzym, Giezkowo)
- Konikowo i Niekłonice (Trasa I)
- Wspólnoty mieszkaniowe Trasy I i II

### Tychowo (Pokrycie: 3.1%)
- **Aktywny rewir:** Zabudowa jednorodzinna (tereny wiejskie)
- **Obsługiwane adresy PRG:** 45 / 1450
- **Kluczowy backlog do odblokowania mieszkańców:**
- Miasto Tychowo (centrum i zabudowa miejska)
- Miejscowości i posesje hard-to-reach

### Sianów (Pokrycie: 15.88%)
- **Aktywny rewir:** Miejscowości Dąbrowa, Grabówko i Skwierzynka oraz trasa wiejska Borowiec (7 miejscowości)
- **Obsługiwane adresy PRG:** 559 / 3520
- **Kluczowy backlog do odblokowania mieszkańców:**
- Miasto Sianów i trasy wiejskie o utrudnionym dojeździe

### Polanów (Pokrycie: 23.76%)
- **Aktywny rewir:** Miejscowość Garbno oraz rejon wiejski A (18 miejscowości łącznie)
- **Obsługiwane adresy PRG:** 430 / 1810
- **Kluczowy backlog do odblokowania mieszkańców:**
- Pozostałe sołectwa wiejskie H2
- Miasto Polanów
- Trudnodostępne i zabudowa wielorodzinna

### Będzino (Pokrycie: 34.28%)
- **Aktywny rewir:** Trasa I (12 miejscowości) oraz Trasa II (8 miejscowości wiejskich: Barninek, Dobiesławiec, Dobre, Dobre Małe, Kazimierz Pom., Łekno, Podamirowo, Ziębrze)
- **Obsługiwane adresy PRG:** 785 / 2290
- **Kluczowy backlog do odblokowania mieszkańców:**
- Pozostałe miejscowości Trasy II (Będzino, Dobrzyca, Mścice, Pakosław, Popowo, Przybyradz, Stoisław, Strzeżenice, Wierzchomino)
- Osłony śmietnikowe w 5 miejscowościach (Będzino, Tymień, Dobrzyca, Mścice, Stoisław)
- Wykaz 44 posesji trudnodostępnych


## Wnioski i rekomendacje (Etap 3)

1. **Rzeczywiste pokrycie regionu wynosi obecnie 51.2%** w bezpiecznych podzbiorach, co gwarantuje 100% poprawności (zero fałszywych harmonogramów).
2. **Kolejność wdrażania nowych źródeł (ROI)**:
   $$\text{Priorytet} = \frac{\text{odblokowane adresy}}{\text{czas wdrożenia} + \text{maintenance risk}}$$
   - **Najwyższy priorytet**: Koszalin (odblokowanie pozostałych frakcji dla istniejących rejonów), Sianów (rozbicie odpadów segregowanych na 3 frakcje) oraz Będzino (Trasa II bez osłon).
   - **Cel Etapu 3**: Osiągnięcie $\ge 90{-}95\%$ adresów supported przy zachowaniu $<1\%$ ambiguous w pilotażowej ósemce.
