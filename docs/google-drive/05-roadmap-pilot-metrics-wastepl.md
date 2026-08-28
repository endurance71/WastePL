<!-- Source: https://docs.google.com/document/d/1cQcL2ABmA0mrBKyQCWnZ73BOls5c4mcLCKw8Jfb9zwg/edit -->
<!-- Local snapshot: 2026-08-28 -->

# 05 — Roadmap, pilot i metryki — WastePL

[Oryginał w Google Docs](https://docs.google.com/document/d/1cQcL2ABmA0mrBKyQCWnZ73BOls5c4mcLCKw8Jfb9zwg/edit)

WastePL — Roadmap, pilot i metryki
Wersja: 0.1
Data: 27.08.2026


1. Cel roadmapy
Najpierw udowadniamy, że potrafimy poprawnie i powtarzalnie znormalizować dane odpadowe dla trudnych gmin. Dopiero potem inwestujemy w pełną aplikację mobilną i skalowanie sprzedaży.


2. Pilot regionalny
Pierwszy zestaw powinien obejmować różne formaty i modele publikacji w jednym regionie:
• Koszalin
• Bobolice
• Sianów
• Manowo
• Świeszyno
• Będzino
• Polanów
• Tychowo


Ten zestaw daje PDF-y, HTML, obrazy, sektory, trasy, konkretne numery adresowe i różne modele operatorów.


3. Faza 0 — przygotowanie (1–2 tygodnie)
• zatwierdzenie WastePL Data Standard v0.1
• lista źródeł dla 8 gmin
• definicja statusów verification/confidence
• przygotowanie PRG/TERYT
• repozytorium kodu i CI/CD
• wzorzec testów regresyjnych


Kryterium wyjścia: dla każdej gminy wiadomo skąd bierzemy harmonogram i jak mapujemy obszar obowiązywania.


4. Faza 1 — PoC danych (2–4 tygodnie)
• Source Registry
• Fetcher + Raw Artifact Store
• change detection
• parser HTML
• parser PDF tekstowego/tabel
• parser XLSX/CSV
• ręczny adapter wyjątków
• Address Resolver
• endpoint GET /v1/collection


Kryterium wyjścia: minimum 100 losowych adresów, minimum 99% zgodności najbliższego odbioru z oficjalnym źródłem.


5. Faza 2 — jakość i automatyzacja (2–4 tygodnie)
• confidence scoring
• diff między wersjami
• alerty o zmianach źródeł
• kolejka ręcznej weryfikacji
• parser vision dla JPG/skanów
• testy regresyjne każdej gminy
• monitoring importów


KPI: >80% aktualizacji pilota przechodzi bez ręcznej ingerencji.


6. Faza 3 — Web MVP (2–3 tygodnie)
Pierwszy interfejs użytkownika to web, nie aplikacja mobilna.
Funkcje:
• wyszukiwanie adresu
• najbliższe odbiory
• źródło i aktualność danych
• PSZOK na mapie
• wyszukiwarka „gdzie wyrzucić?”
• podstawowe punkty systemu kaucyjnego, jeśli dostępne są wiarygodne dane


KPI: użytkownik z każdej gminy pilotażowej znajduje właściwy harmonogram w <30 sekund.


7. Faza 4 — 20–50 gmin
• dokładanie nowych adapterów tylko wtedy, gdy nie da się użyć istniejących
• automatyczny onboarding źródła
• panel operatorski
• pełna baza PSZOK
• pierwsze rozmowy z gminami o statusie Verified


KPI:
• 20 gmin aktywnych — checkpoint 1
• 50 gmin aktywnych — checkpoint 2
• >90% importów bez ręcznej korekty
• <1% zgłoszonych błędnych terminów


8. Faza 5 — aplikacja mobilna
Dopiero po potwierdzeniu jakości i utrzymywalności danych.
MVP mobile:
• iOS/Android
• kilka zapisanych adresów
• push dzień wcześniej i w dniu odbioru
• kalendarz
• PSZOK / punkty zbiórki / kaucja
• alerty zmian
• „gdzie wyrzucić?”
• zgłoszenie błędu w danych


9. Faza 6 — B2G / Verified
Oferta dla gmin:
• przejęcie profilu gminy
• bezpośrednia aktualizacja harmonogramu
• oficjalny status Verified
• komunikaty i push
• widget na stronę WWW
• statystyki użytkowania
• obsługa zgłoszeń mieszkańców
• API integracyjne


10. Faza 7 — skala wojewódzka i ogólnopolska
Cel pośredni: 100% jednego województwa.
Następnie 500 gmin i ekspansja ogólnopolska. Nie skalujemy marketingu szybciej niż jakość danych.


11. Kluczowe metryki produktu
DATA COVERAGE
• liczba gmin aktywnych
• liczba adresów możliwych do rozwiązania
• % populacji objętej danymi


DATA QUALITY
• accuracy najbliższego odbioru
• liczba błędów / 10 000 zapytań
• freshness danych
• średni czas od zmiany źródła do publikacji


AUTOMATION
• % importów bez ręcznej ingerencji
• średni koszt operacyjny / gmina / miesiąc
• liczba wyjątków parsera


PRODUCT
• MAU
• aktywne zapisane adresy
• push opt-in rate
• retention 30/90 dni
• liczba wyszukań PSZOK / „gdzie wyrzucić?”


BUSINESS
• liczba gmin Verified
• ARR B2G
• ARR API/B2B
• CAC gminy
• średnia wartość kontraktu
• churn


12. Metryki bramkowe GO / NO-GO
GO do mobile:
• >=20 gmin
• >=99% accuracy w zestawie testowym
• >=90% automatycznych aktualizacji
• operacyjny koszt utrzymania jednej gminy akceptowalny ekonomicznie


NO-GO / przebudowa pipeline:
• >5% harmonogramów wymaga regularnej ręcznej pracy
• częste błędne przypisanie adresów do stref
• brak możliwości wykrywania obowiązującej wersji danych


13. Pierwszy backlog techniczny
P0:
1. schema v0.1
2. PRG/TERYT resolver
3. Source Registry
4. PDF/HTML/XLSX adapters
5. versioning + diff
6. test dataset 100 adresów
7. GET /v1/collection


P1:
1. PSZOK model + import
2. publiczne API
3. web search
4. panel review
5. alerts


P2:
1. mobile
2. system kaucyjny
3. B2G Verified
4. widgets
5. komercyjne API


14. Najbliższa konkretna decyzja
Nie projektować jeszcze rozbudowanego UI. Najpierw uruchomić PoC na 8 gminach i zmierzyć faktyczny koszt pozyskania, normalizacji i utrzymania danych.
WASTEPL — ROADMAP, PILOT I METRYKI


Data: 27.08.2026
Status: wersja robocza v0.1


1. CEL ROADMAPY


Roadmapa ma ograniczyć ryzyko największego niewiadomego projektu: kosztu i jakości agregacji danych.


Nie zakładamy, że pomysł jest skalowalny tylko dlatego, że działa dla jednej gminy. Każdy etap ma bramkę decyzyjną opartą na mierzalnych danych.


2. ETAP 0 — DEFINICJA STANDARDU


Zakres:
• WastePL Data Standard v0.1,
• canonical waste fractions,
• source model,
• service_area i coverage_rule,
• versioning,
• confidence,
• minimalny kontrakt API.


Definition of Done:
• standard opisuje wszystkie przypadki z 22 gmin researchu,
• da się reprezentować pojedyncze numery i wyjątki,
• każde collection_event ma źródło i wersję.


3. ETAP 1 — POC 8 GMIN


Proponowane gminy:
• Koszalin,
• Bobolice,
• Sianów,
• Manowo,
• Świeszyno,
• Będzino,
• Polanów,
• Tychowo.


Dlaczego ten zestaw:
• jeden region ułatwia ręczną weryfikację,
• różne formaty źródeł,
• sektory, trasy, wyjątki adresowe,
• PDF, HTML, obrazy,
• część danych od wspólnych operatorów.


4. ZAKRES POC


Technicznie:
• Source Registry,
• fetcher,
• raw artifact store,
• change detection,
• adapter HTML,
• adapter PDF_TABLE,
• adapter XLSX/CSV — jeśli pojawi się źródło,
• fallback dla image/vision,
• normalizer,
• PRG/TERYT resolver,
• validator,
• proste API,
• panel review.


Produktowo:
• adres → najbliższe odbiory,
• źródło danych,
• data aktualizacji,
• confidence,
• podstawowy PSZOK.


5. TEST POC


Minimum 100 realnych adresów.


Próbka powinna obejmować:
• różne gminy,
• różne miejscowości,
• różne ulice,
• adresy standardowe,
• adresy z wyjątkiem,
• budynki jednorodzinne i wielorodzinne — jeśli rozróżnia je harmonogram.


Dla każdego adresu ręcznie ustalamy „ground truth” na podstawie oficjalnego źródła.


Porównujemy:
• service_area,
• frakcję,
• datę najbliższego odbioru,
• kolejne terminy.


6. GATE 1 — CZY WCHODZIMY DALEJ


Minimalne progi:
• address resolution success ≥ 99%,
• schedule accuracy ≥ 99%,
• krytyczne błędy dat = 0 w finalnym zestawie testowym,
• manual intervention rate < 25% dla pierwszego importu,
• parsery potrafią ponownie przetworzyć źródła bez ręcznego przepisywania harmonogramu.


Docelowo manual intervention ma spaść znacznie niżej, ale pierwszy POC może wymagać więcej konfiguracji.


7. ETAP 2 — 20 GMIN


Po pozytywnym POC:
• rozszerzyć zestaw do 20 gmin,
• celowo dodać nowe klasy źródeł,
• uruchomić automatyczne codzienne/tygodniowe checki,
• mierzyć change detection,
• uruchomić PWA dla użytkowników testowych.


KPI:
• ≥ 95% źródeł monitorowanych automatycznie,
• średni czas wykrycia zmiany < 24 h dla harmonogramów,
• ręczne review wymagane dla < 15% zmian,
• brak niewykrytej zmiany w zestawie kontrolnym.


8. ETAP 3 — 100 GMIN


Cel:
sprawdzić, czy model jest organizacyjnie i kosztowo skalowalny.


Zakres:
• różne województwa,
• duże miasta,
• małe gminy wiejskie,
• gminy z aplikacjami zewnętrznych dostawców,
• gminy tylko z PDF/JPG,
• związki międzygminne.


Na tym etapie należy policzyć dokładny koszt:
• onboardingu jednej gminy,
• utrzymania jednej gminy/miesiąc,
• obsługi review,
• infrastruktury,
• zewnętrznych modeli AI/vision.


9. GATE 2 — UNIT ECONOMICS DATA PLATFORM


Metryki:
• median onboarding time per municipality,
• median monthly maintenance time,
• cost per municipality per month,
• % changes requiring human review,
• number of reusable adapters,
• municipalities per adapter.


Pożądany kierunek:
• większość nowych gmin konfigurowalna istniejącymi adapterami,
• koszt utrzymania wyraźnie maleje wraz ze skalą.


10. ETAP 4 — PIERWSZE WOJEWÓDZTWO


Rekomendowany kandydat: zachodniopomorskie.


Powody:
• lokalna możliwość łatwej weryfikacji,
• pilot zaczyna się w regionie,
• naturalna historia do PR/rozmów z samorządami,
• możliwość stworzenia pierwszego realnego „100% coverage region”.


Cel:
• pełne pokrycie gmin województwa,
• PSZOK,
• podstawowe „gdzie wyrzucić”,
• publiczne PWA,
• pierwsze rozmowy B2G.


11. ETAP 5 — APLIKACJA MOBILNA


Aplikację budujemy wtedy, gdy baza danych jest już rzeczywistym produktem.


MVP mobile:
• onboarding adresu,
• kalendarz odbiorów,
• push dzień wcześniej,
• kilka zapisanych adresów,
• PSZOK,
• mapa punktów,
• komunikaty.


Dopiero później:
• AI „gdzie wyrzucić”,
• zgłoszenia,
• realtime,
• widgety,
• family/shared addresses.


12. ETAP 6 — WASTEPL VERIFIED


Gmina może przejąć oficjalny profil.


Flow sprzedażowy:
1. WastePL już agreguje publiczne dane.
2. Pokazujemy gminie użytkowanie i jakość danych.
3. Gmina otrzymuje dostęp testowy.
4. Weryfikuje profil.
5. Może przejść na płatny panel/komunikację.


Pierwsza oferta powinna być łatwa zakupowo i znacząco poniżej progu PZP, z uwzględnieniem wewnętrznych regulaminów zakupowych JST.


13. ETAP 7 — DATA/API


Po uzyskaniu odpowiedniego pokrycia:
• publiczne API developer,
• API keys,
• limity,
• dokumentacja,
• webhooki zmian,
• bulk datasets,
• SLA dla enterprise.


To może być osobny produkt przychodowy.


14. ETAP 8 — SYSTEM KAUCYJNY


Nie próbujemy ręcznie utrzymywać 60+ tys. punktów jako głównego sposobu skalowania.


Cel:
• partnerstwa z operatorami,
• integracje z retail,
• znormalizowanie danych punktów,
• jedno API discovery,
• docelowo realtime status tam, gdzie partner dostarcza dane.


15. METRYKA NORTH STAR


Coverage Accuracy Population — roboczo:
„Jaki procent mieszkańców Polski mieszka pod adresem, dla którego WastePL potrafi zwrócić poprawny i aktualny harmonogram?”


Składowe:
• population coverage,
• address coverage,
• schedule accuracy,
• freshness.


16. METRYKI PRODUKTOWE


Po uruchomieniu PWA/App:
• WAU/MAU,
• liczba zapisanych adresów,
• push opt-in rate,
• open rate przypomnienia,
• retention 30/90 dni,
• wyszukiwania „gdzie wyrzucić”,
• kliknięcia na PSZOK/nawigację,
• zgłoszenia błędnych danych.


17. METRYKI DANYCH


• municipalities covered,
• population covered,
• addresses resolvable,
• active service areas,
• active collection events,
• average freshness,
• sources healthy,
• parse success rate,
• manual review rate,
• rollback count,
• reported data errors.


18. METRYKI BIZNESOWE


B2G:
• liczba gmin Verified,
• trial → paid conversion,
• ARR per municipality,
• churn,
• CAC,
• czas sprzedaży.


API:
• active API consumers,
• requests/month,
• revenue/API customer,
• gross margin,
• uptime/SLA.


19. PLAN 30 DNI — PIERWSZA ITERACJA


Tydzień 1
• finalizacja schema v0.1,
• wybór 8 oficjalnych źródeł,
• repozytorium,
• Postgres schema,
• podstawowy Source Registry.


Tydzień 2
• fetcher,
• raw artifacts,
• pierwszy adapter PDF,
• pierwszy adapter HTML,
• ręczny ground-truth dataset.


Tydzień 3
• PRG/TERYT resolver,
• coverage rules,
• collection API,
• 4 gminy end-to-end.


Tydzień 4
• pozostałe 4 gminy,
• test 100 adresów,
• raport błędów,
• decyzja GO / ITERATE / STOP.


20. GO / ITERATE / STOP


GO
Accuracy ≥ 99%, rozsądny koszt onboardingu, znaczna część pipeline automatyczna.


ITERATE
Dane są poprawne, ale onboarding wymaga zbyt dużo ręcznej pracy. Automatyzujemy adaptery i review tooling.


STOP/PIVOT
Jeżeli dla większości gmin nie da się deterministycznie przypisać adresu do harmonogramu bez stałej pracy manualnej lub prawnych/licencyjnych blokad źródeł.


21. NAJBLIŻSZE KONKRETNE ZADANIA


• utworzyć repo projektu,
• spisać formalny JSON Schema,
• zbudować listę źródeł 8 gmin,
• pobrać fixtures,
• utworzyć test cases adresowych,
• zbudować pierwszą tabelę service_area,
• wybrać sposób importu PRG,
• uruchomić pierwszy endpoint /collection.
