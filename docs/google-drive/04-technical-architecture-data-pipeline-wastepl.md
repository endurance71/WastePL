<!-- Source: https://docs.google.com/document/d/1BluFkbebHI0vb236BGXtdJCqUh3DzV_DrPfeYN5ljv4/edit -->
<!-- Local snapshot: 2026-08-28 -->

# 04 — Architektura techniczna i pipeline danych — WastePL

[Oryginał w Google Docs](https://docs.google.com/document/d/1BluFkbebHI0vb236BGXtdJCqUh3DzV_DrPfeYN5ljv4/edit)

WastePL — Architektura techniczna i pipeline danych
Wersja: 0.1
Data: 27.08.2026


1. Cel techniczny
WastePL ma zapewnić jeden, stabilny model dostępu do danych odpadowych dla dowolnego adresu w Polsce, niezależnie od sposobu publikacji danych przez gminę lub operatora. Architektura powinna rozdzielać źródła danych od modelu domenowego i warstwy konsumenckiej.


2. Zasada architektoniczna
Źródło → pobranie artefaktu → detekcja zmian → ekstrakcja → normalizacja → rozpoznanie zakresu adresowego → walidacja → wersjonowany dataset → API → aplikacje.


3. Source Registry
Każda gmina/obszar posiada rejestr źródeł:
• source_id
• municipality_terc
• typ źródła: API / HTML / XLSX / CSV / PDF_TEXT / PDF_IMAGE / JPG
• URL
• owner
• częstotliwość sprawdzania
• ETag / Last-Modified / SHA-256
• parser_id i parser_version
• status aktywności
• podstawa ponownego wykorzystania danych


4. Warstwa pobierania
Worker sprawdza źródła cyklicznie. Jeśli ETag, Last-Modified lub hash nie uległ zmianie, dokument nie jest ponownie przetwarzany. Zmieniony artefakt trafia do immutable/raw storage wraz z timestampem i metadanymi źródłowymi.


5. Adaptery
Nie budujemy osobnego scrapera dla każdej gminy. Budujemy klasy adapterów:
• APIAdapter
• HtmlTableAdapter
• XlsxAdapter
• CsvAdapter
• PdfTextAdapter
• PdfTableAdapter
• ImageVisionAdapter — fallback dla skanów/JPG/PDF bez tekstu
• ManualImportAdapter — kontrolowany import administracyjny


AI/vision nie powinno być domyślnym parserem. Najpierw deterministyczne metody, AI wyłącznie tam, gdzie format nie daje się wiarygodnie sparsować.


6. Normalizacja
Adapter zwraca dane pośrednie, które normalizer zamienia na WastePL Data Standard. Kluczowe obiekty:
• Municipality
• ServiceArea
• AddressRule
• WasteFraction
• CollectionEvent
• Facility
• FacilityAcceptedWaste
• DepositReturnPoint
• Alert
• SourceArtifact
• Verification


7. Adresy
Bazową warstwą referencyjną powinny być państwowe rejestry PRG + TERYT (TERC, SIMC, ULIC). Pozwala to mapować wpisany adres do gminy, miejscowości i ulicy bez tworzenia własnej bazy adresowej od zera.


ServiceArea musi obsługiwać więcej niż polygon. W polskich harmonogramach występują:
• cała gmina
• cała miejscowość
• cała ulica
• zakres numerów
• parzyste/nieparzyste
• pojedyncze numery
• listy include/exclude
• typ zabudowy
• ręcznie zdefiniowane wyjątki


8. Walidacja i confidence
Każdy rekord produkcyjny powinien posiadać:
• source_url
• retrieved_at
• published_at
• valid_from / valid_to
• source_hash
• parser_id / parser_version
• confidence_score
• verification_status
• verified_by / verified_at


Proponowane progi:
0.99–1.00 — deterministyczne dane / oficjalne API / XLSX
0.95–0.99 — stabilny parser HTML/PDF
0.80–0.95 — ekstrakcja vision wymagająca automatycznych testów
<0.80 — kolejka ręcznej weryfikacji


9. Versioning
Harmonogram nie może być traktowany jak jeden plik „na rok”. Każda zmiana tworzy nową wersję datasetu. System musi znać okres ważności oraz umożliwiać diff zmian, np. „17 CollectionEvents changed”. Stary dataset pozostaje audytowalny, ale nie jest używany jako bieżący.


10. API v1 — minimalny zakres
GET /v1/resolve-address
GET /v1/collection?address=...
GET /v1/municipalities/{terc}
GET /v1/facilities/nearby
GET /v1/pszok/nearby
GET /v1/deposit-points/nearby
GET /v1/waste-guide?q=...
GET /v1/alerts


Przykładowa odpowiedź Collection API powinna zwracać adres znormalizowany, gminę, ServiceArea, kolejne odbiory, źródło, timestamp aktualizacji i confidence.


11. Proponowany stack MVP
Backend: NestJS lub Fastify/TypeScript
Baza: PostgreSQL + PostGIS
Kolejki: Redis/BullMQ
Raw storage: S3-compatible / Cloudflare R2
Workers: TypeScript + Python tylko dla parserów wymagających bibliotek data/PDF
API: REST + OpenAPI
Admin: Next.js
Observability: Sentry + strukturalne logi + metryki importów
CI/CD: GitHub Actions


12. Bezpieczeństwo i niezawodność
• brak wykonywania kodu z pobranych dokumentów
• skanowanie i ograniczenia MIME/rozmiaru
• timeouty i sandbox parserów
• rate limiting dla źródeł
• cache API
• pełny audit log ręcznych korekt
• backup bazy i raw artifacts
• idempotentne importy
• brak automatycznej publikacji danych o niskim confidence


13. Pipeline docelowy
SOURCE REGISTRY
↓
FETCHER
↓
RAW ARTIFACT STORE
↓
CHANGE DETECTOR
↓
EXTRACTOR / ADAPTER
↓
WASTEPL NORMALIZER
↓
PRG + TERYT ADDRESS RESOLVER
↓
VALIDATOR + DIFF
↓
VERSIONED POSTGRES/POSTGIS
↓
PUBLIC API
↓
Web / Mobile / Widgets / B2B API


14. Największe ryzyka techniczne
1) mapowanie niestandardowych stref adresowych,
2) zmiany struktury stron i dokumentów,
3) aktualność i błędne harmonogramy źródłowe,
4) skany/JPG bez warstwy tekstowej,
5) niejednolite nazwy frakcji,
6) identyfikacja obowiązującej wersji harmonogramu.


