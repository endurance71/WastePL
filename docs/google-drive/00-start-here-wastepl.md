<!-- Source: https://docs.google.com/document/d/1alQP3N8XaNFJmUQSTJLPgfgJgNwp8p5nM2nR50UkBK8/edit -->
<!-- Local snapshot: 2026-08-28 -->

# 00 — START HERE — WastePL

[Oryginał w Google Docs](https://docs.google.com/document/d/1alQP3N8XaNFJmUQSTJLPgfgJgNwp8p5nM2nR50UkBK8/edit)

WASTEPL — START HERE
Ogólnopolska warstwa danych o gospodarce odpadami


Status: koncepcja po wstępnym feasibility study
Data: 27.08.2026


1. CEL PROJEKTU


WastePL ma rozwiązać problem kompletnej fragmentacji informacji odpadowych w Polsce. Obecnie każda gmina publikuje harmonogramy i informacje w innym miejscu i formacie: PDF, XLSX, tabela HTML, obraz JPG, własna wyszukiwarka, aplikacja konkretnego dostawcy albo system operatora odpadów.


Celem nie jest stworzenie kolejnej aplikacji „kiedy śmieci”. Celem jest zbudowanie jednej ogólnopolskiej, znormalizowanej i wersjonowanej warstwy danych odpadowych, która działa niezależnie od tego, czy dana gmina jest klientem WastePL.


2. GŁÓWNA TEZA PRODUKTOWA


„Każda gmina. Jeden standard. Jedna warstwa danych.”


Użytkownik podaje adres, a system ustala:
• gminę, miejscowość i ulicę,
• właściwy rejon lub strefę odbioru,
• terminy odbioru poszczególnych frakcji,
• najbliższy PSZOK i zasady korzystania,
• najbliższe punkty zwrotu kaucji / butelkomaty,
• inne punkty zbiórki: elektroodpady, tekstylia, baterie, leki, gabaryty,
• aktualne komunikaty i zmiany harmonogramu.


3. NAJWAŻNIEJSZA ZASADA


Aplikacja i API muszą działać także wtedy, gdy gmina nie podpisała z nami umowy.


Dane mogą mieć dwa główne statusy:
• VERIFIED — dane bezpośrednio zatwierdzone lub aktualizowane przez gminę/operatora,
• OFFICIAL_SOURCE — dane automatycznie pozyskane z oficjalnego źródła publicznego.


4. CO JEST PRODUKTEM


WastePL składa się docelowo z kilku warstw:


A. WastePL Data Platform
Znormalizowana baza harmonogramów, stref, PSZOK, punktów kaucyjnych, komunikatów i źródeł.


B. WastePL API
Publiczne/komercyjne API dla aplikacji, gmin, operatorów, zarządców nieruchomości i innych systemów.


C. WastePL Web
Wyszukiwarka adresowa dostępna bez instalowania aplikacji, również jako powierzchnia SEO.


D. WastePL App
Jedna aplikacja iOS/Android dla mieszkańców całej Polski.


E. WastePL Panel
Panel dla gmin i operatorów do przejmowania profilu, aktualizacji danych, publikacji komunikatów i analityki.


F. WastePL Standard
Otwarta specyfikacja sposobu reprezentowania danych odpadowych. Standard powinien być open-source, natomiast hosting, panel, importer, API i aplikacje mogą być komercyjne.


5. GŁÓWNY MOAT


Przewagą nie będzie UI, AI ani sama aplikacja. Moatem ma być stale aktualizowana baza danych obejmująca całą Polskę wraz z:
• mapowaniem adresów do stref,
• historią zmian,
• adapterami do setek typów źródeł,
• wersjonowaniem,
• informacją o źródle i poziomie pewności,
• integracją z PRG i TERYT,
• relacjami z JST i operatorami.


6. KLUCZOWE WNIOSKI Z FEASIBILITY STUDY


• Fragmentacja jest duża, ale technicznie możliwa do opanowania.
• Najłatwiejsze źródła: API, XLSX, CSV, przewidywalne HTML i tekstowe PDF.
• Trudniejsze źródła: obrazy, skany, nietypowe PDF i częste zmiany rejonów.
• Największy problem nie polega na odczytaniu dat z PDF, lecz na poprawnym odwzorowaniu zakresu obowiązywania harmonogramu: miejscowości, ulice, zakresy numerów, wyjątki adresowe, typ zabudowy.
• Państwowe PRG i TERYT znacząco ograniczają koszt budowy własnej bazy adresowej.
• Dane PSZOK są łatwiejsze do agregacji niż harmonogramy, ponieważ gminy mają obowiązek publikować podstawowe informacje o tych punktach.
• Centralna mapa punktów kaucyjnych wymaga osobnej strategii i docelowo integracji B2B z operatorami systemu kaucyjnego.


7. PIERWSZY CEL TECHNICZNY


Nie zaczynamy od aplikacji mobilnej.


Pierwszy proof of concept:
• 8 gmin w rejonie Koszalina,
• WastePL Schema v0.1,
• Source Registry,
• adaptery PDF_TABLE, HTML i XLSX,
• integracja z PRG/TERYT,
• API GET /v1/collection?address=…,
• test na minimum 100 realnych adresach.


Warunek przejścia dalej: co najmniej 99% zgodności wyników z oficjalnymi harmonogramami dla danych objętych pilotem.


8. PILOTOWE GMINY


Proponowany zestaw:
• Koszalin,
• Bobolice,
• Sianów,
• Manowo,
• Świeszyno,
• Będzino,
• Polanów,
• Tychowo.


Ten zestaw daje w jednym regionie kilka typów problemów: sektory, PDF-y, HTML, obrazy, trasy, pojedyncze adresy, zmiany operatorów i różne formaty harmonogramów.


9. MODELE MONETYZACJI


B2C:
• darmowa aplikacja dla mieszkańca,
• bez reklam jako domyślne założenie.


B2G:
• WastePL Verified,
• panel gminy,
• push i komunikaty,
• statystyki,
• widget na stronę gminy,
• zgłoszenia mieszkańców,
• hosting i utrzymanie danych.


B2B/Data:
• płatne API,
• integracje dla operatorów odpadów,
• zarządcy nieruchomości,
• portale i aplikacje miejskie,
• systemy smart-home,
• white-label,
• integracje z operatorami systemu kaucyjnego.


10. DOKUMENTY W TYM FOLDERZE


00 — START HERE — WastePL
Główne założenia i indeks projektu.


01 — Feasibility Study — WastePL
Ocena realnych źródeł danych i wykonalności agregacji.


02 — Produkt, MVP i model biznesowy — WastePL
Zakres produktu, pozycjonowanie, model sprzedaży i monetyzacja.


03 — WastePL Data Standard v0.1
Pierwsza wersja modelu danych i zasad normalizacji.


04 — Architektura techniczna i pipeline danych — WastePL
Source Registry, adaptery, pipeline, walidacja, API i infrastruktura.


05 — Roadmap, pilot i metryki — WastePL
Plan dojścia od 8 gmin do skali ogólnopolskiej.


06 — Research, konkurencja i źródła — WastePL
Konkurencja, inspiracje zagraniczne i źródła do dalszej weryfikacji.


07 — Finansowanie, prawo i sprzedaż B2G — WastePL
Model sprzedaży do JST/operatorów, finansowanie, otwarte dane, RODO i ryzyka prawne.


11. DECYZJE NA TEN MOMENT


DECYZJA 1: budujemy data platform, nie zaczynamy od aplikacji.
DECYZJA 2: aplikacja ma działać niezależnie od umowy z gminą.
DECYZJA 3: oficjalne źródło i aktualność danych są elementem produktu.
DECYZJA 4: standard danych powinien być otwarty.
DECYZJA 5: AI jest fallbackiem dla trudnych dokumentów, a nie głównym parserem.
DECYZJA 6: każda zmiana danych musi być wersjonowana i audytowalna.
DECYZJA 7: pierwszym celem jest poprawność danych, nie liczba funkcji.


12. NAJBLIŻSZY MILESTONE


WastePL POC v0.1:
„Podaj dowolny adres w jednej z 8 pilotowych gmin i otrzymaj poprawny, aktualny harmonogram odbioru wraz ze źródłem i poziomem pewności.


13. ENGINEERING BOOTSTRAP — 27.08.2026
Przygotowano kontrakty umożliwiające rozpoczęcie implementacji bez dalszego projektowania podstaw:
• OpenAPI v0.1,
• PostgreSQL + PostGIS Schema v0.1,
• Sprint 01 Backlog,
• machine-readable WastePL JSON Schema v0.1,
• repo bootstrap z decyzjami ADR i strukturą monorepo.


Pierwszy Sprint realizuje vertical slice na Koszalinie i Manowie. Pełne 8 gmin pozostaje celem PoC, ale nie jest zakresem jednego sprintu.


14. DODATKOWE DOKUMENTY
08 — OpenAPI v0.1 — WastePL
Kontrakt endpointów /v1/health, /v1/addresses/resolve, /v1/collection i facilities.


09 — PostgreSQL + PostGIS Schema v0.1 — WastePL
Kanoniczny model bazy: adresy, strefy, reguły, sources, artifacts, harmonogram, facilities i audit log.


10 — Sprint 01 Backlog — WastePL
Dziesięciodniowy plan pierwszego vertical slice wraz z P0/P1, acceptance criteria i GO/NO-GO.


11 — WastePL JSON Schema v0.1
Machine-readable kontrakt normalized dataset oraz zasady walidacji domenowej.


12 — Repo Bootstrap — WastePL
Struktura docelowego repo, modular monolith, CI, security baseline i ADR-0001..0003.


Status GitHub: połączenie pozwala zapisywać pliki/commity do istniejących repozytoriów, ale obecnie nie udostępnia operacji utworzenia nowego repo. Nie użyto żadnego istniejącego repo zastępczego.
”
