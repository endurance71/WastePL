# Address Coverage Census — Raport Pokrycia Adresowego Pilota WastePL

> Data wygenerowania: 2026-09-05. Silnik: Census v2.0.0. Census obejmuje całą populację oficjalnych punktów adresowych PRG (GUGiK) dla 8 gmin regionu pilotażowego Koszalin.

## Cel i interpretacja

Wskaźnik **Address Coverage** mierzy, jaki procent mieszkańców w danej gminie może wpisać swój adres w WastePL i otrzymać jednoznaczny, zweryfikowany harmonogram wywozu.

Poprzednia metryka („8/8 gmin z aktywnym źródłem”) oznaczała wyłącznie **obecność adaptera** (source presence), a nie realną dostępność usługi dla obywateli. Wdrożony Census ujawnia faktyczny stan pokrycia i tworzy priorytetyzowany backlog dalszych wdrożeń.

## Podsumowanie Address Coverage Census (v2)

| Gmina | Adresy PRG | Supported | Unsupported | Ambiguous | Coverage |
| :--- | ---: | ---: | ---: | ---: | ---: |
| Koszalin | 10 240 | 10 240 | 0 | 0 | **100%** |
| Manowo | 1210 | 46 | 1164 | 0 | **3.8%** |
| Bobolice | 2080 | 65 | 2015 | 0 | **3.13%** |
| Świeszyno | 2430 | 167 | 2263 | 0 | **6.87%** |
| Tychowo | 1450 | 45 | 1405 | 0 | **3.1%** |
| Sianów | 3520 | 214 | 3306 | 0 | **6.08%** |
| Polanów | 1810 | 39 | 1771 | 0 | **2.15%** |
| Będzino | 2290 | 487 | 1803 | 0 | **21.27%** |
| **RAZEM (Region)** | **25 030** | **11 303** | **13 727** | **0** | **45.16%** |

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

### Świeszyno (Pokrycie: 6.87%)
- **Aktywny rewir:** Miejscowość Chałupy (Trasa I)
- **Obsługiwane adresy PRG:** 167 / 2430
- **Kluczowy backlog do odblokowania mieszkańców:**
- Trasy II i III
- Stabilny capture z legacy child host dla załączników PDF

### Tychowo (Pokrycie: 3.1%)
- **Aktywny rewir:** Zabudowa jednorodzinna (tereny wiejskie)
- **Obsługiwane adresy PRG:** 45 / 1450
- **Kluczowy backlog do odblokowania mieszkańców:**
- Miasto Tychowo (centrum i zabudowa miejska)
- Miejscowości i posesje hard-to-reach

### Sianów (Pokrycie: 6.08%)
- **Aktywny rewir:** Miejscowości Dąbrowa i Grabówko oraz trasa wiejska Borowiec (7 miejscowości)
- **Obsługiwane adresy PRG:** 214 / 3520
- **Kluczowy backlog do odblokowania mieszkańców:**
- Miasto Sianów i trasy wiejskie o utrudnionym dojeździe

### Polanów (Pokrycie: 2.15%)
- **Aktywny rewir:** Miejscowość Garbno (zabudowa jednorodzinna)
- **Obsługiwane adresy PRG:** 39 / 1810
- **Kluczowy backlog do odblokowania mieszkańców:**
- Pozostałe sołectwa wiejskie H2
- Miasto Polanów
- Trudnodostępne i zabudowa wielorodzinna

### Będzino (Pokrycie: 21.27%)
- **Aktywny rewir:** Trasa I — 12 miejscowości wiejskich (Dworek, Będzinko, Borkowice, Kiszkowo, Łasin Kosz., Łopienica, Miłogoszcz, Słowienkowo, Smolne, Strachomino, Uliszki, Zagaje)
- **Obsługiwane adresy PRG:** 487 / 2290
- **Kluczowy backlog do odblokowania mieszkańców:**
- Trasa II (operator EKOSAN)
- Osłony śmietnikowe w 5 miejscowościach (Będzino, Tymień, Dobrzyca, Mścice, Stoisław)
- Wykaz 44 posesji trudnodostępnych


## Wnioski i rekomendacje (Etap 3)

1. **Rzeczywiste pokrycie regionu wynosi obecnie 45.16%** w bezpiecznych podzbiorach, co gwarantuje 100% poprawności (zero fałszywych harmonogramów).
2. **Kolejność wdrażania nowych źródeł (ROI)**:
   $$\text{Priorytet} = \frac{\text{odblokowane adresy}}{\text{czas wdrożenia} + \text{maintenance risk}}$$
   - **Najwyższy priorytet**: Koszalin (odblokowanie pozostałych frakcji dla istniejących rejonów), Sianów (rozbicie odpadów segregowanych na 3 frakcje) oraz Będzino (Trasa II bez osłon).
   - **Cel Etapu 3**: Osiągnięcie $\ge 90{-}95\%$ adresów supported przy zachowaniu $<1\%$ ambiguous w pilotażowej ósemce.
