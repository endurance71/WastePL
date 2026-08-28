<!-- Source: https://docs.google.com/document/d/1ybh8guc4fwH-o3eylSMlVFBh99PvBpPAXBiRM4-Bjn4/edit -->
<!-- Local snapshot: 2026-08-28 -->

# 01 — Feasibility Study — WastePL

[Oryginał w Google Docs](https://docs.google.com/document/d/1ybh8guc4fwH-o3eylSMlVFBh99PvBpPAXBiRM4-Bjn4/edit)

WASTEPL — FEASIBILITY STUDY
Ocena wykonalności ogólnopolskiej agregacji danych odpadowych


Data: 27.08.2026
Status: wersja robocza v0.1


1. CEL BADANIA


Celem feasibility study jest odpowiedź na pytanie: czy można zbudować ogólnopolską warstwę danych odpadowych bez ręcznego przepisywania harmonogramów dla 2479 gmin.


Badanie koncentruje się na:
• formatach publikacji harmonogramów,
• możliwości automatycznego pobierania danych,
• mapowaniu adresów do właściwych stref,
• częstotliwości zmian,
• jakości oficjalnych źródeł,
• możliwości normalizacji do wspólnego schematu.


2. PRÓBA


Przeanalizowano 22 miasta/gminy o różnej wielkości i różnym sposobie publikowania danych. Próba nie jest reprezentatywna statystycznie dla całej Polski, ale obejmuje większość głównych klas problemów technicznych.


3. WYNIK OGÓLNY


Wstępny scoring automatyzowalności:
• wysoka / bardzo wysoka: 12 z 22 przypadków,
• średnia: 9 z 22,
• trudna: 1 z 22.


Interpretacja:
• około 55% źródeł można obsługiwać deterministycznymi importerami,
• około 41% wymaga automatyzacji z walidacją i regułami specyficznymi dla źródła,
• około 5% może wymagać vision/OCR lub pracy manualnej.


To jest wystarczająco dobry wynik, aby przejść do proof of concept.


4. PRZEGLĄD PRZYPADKÓW


Warszawa
Format: wyszukiwarka po adresie / system 19115.
Automatyzacja: wysoka.
Ryzyko: własny dynamiczny system.


Kraków
Format: ulica → numer → harmonogram, dane MPO.
Automatyzacja: wysoka.
Ryzyko: konieczność stabilnej integracji z wyszukiwarką.


Wrocław
Format: wyszukiwarka adresowa + podział operatorów i sektorów.
Automatyzacja: wysoka.
Ryzyko: dane mogą być rozproszone pomiędzy kilka warstw systemu.


Gdańsk
Format: wyszukiwarka adresowa + dokumenty PDF/XLSX.
Automatyzacja: wysoka.
Ryzyko: kilka typów harmonogramów.


Poznań
Format: wyszukiwarka nieruchomości.
Automatyzacja: wysoka.
Ryzyko: własny system miejski.


Słupsk
Format: strefy i ulice, wyszukiwarka operatora.
Automatyzacja: wysoka.
Ryzyko: mapowanie stref.


Zielona Góra
Format: wyszukiwarka ulicy.
Automatyzacja: wysoka.
Ryzyko: zależność od własnego systemu ZGK.


Białystok
Format: wiele PDF-ów sektorowych.
Automatyzacja: średnia.
Ryzyko: sektor + typ zabudowy + duża liczba dokumentów.


Olsztyn
Format: PDF-y według sektorów.
Automatyzacja: średnia.
Ryzyko: sektor i typ zabudowy.


Opole
Format: aplikacja własna + załączniki.
Automatyzacja: średnia.
Ryzyko: wiele klas nieruchomości.


Toruń
Format: PDF + wyszukiwarka operatora.
Automatyzacja: średnia.
Ryzyko: dwa równoległe modele publikacji.


Ustka
Format: dokumenty z harmonogramami.
Automatyzacja: średnia.
Ryzyko: import plikowy i zmiany wersji dokumentów.


Tychowo
Format: PDF z przewidywalnymi tabelami.
Automatyzacja: wysoka.
Ryzyko: niskie; dobry przypadek dla parsera tabelowego.


Będzino
Format: PDF.
Automatyzacja: średnia.
Ryzyko: ekstrakcja PDF może pomijać część komórek tabeli.


Koszalin
Format: PDF według sektorów.
Automatyzacja: wysoka.
Ryzyko: konieczne poprawne mapowanie adresu do sektora.


Manowo
Format: PDF według grup miejscowości.
Automatyzacja: wysoka.
Ryzyko: niskie przy poprawnym modelu coverage.


Polanów
Format: HTML + PDF, w tym wyjątki adresowe.
Automatyzacja: wysoka.
Ryzyko: pojedyncze numery i wyjątki od reguł ogólnych.


Sianów
Format: rejony opisane w HTML + PDF.
Automatyzacja: średnia.
Ryzyko: rejony mogą obejmować konkretne numery posesji i zmieniać się w czasie.


Świeszyno
Format: trasy + osobne pliki.
Automatyzacja: średnia.
Ryzyko: mapowanie miejscowość → trasa.


Bobolice
Format: obrazy/JPG + PDF + komunikaty o zmianach.
Automatyzacja: trudna.
Ryzyko: źródła tworzone głównie dla człowieka, częste aktualizacje, zmiana operatora i kolejne wersje harmonogramów.


Kobierzyce
Format: PDF + edytowalny XLSX.
Automatyzacja: bardzo wysoka.
Ryzyko: niskie; idealny przypadek importu strukturalnego.


Kunice
Format: własna aplikacja + harmonogram.
Automatyzacja: średnia.
Ryzyko: zmiana dostawcy aplikacji może zmienić techniczne źródło danych.


5. KLUCZOWY WNIOSEK: NAJTRUDNIEJSZE NIE SĄ DATY


Samo odczytanie dat odbioru z tabeli jest relatywnie prostym problemem.


Trudniejszy problem to ustalenie, dla jakich nieruchomości dany harmonogram obowiązuje.


Model musi obsługiwać co najmniej:
• całą gminę,
• całą miejscowość,
• całą ulicę,
• zakres numerów,
• numery parzyste/nieparzyste,
• listę pojedynczych adresów,
• wyjątki include/exclude,
• typ zabudowy,
• sektor/rejon/trasę,
• zmianę obowiązywania w czasie.


6. PRG I TERYT


Kluczowym czynnikiem ograniczającym ryzyko jest możliwość wykorzystania państwowych danych adresowych.


PRG dostarcza punkty adresowe i lokalizację przestrzenną.
TERYT dostarcza m.in.:
• TERC — jednostki podziału terytorialnego,
• SIMC — miejscowości,
• ULIC — ulice.


WastePL nie powinien tworzyć własnego słownika Polski od zera. Adres użytkownika powinien być rozwiązywany do oficjalnych identyfikatorów, a następnie mapowany do reguł coverage konkretnego źródła.


7. ZMIANY HARMONOGRAMÓW


System nie może zakładać, że harmonogram jest publikowany raz na rok i pozostaje niezmienny.


Przykładowy lifecycle:
• harmonogram v1,
• zmiana operatora,
• nowy harmonogram,
• korekta rejonów,
• komunikat o jednorazowym przesunięciu odbioru.


Wymagane są:
• hash źródła,
• wersjonowanie,
• published_at,
• retrieved_at,
• valid_from / valid_to,
• diff pomiędzy wersjami,
• możliwość wycofania błędnej wersji.


8. TYPOLOGIA ŹRÓDEŁ


Poziom A — strukturalne
• oficjalne API,
• JSON,
• CSV,
• XLSX,
• ICS.


Poziom B — półstrukturalne
• HTML,
• tabelaryczny PDF z warstwą tekstową,
• przewidywalne załączniki.


Poziom C — niestrukturalne
• obraz/JPG,
• skan PDF,
• plakat,
• komunikat opisowy.


Strategia:
A → parser deterministyczny.
B → parser + reguły + walidacja.
C → vision/OCR/LLM jako fallback + obowiązkowa kontrola jakości.


9. PSZOK


PSZOK jest łatwiejszą klasą danych niż harmonogram odbioru.


Dla każdego punktu należy agregować:
• lokalizację,
• adres,
• godziny,
• dni otwarcia,
• przyjmowane frakcje,
• limity,
• wymagane dokumenty,
• zasady korzystania,
• gminy uprawnione do korzystania,
• źródło i datę aktualizacji.


PSZOK może być jednym z pierwszych ogólnopolskich datasetów WastePL.


10. PUNKTY KAUCYJNE


Nie zidentyfikowano jednego oficjalnego, centralnego i kompletnego datasetu wszystkich punktów zwrotu kaucji.


Strategia krótkoterminowa:
• dane publiczne sieci handlowych,
• dane operatorów, jeśli warunki ponownego użycia na to pozwalają,
• dane społecznościowe tylko jako źródło pomocnicze.


Strategia docelowa:
• integracje B2B z operatorami systemu kaucyjnego,
• status punktu i typ zwrotu,
• automat / zwrot ręczny,
• obsługiwane typy opakowań,
• możliwa informacja o dostępności w czasie rzeczywistym.


11. RYZYKA


R1 — zmiana struktury strony gminy.
Mitigacja: adapter versioning + alerty parserów.


R2 — błędny dokument opublikowany przez gminę.
Mitigacja: źródło, wersjonowanie, confidence i możliwość ręcznej korekty.


R3 — sprzeczne oficjalne źródła.
Mitigacja: hierarchy of trust i oznaczanie konfliktu.


R4 — pojedyncze wyjątki adresowe.
Mitigacja: elastyczny model coverage.


R5 — ręczne koszty utrzymania.
Mitigacja: Source Registry, change detector i automatyczna walidacja.


R6 — zależność od prywatnych API konkurentów.
Mitigacja: nie opierać core produktu na nieudokumentowanym reverse engineeringu.


12. REKOMENDACJA


Projekt przechodzi feasibility gate.


Rekomendowany kolejny krok:
• pilot 8 gmin,
• 3 podstawowe adaptery,
• integracja PRG/TERYT,
• WastePL Schema v0.1,
• test minimum 100 adresów,
• pomiar accuracy i manual intervention rate.


Decyzja o skalowaniu powinna być podjęta dopiero po uzyskaniu danych z realnego POC.
