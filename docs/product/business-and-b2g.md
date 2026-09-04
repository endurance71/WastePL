# Model biznesowy i B2G

> Datowany materiał roboczy. Twierdzenia prawne i zewnętrzne zweryfikowano 2026-08-28; stan techniczny pilota zaktualizowano 2026-09-04. Dokument nie stanowi porady prawnej, podatkowej ani zakupowej. Ceny, programy finansowania i tryb zakupu wymagają ponownej weryfikacji przed ofertą.

## Model wartości

WastePL może sprzedawać utrzymaną jakość danych, monitoring zmian i integrację, a nie sam dostęp do publicznego pliku. Wartość dla JST to mniej błędnych informacji, krótszy czas obsługi mieszkańca i audytowalny kanał publikacji. Wartość dla partnera to uniknięcie dziesiątek integracji źródłowych.

Potencjalne segmenty:

- JST lub związek międzygminny — dashboard jakości, publikacja API/widgetu i SLA;
- operator komunalny — adaptery, monitoring zmian i obsługa wyjątków;
- producent aplikacji/IoT — API danych i webhooki;
- użytkownik końcowy — bezpłatny dostęp podstawowy; funkcje premium dopiero po potwierdzeniu popytu.

Pakiety i ceny z dawnych materiałów są hipotezami discovery, nie zatwierdzonym cennikiem. Przed skalowaniem trzeba zmierzyć koszt wdrożenia, miesięczne utrzymanie źródła, wolumen review i gotowość płatniczą każdej grupy.

## Stan dowodu produktowego

Obecny pilot techniczny ma 8 gmin, 17 ACTIVE source identities, 8 aktywnych PSZOK oraz działającą PWA. Audytowane zestawy obejmują 415 realnych adresów PRG i przechodzą zdefiniowane gate'y.

Nie należy jednak przedstawiać tego jako 100% regionalnego address coverage. Pełny denominator wszystkich adresów PRG w 8 gminach nie został jeszcze policzony, a część collection scopes jest bezpiecznymi podzbiorami miejscowości lub tras.

Dla rozmów komercyjnych należy rozdzielać:

- municipality source presence;
- rzeczywiste address coverage;
- audited correctness;
- source freshness/health;
- maintenance cost i SLA.

## Wejście B2G

1. Domknąć mierzalny pilot: pełny PRG Address Coverage Census, correctness, freshness i source-health monitoring.
2. Uzyskać właściciela danych po stronie JST i uzgodnić źródła oraz odpowiedzialność publikacyjną.
3. Oferować integrację jako usługę z jawnym SLA, eksportem i brakiem vendor lock-in.
4. Rozszerzać gminy przez partnerstwo regionalne lub operatora obsługującego wspólne formaty.
5. W ofertach raportować jawnie unsupported/ambiguous scope zamiast obiecywać pełne coverage bez dowodu.

Od 1 stycznia 2026 próg stosowania polskiej ustawy Pzp wzrósł z 130 000 do 170 000 zł, co według materiału zweryfikowanego 2026-08-28 potwierdza [Urząd Zamówień Publicznych](https://www.gov.pl/web/uzp/podwyzszenie-progu-stosowania-ustawy-prawo-zamowien-publicznych-i-ustawy-o-umowie-koncesji-na-roboty-budowlane-lub-uslugi). Zakup poniżej progu nadal podlega zasadom i regulacjom właściwym dla zamawiającego; UZP publikuje [wyjaśnienie dla zamówień podprogowych](https://www.gov.pl/web/uzp/zamowienia-publiczne-bez-tajemnic--zamowienia-ponizej-progu-pzp). Nie należy projektować oferty w celu obchodzenia progów ani dzielenia zamówienia.

Przed wykorzystaniem tej informacji w realnej ofercie należy ponownie zweryfikować aktualny stan prawny.

## Dane, prywatność i odpowiedzialność

- Ponowne wykorzystywanie informacji sektora publicznego podlega [ustawie z 11 sierpnia 2021 r. o otwartych danych](https://eli.gov.pl/api/acts/DU/2021/1641/text.html), ale warunki, opłaty, prawa osób trzecich i regulamin każdego źródła trzeba sprawdzić osobno.
- Publiczny adres nie oznacza automatycznie, że każdy zbiór i każda metoda automatycznego pobierania są bezwarunkowe. Manifest powinien przechowywać notatkę o pochodzeniu i warunkach reuse.
- Jeśli produkt przetwarza dane użytkownika, identyfikatory urządzeń, lokalizację albo przypomnienia powiązane z osobą, zastosowanie ma [RODO](https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=celex%3A32016R0679). Minimalizacja, retencja, podstawa prawna, bezpieczeństwo i realizacja praw osoby wymagają osobnego projektu.
- API powinno komunikować źródło, datę pobrania, status weryfikacji i ograniczenia. Umowa/SLA musi rozdzielać odpowiedzialność WastePL, wydawcy źródła i integratora.

## Finansowanie

Grant nie jest modelem biznesowym. Możliwe programy innowacji, cyfryzacji i GOZ traktujemy jako finansowanie prac rozwojowych po spełnieniu kryteriów konkretnego naboru. Aktualność możliwości sprawdza się przed złożeniem wniosku w oficjalnych harmonogramach instytucji; dawnych nazw programów i terminów nie należy przedstawiać jako dostępnych środków.

## Warunki decyzji komercyjnej

Historyczna bramka `100 realnych adresów` została już przekroczona i nie jest wystarczającym warunkiem decyzji Go.

Przed płatnym pilotażem lub ofertą z mocnym SLA wymagane są:

- pełny PRG Address Coverage Census obecnych 8 gmin;
- uzgodniony minimalny poziom address coverage i jawne unsupported scopes;
- aktualny live-source soak całej aktywnej floty oraz regularny source monitoring;
- procedura incident/review i właściciel odpowiedzialności;
- produkcyjne monitoring, backup/restore i security hardening;
- znany human-active onboarding cost oraz miesięczny maintenance/source-ops cost;
- jasne warunki reuse źródeł;
- walidacja produktu przez realnych użytkowników/JST.

Bez tych danych prognozy przychodu i marży pozostają scenariuszem, nie forecastem.