15. Kryterium sukcesu PoC
Dla 8 gmin pilotażowych system powinien:
• poprawnie rozwiązać minimum 100 testowych adresów,
• zwrócić właściwy ServiceArea,
• osiągnąć minimum 99% zgodności najbliższych terminów z oficjalnym źródłem,
• automatycznie wykrywać zmianę artefaktu,
• zachowywać źródło i historię każdej zmiany.
WASTEPL — ARCHITEKTURA TECHNICZNA I PIPELINE DANYCH


Data: 27.08.2026
Status: wersja robocza v0.1


1. CEL ARCHITEKTURY


Architektura musi rozwiązać trzy różne problemy:
• pobranie danych z bardzo różnych źródeł,
• przekształcenie ich do jednego standardu,
• bezpieczne publikowanie tylko danych, którym możemy ufać.


Priorytety:
• poprawność,
• audytowalność,
• wersjonowanie,
• niski koszt utrzymania,
• możliwość skalowania do całej Polski,
• brak zależności od jednego typu źródła.


2. ARCHITEKTURA HIGH LEVEL


Źródła
↓
Source Registry
↓
Fetcher
↓
Raw Artifact Store
↓
Change Detector
↓
Extraction Engine
↓
WastePL Normalizer
↓
Address Resolver / PRG / TERYT
↓
Validation Engine
↓
Review Queue — tylko przypadki problematyczne
↓
Versioned Data Store
↓
WastePL API
↓
Web / PWA / App / Widget / Partner API


3. SOURCE REGISTRY


Centralny rejestr źródeł dla każdej gminy.


Przykładowe pola:
• municipality_id,
• source_id,
• source_url,
• source_type,
• expected_content_type,
• fetch_frequency,
• adapter,
• parser_version,
• authority_level,
• reuse_basis,
• enabled,
• last_success,
• last_change,
• next_check,
• health_status.


Przykład:
{
  "municipality": "Bobolice",
  "source_type": "municipal_web",
  "adapter": "bobolice_schedule_v1",
  "fetch_frequency": "daily",
  "authority_level": "official_municipality"
}


4. FETCHER


Fetcher odpowiada wyłącznie za pobranie źródła, nie za interpretację.


Powinien zapisywać:
• HTTP status,
• ETag,
• Last-Modified,
• MIME type,
• content length,
• URL po redirectach,
• timestamp,
• hash treści.


Retry:
• exponential backoff,
• limit prób,
• osobna kolejka dla źródeł chwilowo niedostępnych.


5. RAW ARTIFACT STORE


Nie usuwamy poprzednich wersji dokumentów.


Przechowujemy:
• oryginalny PDF,
• XLSX,
• HTML snapshot,
• JSON response,
• obraz,
• metadane pobrania.


Cel:
• audyt,
• ponowne przetworzenie nowszym parserem,
• diff,
• rollback,
• analiza błędów.


Rekomendacja:
Object storage typu S3/R2 + metadane w PostgreSQL.


6. CHANGE DETECTOR


Nie przetwarzamy całej Polski codziennie od zera.


