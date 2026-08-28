# Feasibility i research

> Materiał roboczy. Twierdzenia zewnętrzne zweryfikowano 2026-08-28; wynik wcześniejszego researchu 22 gmin pozostaje historyczną próbką, a nie aktualnym spisem całego kraju.

## Wniosek

Produkt jest technicznie wykonalny, ale koszt skaluje się z różnorodnością i zmiennością źródeł, nie wyłącznie z liczbą gmin. Realistyczna ścieżka to źródła oficjalne, rejestr formatów, adaptery per rodzina publikacji, provenance oraz kolejka review.

## Obserwacje z próbki

Historyczny research 22 gmin wykazał publikacje w PDF z tekstem, skanach PDF, HTML, arkuszach, obrazach i załącznikach BIP. Często harmonogram jest przypisany do rejonu, ulicy, zabudowy lub operatora zamiast bezpośrednio do adresu. To uzasadnia osobny model obszarów obsługi i reguł dopasowania.

Próbka była eksploracyjna i datowana. Nie dowodzi reprezentatywności dla 2477 gmin ani bieżącej dostępności konkretnych URL-i. Każde źródło produkcyjne musi mieć właściciela, częstotliwość pollingu, format, zakres obowiązywania i status w wersjonowanym manifeście.

## Źródła referencyjne

- [Państwowy Rejestr Granic (GUGiK)](https://www.geoportal.gov.pl/pl/dane/panstwowy-rejestr-granic-prg/) jest oficjalną bazą referencyjną m.in. granic i adresów; GUGiK opisuje ciągłą aktualizację adresów na podstawie ewidencji gminnych.
- [TERYT (GUS)](https://eteryt.stat.gov.pl/) zapewnia urzędowe identyfikatory podziału terytorialnego, miejscowości i ulic.
- Oficjalna publikacja harmonogramu, regulaminu lub informacji PSZOK przez JST/BIP/operatora jest źródłem twierdzenia operacyjnego. Agregator zewnętrzny może służyć do discovery, nie jako źródło kanoniczne.

Referencja geograficzna nie zastępuje reguł odpadowych. PRG/TERYT pomaga rozpoznać adres, lecz nie mówi samodzielnie, który rejon, typ zabudowy lub harmonogram ma zastosowanie.

## Strategia pozyskania

1. Odczytaj manifest źródła i zachowaj jego wersję.
2. Pobierz warunkowo, zapisz wynik próby i immutable artifact z SHA-256.
3. Wybierz parser po jawnej rejestracji formatu i źródła.
4. Znormalizuj dane, zachowując fragment/stronę/URL i okres obowiązywania.
5. Uruchom walidację kontraktu, reguł domenowych i porównanie do poprzedniej wersji.
6. Wyślij niejednoznaczność lub znaczną zmianę do review; publikuj atomowo dopiero po pozytywnej decyzji.

OCR i modele językowe mogą być fallbackiem dla skanów lub klasyfikacji układu. Ich wynik wymaga confidence, dowodu źródłowego i deterministycznej walidacji. Nie mogą generować identyfikatorów PRG/TERYT ani brakujących dat.

## Ryzyka wykonalności

- zmiana layoutu bez zmiany URL;
- jeden harmonogram z wieloma załącznikami i niespójnymi okresami;
- rejon zależny od numeru parzystego, zakresu numerów albo typu nieruchomości;
- PSZOK opisany na kilku stronach o różnej świeżości;
- brak jasnych warunków ponownego wykorzystania lub automatycznego pobierania;
- skany o jakości niewystarczającej do bezpiecznego OCR.

Mitigacją są manifesty, source health, canary fixtures, wykrywanie zmian, provenance i manual review. Ekonomiczna wykonalność wymaga mierzenia kosztu utrzymania adaptera na aktywną gminę.

## Kryterium następnej walidacji

Pilot powinien przejść niezależną od fixtures próbę 100 realnych adresów z ośmiu gmin. Wynik raportuje osobno: rozwiązanie adresu, wybór obszaru obsługi, zgodność dat, kompletność provenance i świeżość. Obecne 30 adresów jest zestawem regresyjnym, nie substytutem tej próby.
