<!-- Source: https://docs.google.com/document/d/1q46FT76ah1lJ47J04lOLBEZB2X56898Vu7Rh2F2_Jg8/edit -->
<!-- Local snapshot: 2026-08-28 -->

# 02 — Produkt, MVP i model biznesowy — WastePL

[Oryginał w Google Docs](https://docs.google.com/document/d/1q46FT76ah1lJ47J04lOLBEZB2X56898Vu7Rh2F2_Jg8/edit)

WASTEPL — PRODUKT, MVP I MODEL BIZNESOWY


Data: 27.08.2026
Status: wersja robocza v0.1


1. POZYCJONOWANIE


WastePL nie powinien być komunikowany jako „kolejna aplikacja do śmieci”.


Pozycjonowanie:
„Ogólnopolska warstwa danych odpadowych dla mieszkańców, gmin i operatorów.”


Najważniejsza różnica względem obecnych aplikacji:
• nie wymagamy, aby gmina była klientem,
• użytkownik może korzystać z systemu w dowolnej gminie objętej agregacją,
• źródła danych są normalizowane ponad istniejącymi systemami,
• jedna aplikacja działa przy przeprowadzce pomiędzy gminami.


2. PROBLEM UŻYTKOWNIKA


Dziś mieszkaniec często musi:
• szukać PDF na stronie gminy,
• znać nazwę rejonu lub sektora,
• instalować aplikację konkretnego dostawcy,
• sprawdzać osobno PSZOK,
• szukać butelkomatu w innej aplikacji,
• czytać regulamin, aby ustalić gdzie oddać konkretny odpad,
• śledzić komunikaty gminy o zmianach harmonogramu.


WastePL ma zamienić ten proces na jedno pytanie:
„Gdzie mieszkasz?”


3. GŁÓWNE JOBS TO BE DONE


JTBD 1
„Chcę wiedzieć, jakie odpady są odbierane jutro z mojego adresu.”


JTBD 2
„Chcę dostać przypomnienie dzień wcześniej.”


JTBD 3
„Chcę wiedzieć, gdzie oddać konkretny odpad.”


JTBD 4
„Chcę znaleźć najbliższy PSZOK i sprawdzić, czy mogę tam oddać dany przedmiot.”


JTBD 5
„Chcę znaleźć najbliższy punkt zwrotu kaucji / butelkomat.”


JTBD 6
„Chcę wiedzieć, czy harmonogram się zmienił.”


4. MVP — WARSTWA DANYCH


MVP powinno obejmować:
• gminę,
• adres / strefę,
• frakcje odpadów,
• daty odbioru,
• źródło,
• wersję danych,
• confidence,
• PSZOK,
• podstawowe komunikaty.


Nie jest wymagane w pierwszej wersji:
• pełna mapa punktów kaucyjnych,
• aplikacja mobilna,
• konta mieszkańców,
• AI do rozpoznawania odpadów,
• rozbudowany panel gminy,
• rozliczenia.


5. MVP — WEB


Pierwszy interfejs użytkownika powinien być prostą aplikacją webową/PWA.


Ekran startowy:
• pole adresu,
• sugestie adresowe,
• automatyczne rozpoznanie gminy.


Widok wyniku:
• najbliższy odbiór,
• kolejne terminy,
• kolory/frakcje,
• źródło danych,
• data ostatniej aktualizacji,
• status danych,
• link do oficjalnego źródła,
• najbliższy PSZOK.


6. APLIKACJA MOBILNA — ETAP PÓŹNIEJSZY


Po potwierdzeniu jakości danych aplikacja mobilna powinna oferować:
• zapis wielu adresów,
• push przed odbiorem,
• widget systemowy,
• kalendarz odbiorów,
• mapę PSZOK i punktów zbiórki,
• system kaucyjny,
• „gdzie wyrzucić?”,
• zgłoszenia problemów,
• komunikaty lokalne.


7. FUNKCJA „GDZIE WYRZUCIĆ?”


Wejście:
• wyszukiwanie tekstowe,
• kategorie,
• opcjonalnie zdjęcie przedmiotu.


Wyjście:
• właściwa frakcja,
• możliwość oddania do PSZOK,
• najbliższe punkty specjalne,
• lokalne ograniczenia i limity,
• źródło informacji.


AI może wspomagać klasyfikację, ale wynik powinien być oparty na zweryfikowanej bazie zasad, nie na samej odpowiedzi modelu językowego.


8. PSZOK


Widok punktu:
• nazwa,
• adres,
• lokalizacja GPS,
• godziny otwarcia,
• status „otwarte teraz”,
• lista przyjmowanych odpadów,
• limity,
• wymagane dokumenty,
• kto może korzystać,
• link/nawigacja,
• oficjalne źródło.


9. SYSTEM KAUCYJNY


Mapa powinna obejmować nie tylko butelkomaty, ale wszystkie punkty zwrotu:
• automat / RVM,
• zwrot ręczny,
• PET,
• puszki,
• szkło wielorazowe,
• godziny,
• status punktu,
• operator/system.


Docelowa przewaga: agregacja punktów wielu operatorów w jednej mapie.


10. ZGŁOSZENIA MIESZKAŃCÓW


Potencjalny moduł B2G:
• niewywiezione odpady,
• przepełniony pojemnik,
• dzikie wysypisko,
• problem z PSZOK,
• awaria punktu kaucyjnego — jeśli partner udostępnia obsługę zgłoszeń.


Flow:
zdjęcie → adres/lokalizacja → typ problemu → ticket → status → zamknięcie.


11. MODELE KLIENTÓW


A. Mieszkaniec — B2C
Cel: maksymalne pokrycie i retencja.
Cena: bezpłatnie.


B. Gmina/JST — B2G
Produkt: WastePL Verified + panel administracyjny.


C. Operator odpadów — B2B
Produkt: integracja danych, API, komunikaty, obsługa tras/stref i zgłoszeń.


D. Zarządcy nieruchomości / wspólnoty / deweloperzy
Produkt: API, widgety, komunikaty dla wielu nieruchomości.


E. Operatorzy systemu kaucyjnego i retail
Produkt: warstwa discovery, mapa, API lokalizacji i ewentualnie status dostępności.


12. MONETYZACJA B2G


Przykładowa struktura pakietów — do walidacji rynkowej:


BASIC
• oficjalny profil gminy,
• aktualizacja harmonogramu,
• PSZOK,
• widget WWW,
• podstawowe statystyki.


PRO
• komunikaty push,
• alerty awaryjne,
• zgłoszenia mieszkańców,
• zaawansowane statystyki,
• eksport danych,
• integracje.


ENTERPRISE / ZWIĄZEK GMIN
• wiele gmin,
• operatorzy,
• SLA,
• integracje API,
• white-label,
• dedykowane raporty.


Orientacyjne widełki do dalszej walidacji:
• mała gmina: kilka tys. zł rocznie,
• średnia gmina: 8–15 tys. zł rocznie,
• większa JST/operator: indywidualnie,
• wdrożenie/import/migracja: opłata jednorazowa.


Nie należy konkurować wyłącznie ceną harmonogramu. Wartość ma pochodzić z całego systemu danych i komunikacji.


13. MONETYZACJA DATA/API


Potencjalnie największa wartość długoterminowa.


Możliwe modele:
• darmowy tier z limitem zapytań,
• abonament API,
• rozliczenie usage-based,
• licencja enterprise,
• SLA i wyższa świeżość danych,
• bulk dataset,
• webhooki zmian,
• white-label.


Potencjalni odbiorcy:
• aplikacje smart-city,
• property management,
• Home Assistant / smart home,
• portale lokalne,
• aplikacje deweloperów,
• operatorzy odpadów,
• logistyka,
• retail,
• systemy kaucyjne.


14. GO-TO-MARKET


Etap 1 — data-first
Budujemy pokrycie bez sprzedaży do gmin.


Etap 2 — użytkownicy
Uruchamiamy web/PWA i zdobywamy ruch lokalny i SEO.


Etap 3 — verified
Pokazujemy gminie:
„Wasze dane już są w WastePL i korzystają z nich mieszkańcy. Możecie przejąć oficjalny profil.”


Etap 4 — sprzedaż B2G/B2B
Panel, komunikaty, zgłoszenia, API i integracje.


15. SEO JAKO KANAŁ DYSTRYBUCJI


WastePL powinien generować indeksowalne strony lokalne, np.:
• harmonogram odpadów Bobolice,
• PSZOK Koszalin,
• gdzie oddać opony Sianów,
• gdzie wyrzucić telewizor Koszalin,
• butelkomat / punkt zwrotu kaucji w pobliżu.


To może zbudować organiczny network effect niezależnie od sklepów z aplikacjami.


16. CZEGO NIE ROBIMY NA START


• nie tworzymy white-label dla jednej gminy jako core produktu,
• nie uzależniamy pokrycia od kontraktów,
• nie budujemy reklamiarskiej aplikacji konsumenckiej,
• nie opieramy danych na crowdsourcingu jako jedynym źródle,
• nie opieramy biznesu na reverse engineeringu prywatnych API konkurencji,
• nie obiecujemy real-time bez oficjalnego źródła.


17. PRODUKTOWY NORTH STAR


„Procent mieszkańców Polski, dla których WastePL potrafi zwrócić poprawny, aktualny harmonogram dla konkretnego adresu.”


To jest ważniejsze niż liczba pobrań aplikacji na początku.