Poziom 1:
ETag / Last-Modified.


Poziom 2:
SHA-256 zawartości.


Poziom 3:
semantic/content fingerprint dla HTML, jeśli zmieniły się elementy strony niezwiązane z harmonogramem.


Flow:
source check
→ unchanged → stop
→ changed → zapis artifactu → ekstrakcja → diff → walidacja.


7. ADAPTERY


Nie tworzymy 2479 kompletnie osobnych importerów, jeśli kilka gmin używa podobnej struktury.


Warstwy adapterów:


GENERIC_XLSX
Dla standardowych tabel arkuszowych.


GENERIC_CSV
Dla plików CSV.


GENERIC_HTML_TABLE
Dla statycznych tabel HTML.


GENERIC_PDF_TABLE
Dla PDF z warstwą tekstową i regularną tabelą.


GENERIC_ICS
Dla kalendarzy.


GENERIC_JSON
Dla publicznych API/endpointów.


CUSTOM_SITE_ADAPTER
Dla własnych wyszukiwarek gmin/operatorów.


VISION_DOCUMENT
Fallback dla obrazu, skanu i plakatu.


8. EXTRACTION ENGINE


Output extractora nie trafia bezpośrednio do użytkownika.


Extractor zwraca strukturę pośrednią:
• znalezione nagłówki,
• daty,
• frakcje,
• regiony/strefy,
• adresy,
• źródłowe fragmenty tekstu,
• confidence per field.


Dopiero Normalizer mapuje to na WastePL Standard.


9. AI / VISION


AI używamy tam, gdzie parser deterministyczny jest nieopłacalny lub niemożliwy.


Dobre przypadki:
• JPG z harmonogramem,
• zeskanowany PDF,
• opisowy komunikat o przesunięciu terminu,
• rozpoznanie struktury nowego dokumentu.


Złe przypadki:
• prosty XLSX,
• regularna tabela HTML,
• JSON,
• dane, które da się deterministycznie zmapować.


Zasada:
AI nigdy nie jest jedynym źródłem prawdy dla danych o niskim confidence.


10. NORMALIZER


Odpowiada za:
• canonical waste codes,
• format ISO dat,
• mapowanie lokalnych nazw frakcji,
• normalizację miejscowości i ulic,
• tworzenie service_area,
• tworzenie coverage rules,
• mapowanie do TERYT/PRG.


Przykład:
„żółty worek”
„metale i tworzywa”
„plastik + metal”
→ plastics_metals.


11. ADDRESS RESOLVER


Cel:
wejście użytkownika → oficjalny adres → gmina → service_area.


Proponowany flow:
1. autocomplete/adres użytkownika,
2. rozpoznanie punktu PRG,
3. TERC/SIMC/ULIC,
4. pobranie aktywnych coverage rules,
5. ranking reguł od najbardziej szczegółowej,
6. wynik service_area,
7. walidacja, czy nie ma konfliktu.


Priorytet reguł przykładowo:
explicit_address
> street_numbers
> range
> street
> locality
> municipality.


Reguła exclude ma pierwszeństwo nad include, jeśli jest bardziej szczegółowa.


12. VALIDATION ENGINE


Walidacje strukturalne:
• data w poprawnym formacie,
• brak wydarzeń poza valid_from/valid_to,
• canonical waste code istnieje,
• service_area ma coverage,
• źródło istnieje.


Walidacje logiczne:
• nietypowo duża liczba odbiorów,
• nagły spadek liczby zdarzeń,
• duplikaty,
• konflikt dwóch harmonogramów,
• luka w kalendarzu,
• terminy sprzed publikacji źródła — do flagowania.


Walidacje historyczne:
• diff wobec poprzedniej aktywnej wersji,
• procent zmienionych wydarzeń,
• zmiany coverage,
• nowe/usunięte frakcje.


13. REVIEW QUEUE


Celem nie jest brak człowieka, lecz ręczna praca tylko tam, gdzie automatyzacja nie ma wystarczającej pewności.


Do Review Queue trafiają:
• confidence poniżej progu,
• nowy nieznany format,
• konflikt oficjalnych źródeł,
• duża zmiana coverage,
• masowa zmiana terminów,
• niespójne daty,
• wynik vision wymagający potwierdzenia.


Panel review powinien pokazywać obok siebie:
• źródło,
• poprzednią wersję,
• nową wersję,
• diff,
• propozycję parsera.


14. PUBLIKACJA DANYCH


Pipeline statusów:
RAW
→ EXTRACTED
→ NORMALIZED
→ VALIDATING
→ REVIEW_REQUIRED albo APPROVED
→ ACTIVE
→ SUPERSEDED.


Do API trafiają tylko ACTIVE.


15. DATABASE


Rekomendacja POC:
PostgreSQL + PostGIS.


