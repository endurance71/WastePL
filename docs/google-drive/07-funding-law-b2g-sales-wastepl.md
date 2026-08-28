<!-- Source: https://docs.google.com/document/d/1bncsrjrg7XNSeR5tuPaDlF9Hx7v_P6V4ZMBjwHpF4yg/edit -->
<!-- Local snapshot: 2026-08-28 -->

# 07 — Finansowanie, prawo i sprzedaż B2G — WastePL

[Oryginał w Google Docs](https://docs.google.com/document/d/1bncsrjrg7XNSeR5tuPaDlF9Hx7v_P6V4ZMBjwHpF4yg/edit)

WastePL — Finansowanie, prawo i sprzedaż B2G
Wersja: 0.1
Data: 27.08.2026


1. Cel dokumentu
Zebrać założenia finansowania projektu, model sprzedaży do JST/operatorów oraz obszary prawne wymagające stałej weryfikacji. Dokument nie zastępuje opinii prawnej ani podatkowej.


2. Model przychodowy
Warstwa B2C powinna pozostać bezpłatna i służyć budowie zasięgu oraz danych o wykorzystaniu. Główne przychody powinny pochodzić z B2G i B2B.


Proponowane linie przychodowe:
• WastePL Verified dla gmin
• panel administracyjny i komunikaty push
• widget na stronę gminy
• obsługa zgłoszeń mieszkańców
• raporty i statystyki
• white-label dla operatorów odpadowych
• API dla aplikacji miejskich, zarządców nieruchomości i integratorów
• integracje danych systemu kaucyjnego
• onboarding/import danych i integracje niestandardowe


3. Orientacyjne pakiety do walidacji rynkowej
Nie traktować jako finalny cennik.
Starter B2G: 3–6 tys. zł / rok
Pro B2G: 8–15 tys. zł / rok
Wdrożenie/import: 2–10 tys. zł jednorazowo
Operator/white-label/API: wycena indywidualna, od kilkunastu/kilkudziesięciu tys. zł rocznie zależnie od skali i SLA.


Najważniejsze: harmonogram sam w sobie jest tanim produktem. Cena musi wynikać z pełnej platformy: Verified + komunikacja + dane + API + obsługa + analityka.


4. Strategia sprzedaży do gmin
Najmocniejszy model nie zaczyna się od „kupcie naszą aplikację”.


Etap 1: WastePL publikuje profil gminy na podstawie oficjalnych danych publicznych.
Etap 2: mieszkańcy zaczynają korzystać z profilu.
Etap 3: gmina otrzymuje możliwość bezpłatnego zgłoszenia własności/administracji profilu.
Etap 4: płatne funkcje Verified/Pro: bezpośrednia aktualizacja, komunikaty, push, widget, SLA, statystyki, zgłoszenia.


Pitch B2G:
„Wasze dane są już dostępne mieszkańcom w jednym ogólnopolskim standardzie. Możecie oficjalnie nimi zarządzać i otrzymać kanał komunikacji bez wymuszania kolejnej osobnej aplikacji tylko dla jednej gminy.”


5. Zakupy publiczne
Od 1 stycznia 2026 próg stosowania Prawa zamówień publicznych został podniesiony do 170 000 zł netto. Nie oznacza to braku procedur poniżej progu — JST nadal stosują regulaminy zakupowe, zasady gospodarności i prawidłowe szacowanie wartości zamówienia.
Źródło do bieżącej weryfikacji: https://www.gov.pl/web/uzp/


W praktyce roczna usługa SaaS za kilka–kilkanaście tys. zł może być znacznie prostsza sprzedażowo niż duży system IT, ale sposób zakupu zależy od regulaminu konkretnej JST i wartości całego zamówienia.


6. Otwarte dane i ponowne wykorzystanie
Założenie produktu: korzystamy wyłącznie ze źródeł, dla których istnieje legalna podstawa pozyskania i ponownego wykorzystania. Dla każdego Source Registry przechowujemy:
• reuse_basis
• owner
• attribution_required
• commercial_use_status
• terms_url
• notes


Nie opieramy produktu na reverse engineeringu prywatnych, nieudokumentowanych API konkurentów.


7. Dane publiczne i BIP
Informacje sektora publicznego mogą podlegać ponownemu wykorzystaniu zgodnie z ustawą o otwartych danych i ponownym wykorzystywaniu informacji sektora publicznego. Warunki mogą obejmować m.in. obowiązek wskazania źródła lub informacji o modyfikacji.
Źródło informacyjne: https://www.gov.pl/web/cyfryzacja/otwarte-dane
Teksty aktów prawnych: https://eli.gov.pl/


8. RODO
Podstawowe publiczne WastePL może działać bez tworzenia profilu użytkownika. Minimalizujemy dane osobowe.


Jeśli użytkownik zapisuje adres w koncie, należy zaprojektować:
• jasny cel przetwarzania
• minimalizację danych
• retencję
• szyfrowanie
• możliwość usunięcia konta i danych
• oddzielenie publicznej bazy adresowej od danych konkretnego użytkownika
• DPIA, jeśli zakres funkcji lub profilowania będzie tego wymagał


Adres nieruchomości nie zawsze sam w sobie identyfikuje osobę, ale po połączeniu z kontem użytkownika może stać się daną osobową — projektujemy system konserwatywnie.


9. Odpowiedzialność za błędne dane
WastePL musi jednoznacznie pokazywać:
• źródło
• czas ostatniej aktualizacji
• status Verified / public source
• możliwość zgłoszenia błędu


Dla danych niezweryfikowanych przez gminę nie należy sugerować, że WastePL jest oficjalnym komunikatem JST. Kluczowa jest szybka korekta i historia zmian.


10. Finansowanie rozwoju
Potencjalne kierunki:
• PARP — programy startupowe/akceleracyjne
• Fundusze Europejskie dla Polski Wschodniej, jeśli spełnione są warunki lokalizacyjne i formalne
• Startup Booster / programy akceleracyjne kolejnych edycji
• regionalne programy gospodarki odpadami i e-usług — częściej jako źródło finansowania klienta JST niż bezpośrednia dotacja dla WastePL
• NFOŚiGW/WFOŚiGW — do obserwacji programów związanych z gospodarką odpadową, edukacją i cyfryzacją
• GovTech / programy pilotażowe administracji
• granty badawczo-rozwojowe, jeśli powstanie rzeczywisty komponent R&D w ekstrakcji/normalizacji danych


Każdy program należy oceniać na dzień składania wniosku; nabory i warunki szybko się zmieniają.


11. Strategia finansowania rekomendowana na start
Nie czekać na dotację, aby zbudować PoC.


Etap 1 — bootstrap: WastePL Schema + 8 gmin + API + web PoC.
Etap 2 — pilot z 1–3 JST/operatorami, najlepiej z listem intencyjnym lub płatnym małym wdrożeniem.
Etap 3 — dopiero wtedy aplikacja o dotację/akcelerację z potwierdzonym problemem, działającym produktem i metrykami.


12. Materiały potrzebne do grantów/inwestora
• one-pager projektu
• problem i fragmentacja rynku
• mapa konkurencji
• PoC 8–20 gmin
• accuracy i automation rate
• architektura WastePL Standard
• strategia całej Polski
• model B2G/B2B
• listy intencyjne
• budżet 12–18 miesięcy
• ryzyka prawne i plan ich ograniczenia


13. Partnerzy strategiczni do rozważenia
• gminy i związki międzygminne
• przedsiębiorstwa komunalne/operatorzy odbioru
• Związek Miast Polskich / organizacje JST
• GUGiK/GUS w zakresie standardów adresowych
• Ministerstwo Klimatu i Środowiska
• Ministerstwo Cyfryzacji / GovTech
• operatorzy systemu kaucyjnego
• producenci RVM/butelkomatów
• zarządcy nieruchomości


14. Najważniejsza zasada biznesowa
WastePL nie może stać się firmą ręcznie przepisującą harmonogramy dla tysięcy gmin. Model jest atrakcyjny tylko wtedy, gdy onboarding źródła kosztuje relatywnie dużo jednorazowo, a późniejsze utrzymanie jest niemal w pełni automatyczne.


15. Checklista przed pierwszą sprzedażą B2G
• regulamin i polityka prywatności
• warunki korzystania z danych
• DPA/umowa powierzenia, jeśli wystąpią dane osobowe po stronie gminy
• SLA
• procedura korekty błędnych danych
• procedura bezpieczeństwa
• backup i disaster recovery
• regulamin zamówienia klienta sprawdzony
• jasny zakres licencji/usługi SaaS
• określona odpowiedzialność za źródła danych
WASTEPL — FINANSOWANIE, PRAWO I SPRZEDAŻ B2G


Data: 27.08.2026
Status: wersja robocza v0.1


UWAGA
Ten dokument jest materiałem strategicznym, nie opinią prawną ani gwarancją kwalifikowalności wydatków. Przed złożeniem wniosku lub ofertą dla JST należy zweryfikować aktualny regulamin naboru, stan prawny i zasady konkretnej jednostki.


1. CEL


WastePL może być finansowany i monetyzowany kilkoma ścieżkami jednocześnie:
• jako startup technologiczny,
• jako dostawca oprogramowania dla JST,
• jako dostawca danych/API,
• jako element większych projektów odpadowych, GOZ, smart-city lub cyfryzacji usług publicznych.


2. NAJBARDZIEJ INTERESUJĄCY MODEL


Nie ograniczamy się do pytania:
„Czy WastePL dostanie dotację?”


Drugi model może być ważniejszy:
„Gmina, związek międzygminny lub operator pozyskuje środki, a WastePL jest dostawcą technologii.”


Daje to dwie równoległe strategie:
A. finansowanie rozwoju własnego produktu,
B. finansowanie zakupów po stronie klientów.


3. PLATFORMY STARTOWE — KOMPONENT IIa


Stan zweryfikowany 27.08.2026:
PARP prowadzi nabór FEPW.01.01 Platformy startowe dla nowych pomysłów, Komponent IIa — Wsparcie rozwoju działalności gospodarczej startupu.


Maksymalne dofinansowanie: 600 000 zł.
Koniec naboru: 17.09.2026.
Obszar: Polska Wschodnia.


Istotne ograniczenie:
Program jest przeznaczony dla startupów, które przeszły właściwą ścieżkę inkubacji Platform Startowych; nie jest to prosty nabór typu „mam dziś pomysł i składam jutro wniosek”.


Źródła:
https://www.parp.gov.pl/component/grants/grants/2023-platformy-startowe-dla-nowych-pomyslow-komponent-iia---wsparcie-rozwoju-dzialalnosci-gospodarczej-startupu
https://fepw.parp.gov.pl/component/programs/program/fepw


4. PLATFORMY STARTOWE — INKUBACJA


PARP wskazuje również ścieżkę Platform Startowych dla nowych pomysłów z naborem trwającym do 10.05.2027.


Znaczenie dla WastePL:
Jeżeli projekt spełni kryteria terytorialne i organizacyjne, ścieżka inkubacja → komponent IIa może być istotna dla kolejnej rundy rozwoju.


Źródło:
https://fepw.parp.gov.pl/component/programs/program/fepw


5. LABORATORIUM INNOWATORA


Stan zweryfikowany 27.08.2026:
PARP wskazuje nabór FENG 2.27 Laboratorium Innowatora do 15.09.2026.


Charakter wsparcia:
• wsparcie eksperckie,
• mentoring,
• walidacja pomysłu i modelu biznesowego.


Nie należy traktować tego jako równoważnika 600 tys. zł dotacji gotówkowej.


Źródło:
https://www.parp.gov.pl/component/site/site/4startups


6. STARTUP BOOSTER POLAND


Programy Startup Booster należy dalej monitorować, ale aktualne ścieżki i operatorzy zmieniają się w czasie.


Na 27.08.2026 część wcześniejszych naborów Smart UP jest już zamknięta. Nie wpisujemy do modelu finansowego środków z zamkniętego naboru jako dostępnego finansowania.


Źródło do monitoringu:
https://www.parp.gov.pl/component/site/site/4startups


7. FUNDUSZE REGIONALNE — GOSPODARKA ODPADAMI


Przykład potwierdzający skalę środków w sektorze:
Fundusze Europejskie dla Pomorza Zachodniego — Działanie 2.18 Gospodarowanie odpadami komunalnymi.


W czerwcu 2026 alokacja naboru została podwyższona do 42 541 045,71 zł, co umożliwiło sfinansowanie wszystkich pozytywnie ocenionych projektów w tym naborze.


Ten konkretny nabór nie oznacza automatycznie, że „aplikacja WastePL” kwalifikuje się jako samodzielny projekt. Pokazuje jednak, że sektor gospodarki odpadowej ma znaczące finansowanie regionalne i należy analizować możliwość włączenia warstwy cyfrowej do większych projektów JST/operatora.


Źródło:
https://funduszeue.wzp.pl/lista_nabory/2-18-gospodarowanie-odpadami-komunalnymi-2/


8. INNE KIERUNKI FINANSOWANIA DO MONITOROWANIA


• cyfryzacja JST,
• e-usługi publiczne,
• smart city,
• gospodarka obiegu zamkniętego,
• edukacja ekologiczna,
• otwarte dane,
• NFOŚiGW,
• WFOŚiGW,
• Fundusze Europejskie dla regionów,
• programy akceleracyjne,
• projekty badawczo-rozwojowe — jeśli WastePL będzie zawierał rzeczywisty komponent B+R.


9. PRAWO ZAMÓWIEŃ PUBLICZNYCH — PRÓG


Od 2026 próg stosowania ustawy Prawo zamówień publicznych dla klasycznych zamówień został podniesiony z 130 000 zł do 170 000 zł.


Znaczenie:
Licencja WastePL za kilka lub kilkanaście tysięcy zł rocznie sama w sobie znajduje się znacznie poniżej tego progu.


Nie oznacza to jednak „zakupu bez procedury”. Gmina nadal działa według:
• własnego regulaminu zakupowego,
• zasad gospodarności,
• rozeznania rynku,
• reguł dotyczących prawidłowego szacowania wartości zamówienia,
• zasad łączenia zamówień i umów wieloletnich.


Źródło UZP:
https://www.gov.pl/web/uzp/podwyzszenie-progu-stosowania-ustawy-prawo-zamowien-publicznych-i-ustawy-o-umowie-koncesji-na-roboty-budowlane-lub-uslugi


10. STRATEGIA CENOWA B2G


Nie budować oferty wokół „taniego harmonogramu”.


Produkt podstawowy może mieć niską barierę wejścia, ale wartość powinna wynikać z:
• oficjalnego profilu gminy,
• weryfikacji danych,
• panelu,
• komunikatów push,
• widgetu WWW,
• PSZOK,
• zgłoszeń,
• analityki,
• API,
• integracji operatorskich.


Proponowany kierunek do walidacji:
BASIC: kilka tys. zł/rok.
PRO: około 8–15 tys. zł/rok.
ENTERPRISE / operator / związek gmin: wycena indywidualna.


To są hipotezy cenowe, nie gotowy cennik.


11. SPRZEDAŻ DO GMINY — MODEL „CLAIM YOUR PROFILE”


Najbardziej obiecujący model:
1. WastePL agreguje publiczne dane gminy bez czekania na kontrakt.
2. Mieszkańcy korzystają z WastePL.
3. Gmina widzi swój istniejący profil.
4. Otrzymuje możliwość przejęcia i weryfikacji profilu.
5. Darmowa/niska warstwa verified może prowadzić do płatnego PRO.


To zmienia rozmowę sprzedażową z:
„Czy kupicie nową aplikację?”
na:
„Wasze oficjalne informacje są już dostępne w jednym ogólnopolskim standardzie. Możecie nimi bezpośrednio zarządzać i komunikować się z mieszkańcami.”


12. KANAŁY SPRZEDAŻY B2G


• bezpośrednio do urzędu gminy/miasta,
• referat gospodarki komunalnej / ochrony środowiska,
• spółka komunalna,
• operator odbioru odpadów,
• związki międzygminne,
• organizacje samorządowe,
• partner integracyjny obsługujący strony i systemy JST.


13. ZWIĄZKI MIĘDZYGMINNE


To może być szczególnie efektywny kanał.


Zamiast sprzedawać kolejno do kilku/kilkunastu gmin, związek może:
• koordynować gospodarkę odpadową,
• mieć wspólnego operatora/system,
• posiadać jednolite źródła danych,
• zapewnić większy kontrakt przy niższym CAC na gminę.


W feasibility biznesowym należy zidentyfikować związki odpadowe i sprawdzić, gdzie zarządzają harmonogramami centralnie.


14. PARTNERSTWA Z OPERATORAMI ODPADÓW


Potencjalnie ważniejsze niż 2479 indywidualnych integracji.


Jeżeli jeden operator obsługuje wiele gmin, integracja operatorska może dostarczyć:
• harmonogramy,
• strefy,
• zmiany,
• komunikaty,
• docelowo wykonanie tras/realtime.


Cel długoterminowy:
przejść od scrapowania publicznego harmonogramu do oficjalnego feedu partnerskiego tam, gdzie WastePL osiągnie skalę.


15. PRAWA DO DANYCH I PONOWNE WYKORZYSTYWANIE


Dla każdego Source Registry przechowujemy:
• source owner,
• source URL,
• public/official status,
• reuse basis,
• attribution requirements,
• warunki modyfikacji,
• warunki komercyjnego wykorzystania,
• datę ostatniego przeglądu warunków.


Nie traktujemy prywatnego API konkurencyjnej aplikacji jako źródła tylko dlatego, że można je technicznie wywołać.


16. BIP I OFICJALNE PUBLIKACJE


Priorytet źródeł:
1. bezpośredni oficjalny feed/API partnera,
2. oficjalne dane gminy/BIP,
3. oficjalne dane operatora,
4. inne publiczne źródła,
5. community — wyłącznie jako sygnał lub uzupełnienie.


17. ODPOWIEDZIALNOŚĆ ZA JAKOŚĆ DANYCH


WastePL powinien jawnie pokazywać:
• źródło,
• datę aktualizacji,
• status weryfikacji.


W przypadku konfliktu danych system powinien:
• nie ukrywać problemu,
• wskazać źródło o wyższym authority level,
• uruchomić review,
• nie wysyłać krytycznych powiadomień przy niepewnych danych.


18. MODEL PILOTA Z JST


Idealny pilot po technicznym POC:
• 1–3 gminy,
• 3 miesiące,
• oficjalne dane,
• panel verified,
• widget na stronę,
• push/komunikaty,
• statystyki.


Warunki pilota powinny pozwolić zmierzyć:
• liczbę użytkowników,
• spadek pytań o harmonogram,
• liczbę zgłoszeń,
• czas aktualizacji informacji,
• jakość danych,
• wartość dla urzędu.


19. PITCH DLA GMINY — RDZEŃ


„Nie sprzedajemy kolejnej zamkniętej aplikacji wymagającej od mieszkańca instalowania osobnego systemu dla każdej gminy. WastePL tworzy wspólną warstwę danych, dzięki której harmonogram, PSZOK i komunikaty są dostępne w jednym standardzie. Gmina może zweryfikować swój profil i zarządzać oficjalnymi informacjami bez rezygnowania z obecnych systemów.”


20. PITCH DLA OPERATORA


„Integrujemy dane operatora raz i udostępniamy je mieszkańcom wielu gmin przez jeden standard. Operator ogranicza chaos PDF-ów, powtarzalne pytania i wielokrotne integracje z aplikacjami.”


21. PITCH DLA ADMINISTRACJI CENTRALNEJ / ORGANIZACJI SAMORZĄDOWYCH


„WastePL proponuje otwarty standard wymiany danych odpadowych podobny koncepcyjnie do GTFS. Standard może być implementowany przez różnych dostawców, a komercyjne usługi WastePL są jedną z implementacji.”


22. CO WERYFIKOWAĆ PRZED KAŻDĄ SPRZEDAŻĄ


• aktualny próg i procedury zakupowe,
• regulamin zamówień konkretnej JST,
• sposób szacowania wartości wieloletniej umowy,
• obowiązki RODO przy kontach mieszkańców i zgłoszeniach,
• warunki ponownego użycia źródeł,
• zakres odpowiedzialności za aktualność harmonogramu,
• SLA,
• wymagania WCAG dla usług publicznych,
• cyberbezpieczeństwo i wymagania podmiotu publicznego,
• hosting/lokalizacja danych — jeśli pojawi się wymóg kontraktowy.


23. REKOMENDACJA


Na tym etapie finansowanie nie powinno blokować budowy POC.


Najpierw trzeba udowodnić:
• poprawność danych,
• koszt onboardingu,
• możliwość automatyzacji.


Równolegle:
• monitorować PARP i fundusze regionalne,
• przygotować one-pager dla JST,
• znaleźć 1–3 potencjalne gminy pilotażowe,
• zbadać związki międzygminne i operatorów w regionie.


Dopiero z działającym POC WastePL będzie miał znacznie silniejszą pozycję we wnioskach grantowych i rozmowach B2G.
