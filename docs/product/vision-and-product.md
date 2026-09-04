# Wizja i produkt

## Teza

WastePL ma być neutralną warstwą danych o odpadach komunalnych w Polsce. Łączy rozproszone publikacje gmin, BIP i operatorów w wersjonowany, audytowalny model, dzięki któremu aplikacje nie muszą implementować osobnej integracji dla każdej gminy.

Najtrudniejszym elementem nie jest kalendarz w interfejsie, lecz wiarygodne przejście `adres → obszar obsługi → harmonogram`, zachowanie źródła każdego twierdzenia oraz wykrywanie zmian upstream.

## Odbiorcy i potrzeby

- Mieszkaniec chce poznać najbliższe odbiory, zasady segregacji i właściwy PSZOK bez rozumienia rejonów operatora.
- JST i spółka komunalna potrzebują audytowalnego kanału publikacji oraz informacji o jakości i świeżości danych.
- Partner technologiczny potrzebuje stabilnego API i kontraktów niezależnych od formatu źródła.
- Zespół data-ops potrzebuje widoczności źródeł, błędów parsera, konfliktów i kolejki review.

## Produkt w warstwach

1. **Warstwa danych** — rejestr źródeł, immutable artifacts, parsery, normalizacja, wersjonowanie i provenance.
2. **Warstwa API** — rozwiązywanie adresu, harmonogram, facilities i metadane jakości.
3. **Warstwa operacyjna** — manifesty, source health, review, readiness i live-source gates.
4. **Warstwa doświadczenia** — PWA, mapa PSZOK, `.ics`, przypomnienia i integracje partnerów.

## Zakres obecnego pilota

Na 2026-09-04 WastePL ma:

- 8 gmin w manifeście regionalnym;
- 8/8 gmin z co najmniej jednym ACTIVE collection scope;
- 8/8 gmin z ACTIVE PSZOK;
- 17 ACTIVE source identities;
- 415/415 audytowanych realnych adresów PRG przechodzących zdefiniowane gate'y;
- publiczne API i wewnętrzne source-ops/review API;
- konsumencką PWA z harmonogramem, provenance, PSZOK, mapą i `.ics`;
- Playwright E2E.

Ten stan **nie oznacza pełnego pokrycia wszystkich adresów w 8 gminach**. Część collection sources obejmuje bezpieczne podzbiory miejscowości lub tras. Pełny address coverage będzie znany dopiero po PRG Address Coverage Census.

## Co nadal jest poza domkniętym zakresem

- pełne address coverage obecnych 8 gmin;
- produkcyjne środowisko z monitoringiem, backup/restore i alertingiem;
- regularny live-source monitoring całej aktywnej floty;
- pełna installability/a11y/Lighthouse PWA;
- produkcyjny scheduled Web Push;
- udowodniona ekonomia utrzymania na skalę krajową;
- ogólnopolski rollout;
- billing i rozbudowany system kont.

## Zasady produktu

- **Źródło przed wygodą** — każda odpowiedź istotna dla użytkownika ma wskazywać pochodzenie i świeżość.
- **`UNKNOWN` jest prawidłowym stanem** — brak danych nie może być zamieniany na zmyśloną wartość.
- **Deterministyczny parser jest domyślny** — OCR/AI może wspierać ekstrakcję, ale nie omija walidacji i review.
- **Ambiguity is a result** — system zwraca konflikt zamiast cicho wybierać niepewny harmonogram.
- **Coverage liczymy po adresach, nie po samych gminach** — `8/8 gmin z ACTIVE source` nie jest równoznaczne z `100% address coverage`.
- **Kontrakty i decyzje są wersjonowane w GitHubie** — Drive prezentuje zatwierdzony stan.

## Miara wartości

Najpierw mierzymy:

- udział wszystkich oficjalnych adresów PRG rozwiązanych jednoznacznie;
- correctness dat i frakcji na audytowanych próbkach;
- ambiguity i unsupported rate;
- freshness i source health;
- czas wykrycia i naprawy driftu;
- koszt wdrożenia i miesięcznego utrzymania źródła/gminy;
- skuteczność wyszukania adresu przez realnego użytkownika;
- użycie `.ics`/reminderów i repeat usage.

Retencja, przychód i rollout krajowy mają sens dopiero po przekroczeniu bramki jakości danych i operacji.