Dlaczego:
• relacyjny model dobrze pasuje do stref, wydarzeń i wersji,
• PostGIS dla punktów i zapytań przestrzennych,
• dobre indeksowanie,
• łatwy audit trail,
• szerokie wsparcie narzędziowe.


Główne tabele:
• municipalities,
• localities,
• streets,
• addresses/reference_addresses,
• service_areas,
• coverage_rules,
• waste_fractions,
• collection_events,
• facilities,
• facility_acceptance,
• deposit_return_points,
• alerts,
• sources,
• source_artifacts,
• dataset_versions,
• import_jobs,
• validation_issues.


16. STACK — REKOMENDACJA ROBOCZA


Backend/API:
• NestJS lub Fastify/TypeScript,
• PostgreSQL,
• PostGIS,
• Prisma — możliwe, ale operacje PostGIS mogą wymagać raw SQL lub rozszerzenia warstwy danych.


Workers:
• Node.js dla typowych adapterów,
• Python jako osobny worker dla narzędzi PDF/data science, jeśli okaże się wygodniejszy.


Queue:
• Redis + BullMQ albo managed queue.


Object storage:
• Cloudflare R2 / S3.


Web:
• Next.js.


Mobile później:
• React Native / Expo.


Monitoring:
• Sentry,
• structured logs,
• metrics dla parserów,
• alerty zmian/awarii źródeł.


To jest propozycja, nie zamknięta decyzja architektoniczna.


17. API POC


GET /v1/resolve-address?q=...


GET /v1/collection?address_id=...


GET /v1/collection?lat=...&lon=...


GET /v1/municipalities/{terc}


GET /v1/facilities?municipality=...&fraction=...


GET /v1/sources/{id}


GET /v1/datasets/{municipality}/status


18. ODPOWIEDŹ /COLLECTION


Powinna zawierać:
• resolved_address,
• municipality,
• service_area,
• next_collections,
• source,
• updated_at,
• dataset_version,
• confidence,
• verification_status.


19. CACHE


Dane harmonogramowe zmieniają się rzadko, więc API dobrze nadaje się do cache.


Można cache'ować:
• address → service_area,
• service_area → collection_events,
• facilities w regionie,
• municipality metadata.


Nie cache'ować zbyt długo:
• alerts,
• realtime status,
• dane po wykryciu zmiany źródła.


20. OBSERWOWALNOŚĆ


KPI techniczne per source:
• fetch success rate,
• parse success rate,
• validation pass rate,
• time since last successful fetch,
• time since last change,
• manual review rate,
• false positive change rate,
• number of active records.


Globalne:
• % gmin aktywnych,
• % populacji covered,
• % adresów resolvable,
• data freshness,
• accuracy test set.


21. BEZPIECZEŃSTWO


Dane publiczne nie oznaczają, że cała platforma nie wymaga security.


Wymagania:
• RBAC dla panelu gmin,
• oddzielenie tenantów,
• audit log każdej zmiany,
• API keys dla partnerów,
• rate limiting,
• secret management,
• podpisy webhooków,
• backup bazy,
• immutable/raw artifact history,
• brak przechowywania historii prywatnych adresów użytkowników bez potrzeby.


22. PRYWATNOŚĆ


W podstawowym flow wyszukanie adresu nie powinno wymagać konta.


Jeżeli użytkownik zapisuje adres:
• minimalizacja danych,
• rozdzielenie konta od publicznego datasetu,
• szyfrowanie transmisji,
• jasna retencja,
• możliwość usunięcia danych.


Lokalizacja GPS powinna być opcjonalna.


23. TESTY


Każdy adapter powinien mieć fixtures z realnymi, zanonimizowanymi lub publicznymi dokumentami.


Testy:
• parser unit tests,
• golden datasets,
• regression tests,
• address resolution tests,
• diff tests,
• API contract tests.


Najważniejszy test end-to-end:
„Dla konkretnego realnego adresu odpowiedź WastePL jest identyczna z oficjalnym harmonogramem.”


24. POC — MINIMALNA INFRASTRUKTURA


Nie budować mikroserwisów na start.


Rekomendacja:
• jeden backend/modular monolith,
• jeden Postgres,
• jedna kolejka,
• object storage,
• jeden worker,
• panel wewnętrzny,
• prosta PWA.


Dopiero gdy skala pokaże realną potrzebę, wydzielamy ingestion/vision/API do osobnych usług.


25. WARUNEK SKALOWALNOŚCI


Docelowo system musi dojść do sytuacji, w której dodanie nowej gminy wygląda tak:
1. dodaj Source Registry,
2. wybierz istniejący adapter lub skonfiguruj reguły,
3. uruchom import,
4. popraw coverage,
5. waliduj,
6. publikuj.


Nie:
„napisz od zera nowy scraper i ręcznie przepisuj dane co miesiąc”.
