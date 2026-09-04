# Feasibility i research

> Materiał roboczy. Twierdzenia zewnętrzne zweryfikowano 2026-08-28; wynik wcześniejszego researchu 22 gmin pozostaje historyczną próbką, a nie aktualnym spisem całego kraju. Stan techniczny pilota zaktualizowano 2026-09-04.

## Wniosek

Produkt jest technicznie wykonalny. Obecny pilot potwierdził, że można zbudować wersjonowaną warstwę danych z provenance, realnym address resolution, harmonogramami, facilities i konsumenckim API.

Nadal nieudowodniona jest jednak ekonomiczna i operacyjna skalowalność do całej Polski. Koszt rośnie z różnorodnością i zmiennością źródeł, a nie wyłącznie z liczbą gmin.

Realistyczna ścieżka pozostaje taka sama: źródła oficjalne, rejestr formatów, adaptery per rodzina publikacji, immutable artifacts, provenance, source-health monitoring i kolejka review.

## Obserwacje z próbki

Historyczny research 22 gmin wykazał publikacje w PDF z tekstem, skanach PDF, HTML, arkuszach, obrazach i załącznikach BIP. Często harmonogram jest przypisany do rejonu, ulicy, zabudowy lub operatora zamiast bezpośrednio do adresu. To uzasadnia osobny model obszarów obsługi i reguł dopasowania.

Próbka była eksploracyjna i datowana. Nie dowodzi reprezentatywności dla 2477 gmin ani bieżącej dostępności konkretnych URL-i. Każde źródło produkcyjne musi mieć właściciela, częstotliwość pollingu, format, zakres obowiązywania i status w wersjonowanym manifeście.

## Co potwierdził obecny pilot

Na manifest `pilot-koszalin-region@2026.13` składa się 17 ACTIVE source identities w 8 gminach: 9 collection i 8 PSZOK.

Potwierdzono m.in.:

- działający source registry i immutable artifact path;
- parser dispatch i transakcyjną publikację;
- TERYT/PRG-backed address resolution;
- 415/415 poprawnych wyników w zdefiniowanych audytowanych zestawach realnych adresów PRG;
- 8 aktywnych PSZOK z trusted geocoding;
- thin PWA opartą o publiczne API;
- możliwość rzeczywistego live-source staging przeciwko publicznym upstreamom.

Te wyniki **nie dowodzą pełnego pokrycia wszystkich adresów w 8 gminach**. W kilku gminach aktywne collection scopes są bezpiecznymi podzbiorami.

## Źródła referencyjne

- [Państwowy Rejestr Granic (GUGiK)](https://www.geoportal.gov.pl/pl/dane/panstwowy-rejestr-granic-prg/) jest oficjalną bazą referencyjną m.in. granic i adresów.
- [TERYT (GUS)](https://eteryt.stat.gov.pl/) zapewnia urzędowe identyfikatory podziału terytorialnego, miejscowości i ulic.
- Oficjalna publikacja harmonogramu, regulaminu lub informacji PSZOK przez JST/BIP/operatora jest źródłem twierdzenia operacyjnego. Agregator zewnętrzny może służyć do discovery, nie jako źródło kanoniczne.

Referencja geograficzna nie zastępuje reguł odpadowych. PRG/TERYT pomaga rozpoznać adres, lecz nie mówi samodzielnie, który rejon, typ zabudowy lub harmonogram ma zastosowanie.

## Strategia pozyskania

1. Odczytaj manifest źródła i zachowaj jego wersję.
2. Pobierz warunkowo, zapisz wynik próby i immutable artifact z SHA-256.
3. Wybierz parser po jawnej rejestracji formatu i źródła.
4. Znormalizuj dane, zachowując URL/artifact/parser evidence i okres obowiązywania.
5. Uruchom walidację kontraktu, reguł domenowych i porównanie do poprzedniej wersji.
6. Wyślij niejednoznaczność lub znaczną zmianę do review; publikuj atomowo dopiero po pozytywnej decyzji.
7. Regularnie uruchamiaj live-source health check, ponieważ zielone fixture CI nie wykrywa niedostępności lub driftu realnej strony.

OCR i modele językowe mogą być fallbackiem dla skanów lub klasyfikacji układu. Ich wynik wymaga confidence, dowodu źródłowego i deterministycznej walidacji. Nie mogą generować identyfikatorów PRG/TERYT ani brakujących dat.

## Ryzyka wykonalności

- zmiana layoutu bez zmiany URL;
- jeden harmonogram z wieloma załącznikami i niespójnymi okresami;
- rejon zależny od numeru parzystego, zakresu numerów albo typu nieruchomości;
- PSZOK opisany na kilku stronach o różnej świeżości;
- trudnodostępne adresy i wyjątki tras;
- niejednoznaczne kategorie typu `odpady segregowane`;
- brak jasnych warunków ponownego wykorzystania lub automatycznego pobierania;
- skany o jakości niewystarczającej do bezpiecznego OCR;
- koszt ręcznego review przy dużej liczbie zmian upstreamów.

Mitigacją są manifesty, source health, canary fixtures, wykrywanie zmian, provenance, manual review oraz mierzenie maintenance cost.

## Następna walidacja: pełny PRG Address Coverage Census

Historyczna bramka 100 realnych adresów została przekroczona; obecnie repo ma 415 audytowanych adresów w kilku zdefiniowanych zestawach. Kolejna walidacja nie powinna polegać na dokładaniu kolejnej małej próbki.

Należy przejść przez **wszystkie oficjalne adresy PRG w 8 gminach pilota** i raportować osobno:

- `supported`;
- `unsupported`;
- `ambiguous`;
- wybrany service area;
- availability/correctness harmonogramu;
- przyczynę braku obsługi;
- coverage % per gmina i łącznie.

To badanie ustali prawdziwy denominator coverage i wygeneruje backlog rozszerzania źródeł według liczby odblokowanych adresów.

## Kryterium skalowania

Przed falą kolejnych ~20 gmin potrzebne są co najmniej:

- znane pełne address coverage obecnego pilota;
- regularny live-source monitoring;
- niski ambiguity rate;
- brak krytycznych wrong-date mismatches w audytowanych zakresach;
- działająca produkcja z observability i backup/restore;
- real-user pilot;
- wystarczająca próbka repeat updates;
- znany human-active onboarding i miesięczny maintenance cost per source/gmina.

Dopiero te dane pozwolą ocenić, czy architektura jest nie tylko technicznie poprawna, ale też ekonomicznie skalowalna.
