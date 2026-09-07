# Sianów H2 2026 — decyzja semantyczna dla `odpady segregowane`

> Weryfikacja: 2026-09-07  
> Zakres: aktywne harmonogramy jednorodzinne Sianowa H2 2026  
> Decyzja: zachować źródłową kategorię zbiorczą jako `OTHER`; nie inferować `PAPER`, `GLASS` ani `METALS_PLASTICS`.

## Dlaczego ta decyzja jest potrzebna

Podczas wyboru kolejnego zakresu address coverage wykryto regresję semantyczną wprowadzoną w PR #119 (`feat(coverage): split generic segregated waste in Sianów into canonical fractions`). Parser zaczął generować trzy osobne zdarzenia `PAPER`, `GLASS` i `METALS_PLASTICS` dla każdego terminu opisanego w źródle wyłącznie jako `odpady segregowane`.

Nie znaleziono nowego dowodu źródłowego uzasadniającego taki split. Wcześniejsza analiza Sianowa w `docs/research/sianow-h2-2026-assessment.md`, sekcja 4, wskazuje wprost, że zbiorczej kolumny nie należy sztucznie rozbijać na frakcje materiałowe.

## Dowód źródłowy

Oficjalny indeks harmonogramów:

`https://sianow.pl/dla-mieszkanca/odpady-komunalne/nieruchomosci-zamieszkale/harmonogram-odbioru-odpadow/ii-polrocze-2026/`

Aktywne artefakty jednorodzinne używane przez WastePL mają układ kolumn obejmujący m.in.:

- `odpady zmieszane`;
- `odpady segregowane`;
- `odpady biodegradowalne`;
- `gabaryty`.

Repozytoryjne deterministic fixtures zachowują dokładnie tę semantykę, m.in.:

- `apps/worker/test/fixtures/pdf-text/sianow-dabrowa-grabowko-h2-2026.txt`;
- `apps/worker/test/fixtures/pdf-text/sianow-borowiec-h2-2026.txt`;
- `apps/worker/test/fixtures/pdf-text/sianow-skwierzynka-h2-2026.txt`.

W oficjalnych harmonogramach, w których PGK publikuje frakcje materiałowe osobno, występują jawne osobne kolumny, np. `tworzywa sztuczne`, `makulatura`, `szkło`. Tego poziomu informacji nie ma w aktywnych źródłach jednorodzinnych wskazanych wyżej.

## Obowiązujące mapowanie

| Etykieta źródłowa | WastePL | Uzasadnienie |
| --- | --- | --- |
| odpady zmieszane | `MIXED` | mapowanie jednoznaczne |
| bioodpady / odpady biodegradowalne | `BIO` | mapowanie jednoznaczne |
| odpady segregowane | `OTHER` | kategoria zbiorcza; brak dowodu na osobne terminy materiałowe |
| gabaryty | `BULKY` | mapowanie jednoznaczne |

Dla `OTHER` parser dodaje warning:

`SOURCE_FRACTION_GENERIC_SEGREGATED_MAPPED_TO_OTHER`

oraz notę informującą, że jest to zbiorcza kategoria źródłowa i WastePL nie inferuje frakcji materiałowych.

## Reguła regresyjna

Test parsera musi jawnie potwierdzać dla aktywnych harmonogramów jednorodzinnych Sianowa:

- obecność `OTHER` dla źródłowych dat `odpady segregowane`;
- brak wygenerowanych `PAPER`;
- brak wygenerowanych `GLASS`;
- brak wygenerowanych `METALS_PLASTICS`;
- zachowanie źródłowych dat bez zmian.

## Wpływ na coverage

Ta korekta **nie zmienia address coverage**. Service areas, PRG reference snapshots i reguły dopasowania adresów pozostają bez zmian. Zmienia się wyłącznie semantyka zdarzeń odbioru zwracanych dla już obsługiwanych adresów Sianowa.

Po korekcie bieżący Census pozostaje na poziomie 559 / 3520 adresów Sianowa oraz 12 816 / 25 030 dla całego pilota, o ile niezależny census nie wskaże innej zmiany.

## Zasada na przyszłość

Coverage nie może być zwiększane przez dodawanie informacji, których źródło nie publikuje. Jeżeli dokument podaje jedynie kategorię zbiorczą, WastePL zachowuje kategorię zbiorczą albo zwraca zakres jako unsupported. Rozbicie na bardziej szczegółowe frakcje jest dozwolone dopiero po uzyskaniu jednoznacznego dowodu źródłowego.
