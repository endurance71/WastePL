# Standard danych WastePL

## Rola dokumentu

Ten dokument opisuje znaczenie danych. Nie kopiuje pól kontraktu. Kanoniczne i maszynowo weryfikowalne definicje to:

- [dataset v0.1](../../schemas/wastepl-v0.1.schema.json);
- [facility v0.2](../../schemas/wastepl-facility-v0.2.schema.json);
- [source manifest v0.1](../../schemas/source-manifest-v0.1.schema.json);
- [publiczne OpenAPI](../../openapi/wastepl-v0.1.yaml) i [wewnętrzne OpenAPI](../../openapi/wastepl-internal-v0.1.yaml);
- [migracje PostgreSQL/PostGIS](../../db/migrations/).

Zmiana pola lub enum wymaga wersjonowania właściwego kontraktu; aktualizacja samego dokumentu opisowego nie zmienia API ani bazy.

## Podstawowe pojęcia

- Source opisuje oficjalną publikację i sposób jej odpytywania.
- Source artifact jest niemutowalną kopią pobranej treści, identyfikowaną SHA-256.
- Municipality i address używają oficjalnych identyfikatorów tam, gdzie zostały zweryfikowane; niezweryfikowane wartości pozostają `NULL`/nieznane.
- Service area jest regułą łączącą adres z obsługą, a nie wyłącznie wielokątem.
- Collection event jest datą odbioru frakcji obowiązującą w określonym obszarze i okresie.
- Facility opisuje fizyczny PSZOK albo punkt kaucyjny; capabilities opisują co przyjmuje.
- Assertion wiąże twierdzenie o obiekcie ze źródłem, czasem pobrania i statusem weryfikacji.

## Reguły tożsamości i czasu

Identyfikatory wewnętrzne są stabilne, a identyfikatory urzędowe zapisuje się tylko po autorytatywnym dopasowaniu. Nazwa tekstowa nie jest samodzielnym kluczem. Dane okresowe mają jawne `validFrom`/`validTo` albo równoważny okres kontraktowy. Czas pobrania źródła, czas przetworzenia i okres obowiązywania to różne pojęcia i nie mogą być zamieniane.

Surowej historii nie nadpisujemy. Nowy artefakt lub ponowne przetworzenie tworzy kolejną wersję/rekord audytowy. Publikowany widok może wskazywać najnowszą zatwierdzoną wersję.

## Adres i obszar obsługi

Łańcuch rozstrzygnięcia to `query → canonical address candidates → service-area rules → schedule`. Kandydat zachowuje dowody dopasowania i score. Gdy dwie najlepsze reguły są nierozstrzygalne, wynik ma być niejednoznaczny; nie wybiera się harmonogramu tylko dlatego, że istnieje.

Reguła może zależeć od TERC/SIMC/ULIC, nazwy ulicy, zakresu lub parzystości numeru, typu zabudowy i wyjątków źródłowych. Geometria wspiera rozstrzygnięcie, ale nie zastępuje opublikowanej reguły operatora.

## Coverage i correctness

Presence źródła w gminie nie jest tym samym co pełne pokrycie adresów.

Obowiązują osobne metryki:

- **municipality source presence** — gmina ma co najmniej jeden aktywny zakres;
- **address coverage** — udział wszystkich oficjalnych adresów PRG, dla których resolver zwraca jednoznaczny właściwy service area i harmonogram;
- **audited-address correctness** — zgodność odpowiedzi dla jawnie zdefiniowanej próbki testowej/audytowej;
- **ambiguity** — przypadki, których nie można bezpiecznie rozstrzygnąć.

Aktualne `415/415` oznacza poprawność w audytowanych zestawach realnych adresów PRG. Nie jest denominator całego regionu. Pełne coverage ma zostać policzone przez PRG Address Coverage Census.

## Harmonogram i frakcje

Każde wydarzenie wiąże datę, frakcję, service area i provenance. Normalizacja nazw frakcji nie usuwa oryginalnej etykiety źródłowej. Duplikaty semantyczne podlegają deterministycznej deduplikacji; konflikt dat lub obszaru wymaga review.

Fixtures w migracjach i testach są oznaczane jako fixture-derived. Nie wolno prezentować ich jako pełnego produkcyjnego pobrania. Historyczne zestawy 30/100 adresów oraz nowsze dodatkowe gate'y pozostają kontraktami regresyjnymi/audytowymi, ale nie zastępują pełnego census wszystkich adresów PRG pilota.

## Obiekty

`facilityKind` rozróżnia rodzaj obiektu; materiały, typy opakowań i limity są capabilities/assertions. Brak informacji daje `UNKNOWN` lub brak wartości, nigdy domyślne „otwarte” albo wymyślone współrzędne. Godziny muszą zachować strefę/tekst źródłowy i wyjątki, jeżeli kontrakt je wspiera.

Przy wielu źródłach obowiązuje jawna polityka pierwszeństwa, świeżości i rekonsyliacji opisana w ADR 0004–0007. Sprzeczność jest stanem operacyjnym do review.

## Jakość i provenance

Odpowiedź użytkowa powinna pozwolić ustalić:

- z jakiego URL-a i artefaktu pochodzi;
- kiedy źródło pobrano i jakiego okresu dotyczy;
- jaki parser i wersja kontraktu wytworzyły wynik;
- czy wynik był zweryfikowany, fixture-derived lub wymaga review;
- jakie ostrzeżenia i confidence dotyczą dopasowania.

Confidence nie jest substytutem dowodu. Wysoki score modelu nie może przeważyć nad sprzecznym źródłem oficjalnym.

## Kompatybilność

Zmiany kompatybilne mogą rozszerzać dane zgodnie z regułami kontraktu. Usunięcie pola, zmiana znaczenia, zawężenie enum lub inna interpretacja czasu wymaga nowej wersji. Przykłady w [schemas/examples](../../schemas/examples/) są fixtures kontraktowymi, nie osobną specyfikacją.
