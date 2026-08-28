<!-- Source: https://docs.google.com/document/d/19gAcVhZ_Ib8-vBBd3MNI5Qi0bMDoU7nOGvRSs2Ci9Rs/edit -->
<!-- Local snapshot: 2026-08-28 -->

# 06 — Research, konkurencja i źródła — WastePL

[Oryginał w Google Docs](https://docs.google.com/document/d/19gAcVhZ_Ib8-vBBd3MNI5Qi0bMDoU7nOGvRSs2Ci9Rs/edit)

WASTEPL — RESEARCH, KONKURENCJA I ŹRÓDŁA


Data: 27.08.2026
Status: baza robocza do dalszej weryfikacji


1. CEL DOKUMENTU


Ten dokument zbiera najważniejsze obserwacje konkurencyjne, inspiracje zagraniczne, źródła prawne i techniczne oraz miejsca, które warto dalej monitorować.


Nie wszystkie poniższe produkty konkurują z WastePL bezpośrednio. Część jest istotna jako benchmark funkcji albo dowód fragmentacji rynku.


2. GŁÓWNY WNIOSEK KONKURENCYJNY


Rynek nie cierpi na brak aplikacji. Cierpi na brak interoperacyjności i pełnego pokrycia.


Typowy model konkurentów:
gmina kupuje system → dostawca dodaje gminę → mieszkańcy mogą korzystać.


Model WastePL:
publiczne/oficjalne źródła → normalizacja → WastePL Data Platform → aplikacja działa również bez kontraktu z gminą → gmina może później przejąć i zweryfikować profil.


3. ECOHARMONOGRAM


Typ produktu:
aplikacja harmonogramowa / B2G.


Funkcje:
• harmonogram po adresie,
• przypomnienia,
• zasady segregacji,
• komunikaty,
• PSZOK i informacje lokalne.


Znaczenie dla WastePL:
To jeden z najważniejszych benchmarków UX i sprzedaży do gmin. Nie rozwiązuje jednak problemu jednolitego pokrycia całej Polski niezależnie od kontraktów JST.


Źródło:
https://www.ecoharmonogram.pl/


4. KIEDY ŚMIECI


Typ produktu:
harmonogram + panel dla gmin.


Znaczenie:
Pokazuje, że sam harmonogram jest relatywnie tanim produktem B2G i nie powinien być jedynym źródłem wartości WastePL.


5. mMIESZKANIEC / mODPADY


Typ produktu:
aplikacja mieszkańca / moduł gospodarki odpadami.


Funkcje:
• harmonogram,
• wiele adresów,
• powiadomienia,
• zgłoszenia,
• mapa PSZOK i punktów.


Źródło:
https://www.tumieszkam.info/


6. SEGREGO


Typ produktu:
harmonogram + komunikacja + edukacja + punkty zbiórki.


Źródło:
https://segrego.pl/


7. WASTE24 / MOJE ODPADY


Typ produktu:
system gospodarki odpadami i komunikacji.


Znaczenie:
Benchmark dla warstwy operatorskiej i B2G.


8. ekoGMINA


Zaobserwowany stan aplikacji 27.08.2026:
selektor w aplikacji iOS pokazywał „Gmina Demonstracyjna” oraz Zebrzydowice. Wygląda to bardziej na pojedyncze/lokalne wdrożenie niż platformę ogólnopolską.


Deklarowane funkcje obejmują m.in. harmonogram, PSZOK, punkty kaucyjne i informacje odpadowe.


Znaczenie:
Potwierdza, że zestaw funkcji sam w sobie nie jest USP. Przewagą WastePL musi być agregacja i pokrycie.


Źródła:
https://apps.apple.com/pl/app/ekogmina/id6748901295
https://zebrzydowice.pl/


9. APLIKACJE / MAPY SYSTEMU KAUCYJNEGO


Przykłady:
• Butelkomat: Kaucja i Zwroty,
• Kaucyjka,
• Zakaucjowani.


Kaucyjka:
https://kaucyjka.pl/mapa-punktow


Zakaucjowani:
https://zakaucjowani.pl/


Wniosek:
Sama mapa butelkomatów nie jest wystarczającym USP. W WastePL powinna być częścią większego kontekstu odpadowego.


10. SYSTEM KAUCYJNY — DANE RYNKOWE


Do dalszej weryfikacji i okresowej aktualizacji:
Ministerstwo Klimatu i Środowiska publikuje informacje o działaniu systemu kaucyjnego.


Źródło główne:
https://www.gov.pl/web/klimat/system-kaucyjny


W researchu z sierpnia 2026 pojawiały się dane o ok. 64 tys. punktów zwrotu i automatach w ok. 14 tys. lokalizacji. Te liczby są dynamiczne i przed wykorzystaniem w materiałach sprzedażowych powinny być ponownie zweryfikowane.


11. PSZOK — PODSTAWA PRAWNA


Gminy mają obowiązki informacyjne dotyczące PSZOK i gospodarowania odpadami.


Źródło aktu prawnego:
https://eli.gov.pl/api/acts/DU/2024/399/text.html


Do utrzymania w researchu:
• obowiązek informowania o lokalizacji PSZOK,
• rodzajach przyjmowanych odpadów,
• dniach i godzinach działania,
• zasadach zgłaszania problemów z usługą odbioru.


Każdą tezę prawną przed ofertą/przetargiem należy odnieść do aktualnego tekstu jednolitego i konkretnego stanu prawnego.


12. OTWARTE DANE I PONOWNE WYKORZYSTYWANIE


Punkt startowy:
https://www.gov.pl/web/nauka/ponowne-wykorzystywanie-informacji-sektora-publicznego


Założenie strategiczne:
WastePL powinien prowadzić dla każdego źródła rejestr podstawy ponownego użycia, warunków atrybucji i ewentualnych ograniczeń.


Nie zakładamy automatycznie, że każdy publicznie dostępny endpoint prywatnego dostawcy można wykorzystywać komercyjnie.


13. PRG — PAŃSTWOWY REJESTR GRANIC


Kluczowe źródło dla resolvera adresowego.


Źródło:
https://www.geoportal.gov.pl/pl/dane/panstwowy-rejestr-granic-prg/


Znaczenie:
• punkty adresowe,
• geolokalizacja,
• możliwość powiązania adresu użytkownika z jednostką administracyjną,
• brak konieczności budowania własnej bazy adresów od zera.


14. TERYT / API GUS


Źródło:
https://api.stat.gov.pl/Home/TerytApi


Kluczowe rejestry:
• TERC,
• SIMC,
• ULIC.


Znaczenie:
Stałe oficjalne identyfikatory dla jednostek, miejscowości i ulic.


15. GTFS — INSPIRACJA STANDARDYZACYJNA


Źródło:
https://gtfs.org/documentation/overview/


Dlaczego ważne:
GTFS pokazuje, że prosty otwarty standard może zunifikować dane pochodzące od setek niezależnych operatorów i umożliwić powstanie całego ekosystemu aplikacji.


WastePL powinien dążyć do analogicznego efektu dla gospodarki odpadami.


16. LUKSEMBURG — CONSOLIDATED WASTE DATA


Źródła:
https://data.public.lu/en/datasets/waste-municipal-waste-collection-calendars-dechets-calendriers-municipaux-de-collecte-des-dechets/
https://data.europa.eu/data/datasets/consolidated-waste-pickup-calendar


Znaczenie:
Dowód, że harmonogramy różnych gmin można agregować i normalizować do wspólnego datasetu.


17. OPENErz — SZWAJCARIA


Źródło:
https://github.com/metaodi/openerz


Znaczenie:
Open-source'owy przykład agregacji danych odpadowych z różnych źródeł, w tym CSV/ICS i innych mechanizmów.


Warto przeanalizować:
• model adapterów,
• licencję,
• architekturę,
• sposób udostępniania API/kalendarzy.


18. PRZYKŁADOWE ŹRÓDŁA GMINNE DO TESTÓW


Warszawa:
https://warszawa19115.pl/harmonogramy-wywozu-%20odpadow


Kraków:
https://mpo.krakow.pl/harmonogram-odbioru/


Wrocław:
https://ekosystem.wroc.pl/


Gdańsk:
https://czystemiasto.gdansk.pl/harmonogram-odbioru-odpadow/


Poznań:
https://www.poznan.pl/odpady/


Słupsk:
https://pgkslupsk.pl/harmonogram-odbioru-odpadow


Białystok:
https://www.bialystok.pl/pl/dla_mieszkancow/gospodarowanie-odpadami/


Olsztyn:
https://czysty.olsztyn.eu/


Koszalin / PGK:
https://www.pgkkoszalin.pl/


Sianów:
https://sianow.pl/


Bobolice:
https://bobolice.pl/


Świeszyno:
https://swieszyno.pl/


Kobierzyce:
https://www.ugk.pl/harmonogram-odbioru


19. OBSERWACJE Z REGIONU KOSZALINA


Region jest dobrym pilotem, ponieważ występują jednocześnie:
• regularne PDF,
• dokumenty obrazowe,
• strony HTML,
• rejony i sektory,
• przypisanie do tras,
• konkretne numery posesji,
• zmiany harmonogramów w trakcie roku.


To pozwala przetestować większość kluczowych typów problemów bez rozpraszania pilota geograficznie.


20. MODEL MONITORINGU KONKURENCJI


Co kwartał sprawdzać dla głównych konkurentów:
• liczba obsługiwanych gmin,
• aktywność aplikacji,
• nowe funkcje,
• PSZOK,
• system kaucyjny,
• dostępność publicznego API,
• nowe kontrakty JST,
• cenniki / rejestry umów,
• partnerstwa operatorskie.


21. MODEL MONITORINGU RYNKU


Monitorować:
• nowe obowiązki JST,
• zmiany ustawy odpadowej,
• zmiany systemu kaucyjnego,
• programy dofinansowań,
• digitalizację usług publicznych,
• otwarte dane GUGiK/GUS,
• nabory PARP/NFOŚiGW/Fundusze Europejskie,
• zamówienia publiczne na systemy odpadowe.


22. POTENCJALNE ŹRÓDŁA FINANSOWANIA — DO MONITOROWANIA


• PARP — programy startupowe i akceleracyjne,
• Fundusze Europejskie dla regionów,
• programy cyfryzacji JST,
• NFOŚiGW/WFOŚiGW,
• projekty gospodarki obiegu zamkniętego,
• granty związane z open data / smart city,
• finansowanie pilota wspólnie z JST lub operatorem.


Wniosek:
Nie ograniczać się do pytania „czy WastePL może dostać dotację”. Drugim modelem jest sytuacja, w której beneficjentem środków jest JST/operator, a WastePL jest dostawcą technologii.


23. PYTANIA DO DALSZEGO RESEARCHU


• Czy istnieje państwowa inicjatywa standaryzacji harmonogramów odpadowych, której nie wykryliśmy?
• Czy operatorzy systemu kaucyjnego udostępniają partnerom API lokalizacji punktów?
• Czy można uzyskać kompletne publiczne listy PSZOK dla województw bez crawlowania każdej gminy?
• Jakie są warunki ponownego użycia danych konkretnych operatorów komunalnych?
• Jakie są najbardziej powtarzalne CMS-y i platformy JST — można stworzyć adapter per platforma zamiast per gmina?
• Jaki procent gmin używa EcoHarmonogram/mMieszkaniec/innych dostawców?
• Czy da się pozyskać harmonogramy bezpośrednio od największych operatorów odpadowych?
• Czy związki międzygminne są lepszym kanałem sprzedaży niż pojedyncze JST?


24. ZASADA ŹRÓDŁOWA WASTEPL


Każda informacja trafiająca do produktu powinna odpowiadać na cztery pytania:
1. Skąd to wiemy?
2. Kiedy źródło zostało pobrane/opublikowane?
3. Czy źródło jest oficjalne?
4. Jak pewni jesteśmy interpretacji?


Jeżeli nie potrafimy na nie odpowiedzieć, danych nie należy traktować jako produkcyjnych.
