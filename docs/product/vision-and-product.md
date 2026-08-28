# Wizja i produkt

## Teza

WastePL ma być neutralną warstwą danych o odpadach komunalnych w Polsce. Łączy rozproszone publikacje gmin, BIP i operatorów w wersjonowany, audytowalny model, dzięki któremu aplikacje nie muszą implementować osobnej integracji dla każdej gminy.

Najtrudniejszym elementem nie jest kalendarz w interfejsie, lecz wiarygodne przejście `adres → obszar obsługi → harmonogram`, zachowanie źródła każdego twierdzenia oraz wykrywanie zmian upstream.

## Odbiorcy i potrzeby

- Mieszkaniec chce poznać najbliższe odbiory, zasady segregacji i właściwy PSZOK bez rozumienia rejonów operatora.
- JST i spółka komunalna potrzebują jednego audytowalnego kanału publikacji oraz informacji o jakości i świeżości danych.
- Partner technologiczny potrzebuje stabilnego API i kontraktów niezależnych od formatu źródła.
- Zespół data-ops potrzebuje widoczności źródeł, błędów parsera, konfliktów i kolejki review.

## Produkt w warstwach

1. Warstwa danych: rejestr źródeł, immutable artifacts, parsery, normalizacja, wersjonowanie i provenance.
2. Warstwa API: rozwiązywanie adresu, harmonogram, obiekty i metadane jakości.
3. Warstwa operacyjna: manifesty, health źródeł, review i readiness gates.
4. Warstwa doświadczenia: aplikacja web/mobile, przypomnienia i integracje partnerów — po osiągnięciu jakości danych.

## Zakres obecnego PoC

- osiem gmin fali Koszalin w manifeście, z aktywną obsługą harmonogramów dla dwóch;
- harmonogramy, PSZOK i punkty kaucyjne w modelu danych;
- deterministyczne adaptery źródłowe i ręczne review wyjątków;
- PRG/TERYT jako referencja adresowa;
- API i bramki jakości opisane w [bieżącym statusie](../current-status.md).

Poza bieżącym zakresem pozostają ogólnopolski rollout, pełna aplikacja konsumencka, billing, implementacja wszystkich formatów dokumentów oraz zastępowanie oficjalnych systemów JST.

## Zasady produktu

- Źródło przed wygodą: każda odpowiedź istotna dla użytkownika ma wskazywać pochodzenie i świeżość.
- `UNKNOWN` jest prawidłowym stanem; brak danych nie może być zamieniany na zmyśloną wartość.
- Deterministyczny parser jest domyślny. OCR/AI może wspierać ekstrakcję, ale nie omija walidacji i review.
- Ambiguity is a result: system zwraca konflikt zamiast cicho wybierać niepewny harmonogram.
- Kontrakty i decyzje są wersjonowane w GitHubie; Drive prezentuje zatwierdzony stan.

## Miara wartości

Najpierw mierzymy pokrycie i poprawność: odsetek realnych adresów rozwiązanych jednoznacznie, zgodność wydarzeń ze źródłem, świeżość, liczbę nieobsługiwanych zmian i czas do naprawy. Retencja użytkownika oraz przychód mają sens dopiero po przekroczeniu bramki jakości danych.
