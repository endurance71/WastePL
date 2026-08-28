# Model biznesowy i B2G

> Datowany materiał roboczy, zweryfikowany 2026-08-28. Nie stanowi porady prawnej, podatkowej ani zakupowej. Ceny, programy finansowania i tryb zakupu wymagają ponownej weryfikacji przed ofertą.

## Model wartości

WastePL może sprzedawać utrzymaną jakość danych, monitoring zmian i integrację, a nie sam dostęp do publicznego pliku. Wartość dla JST to mniej błędnych informacji, krótszy czas obsługi mieszkańca i audytowalny kanał publikacji. Wartość dla partnera to uniknięcie dziesiątek integracji źródłowych.

Potencjalne segmenty:

- JST lub związek międzygminny — dashboard jakości, publikacja API/widgetu i SLA;
- operator komunalny — adaptery, monitoring zmian i obsługa wyjątków;
- producent aplikacji/IoT — API danych i webhooki;
- użytkownik końcowy — bezpłatny dostęp podstawowy; funkcje premium dopiero po potwierdzeniu popytu.

Pakiety i ceny z dawnych materiałów są hipotezami discovery, nie zatwierdzonym cennikiem. Przed skalowaniem trzeba zmierzyć koszt wdrożenia, miesięczne utrzymanie źródła, wolumen review i gotowość płatniczą każdej grupy.

## Wejście B2G

1. Dostarczyć mały, mierzalny pilot: pokrycie, zgodność, świeżość, czas obsługi błędu.
2. Uzyskać właściciela danych po stronie JST i uzgodnić źródła oraz odpowiedzialność publikacyjną.
3. Oferować integrację jako usługę z jawnym SLA, eksportem i brakiem vendor lock-in.
4. Rozszerzać gminy przez partnerstwo regionalne lub operatora obsługującego wspólne formaty.

Od 1 stycznia 2026 próg stosowania polskiej ustawy Pzp wzrósł z 130 000 do 170 000 zł, co potwierdza [Urząd Zamówień Publicznych](https://www.gov.pl/web/uzp/podwyzszenie-progu-stosowania-ustawy-prawo-zamowien-publicznych-i-ustawy-o-umowie-koncesji-na-roboty-budowlane-lub-uslugi). Zakup poniżej progu nadal podlega zasadom celowości, przejrzystości, konkurencyjności i regulacjom wewnętrznym zamawiającego; UZP publikuje osobne [wyjaśnienie dla zamówień podprogowych](https://www.gov.pl/web/uzp/zamowienia-publiczne-bez-tajemnic--zamowienia-ponizej-progu-pzp). Nie należy projektować oferty w celu obchodzenia progów ani dzielenia zamówienia.

## Dane, prywatność i odpowiedzialność

- Ponowne wykorzystywanie informacji sektora publicznego podlega [ustawie z 11 sierpnia 2021 r. o otwartych danych](https://eli.gov.pl/api/acts/DU/2021/1641/text.html), ale warunki, opłaty, prawa osób trzecich i regulamin każdego źródła trzeba sprawdzić osobno.
- Publiczny adres nie oznacza automatycznie, że każdy zbiór i każda metoda automatycznego pobierania są bezwarunkowe. Manifest powinien przechowywać notatkę o pochodzeniu i warunkach reuse.
- Jeśli produkt przetwarza dane użytkownika, identyfikatory urządzeń, lokalizację albo przypomnienia powiązane z osobą, zastosowanie ma [RODO](https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=celex%3A32016R0679). Minimalizacja, retencja, podstawa prawna, bezpieczeństwo i realizacja praw osoby wymagają osobnego projektu.
- API powinno komunikować źródło, datę pobrania, status weryfikacji i ograniczenia. Umowa/SLA musi rozdzielać odpowiedzialność WastePL, wydawcy źródła i integratora.

## Finansowanie

Grant nie jest modelem biznesowym. Możliwe programy innowacji, cyfryzacji i GOZ traktujemy jako finansowanie prac rozwojowych po spełnieniu kryteriów konkretnego naboru. Aktualność możliwości sprawdza się wyłącznie w [harmonogramie PARP](https://www.parp.gov.pl/harmonogram-naborow); dawnych nazw programów i terminów nie należy przedstawiać jako dostępnych środków.

## Warunki decyzji komercyjnej

Go dla płatnego pilota wymaga: działającej bramki 100 realnych adresów, uzgodnionego właściciela danych, kosztu utrzymania poniżej zakładanej marży, procedury incydentów i jasnych warunków reuse. Bez tych danych prognozy przychodu pozostają scenariuszem, nie forecastem.
