# WastePL — plan dalszych prac po rollout 2026.5

> Stan bazowy: 2026-08-29, `main` = `6eaefe1b711eb2ea62f3d62f40662389c55c9065`.
> Ten dokument opisuje kolejność wykonawczą i bramki decyzyjne. Nie jest obietnicą terminu.

## 1. Stan wyjściowy

WastePL ma działający i zweryfikowany Data Platform PoC, a nie tylko szkielet aplikacji.

- 8 gmin w manifeście pilota;
- 6/8 gmin z co najmniej jednym aktywnym typem danych;
- 3/8 gmin z aktywnym harmonogramem odbioru;
- 5/8 gmin z aktywnym PSZOK;
- 9 źródeł `ACTIVE`, 8 źródeł `PLANNED`;
- real-address consumer gate: 100/100;
- krytyczne schedule/date mismatches: 0;
- ambiguous responses: 0;
- golden facilities: 8/8;
- ostatni pełny CI #149 zakończony `success` dla drzewa identycznego z aktualnym `main`.

Aktualna architektura obejmuje `apps/api` i `apps/worker`. Konsumencki frontend/PWA nie został jeszcze rozpoczęty.

## 2. Najważniejsze luki

### P0 — blokery przed szerokim pilotem konsumenckim

1. Brak ręcznie przejrzanego live-source staging soak z aktualnego `main` (`#60`).
2. Collection coverage wynosi tylko 3/8.
3. `main` nie ma aktywnej branch protection ani wymaganych status checks, mimo że polityka projektu zakłada zielony CI przed merge.
4. Roadmapa produktowa i materiały Google Drive są starsze niż aktualny stan techniczny; GitHub pozostaje źródłem kanonicznym, ale warstwa prezentacyjna wymaga synchronizacji.

### P1 — luki produktu konsumenckiego

1. Brak PWA / interfejsu użytkownika.
2. Brak powiadomień o najbliższym odbiorze.
3. Nie wszystkie facility mają zaufane współrzędne, więc mapa nie może zakładać kompletnej geometrii.
4. Brak ustalonego ogólnopolskiego produkcyjnego feedu punktów systemu kaucyjnego.

## 3. Kolejność dalszych prac

## Faza A — utwardzenie procesu i zamknięcie real-source gate

### A1. Wymusić politykę merge

Cel: zlikwidować możliwość scalenia kodu bez wymaganych testów.

Zakres:

- włączyć branch protection dla `main`;
- wymagać pełnego workflow `ci` przed merge;
- wyłączyć bezpośredni push do `main` poza świadomym trybem administracyjnym;
- zachować squash/PR flow;
- po zmianie wykonać kontrolny PR dokumentacyjny i potwierdzić blokadę merge przy czerwonym/pending CI.

Definition of Done:

- GitHub nie pozwala scalić PR do `main`, jeśli wymagany CI nie zakończy się sukcesem.

### A2. Domknąć `#60` — live-source staging soak

Cel: udowodnić, że aktywne źródła i parsery przeżywają kontakt z aktualnym publicznym webem, a nie tylko z frozen fixtures.

Zakres:

- uruchomić `live-source-staging.yml` z aktualnego `main`;
- sprawdzić wszystkie 9 `ACTIVE` sources z najnowszego manifestu;
- ręcznie przejrzeć raport JSON i Markdown;
- zweryfikować redirects, content type, parser drift, bundle completeness i source health;
- zamknąć `#60` dopiero po przejrzeniu realnego runu.

Definition of Done:

- każdy aktywny source ma jawny wynik;
- brak nierozstrzygniętego krytycznego driftu;
- raport live-source jest zachowany jako evidence.

## Faza B — podnieść collection coverage

### B1. `S05-04` / `#76` — Polanów H2 do 4/8

To jest obecnie najwyższy priorytet funkcjonalny.

Zakres:

- udowodnić stabilny runtime capture dla H2 child PDFs;
- zamrozić exact child identities i SHA/provenance;
- nie dopuścić do skażenia H1;
- zweryfikować szablon frakcji na reprezentatywnych PDF-ach;
- zbudować wyłącznie niepokrywające się, source-backed service areas;
- wyłączyć difficult-access i multi-family overlap, jeśli nie da się ich rozstrzygnąć deterministycznie;
- dodać realne PRG/TERYT cases dla Polanowa;
- osiągnąć >=99% correctness i 0 krytycznych błędów dat;
- wypuścić immutable manifest `2026.6`;
- zapisać kolejny `PROSPECTIVE` onboarding record.

Definition of Done:

- collection coverage rośnie z 3/8 do 4/8 bez obniżenia jakości istniejących gmin.

### B2. Następna gmina kolekcyjna: 4/8 → 5/8

Nie wybierać gminy na podstawie łatwości marketingowej. Wybrać tę, która daje najlepszy stosunek:

`determinism / koszt adaptera / stabilność źródła / liczba adresów / ryzyko ambiguity`.

Kandydaci do ponownej oceny:

- Bobolice — po rozwiązaniu mixed image/attachment H2 child adapter;
- Świeszyno — po stabilnym artifact capture z legacy child host;
- Będzino — dopiero po deterministycznej relacji route/address i difficult-access;
- Sianów — dopiero po bezpiecznym modelu dla generic `odpady segregowane`.

Definition of Done:

- aktywny harmonogram w 5/8 gmin;
- real-address gate rozszerzony o nowe przypadki;
- nadal 0 critical wrong-date errors.

## Faza C — pierwszy produkt konsumencki

### C1. Start `#51` — thin PWA

Start gate:

- `#60` zamknięte realnym, ręcznie przejrzanym live-source runem;
- real-100 gate pozostaje zielony;
- coverage jest co najmniej 4/8, preferowane 5/8 przed publicznym testem.

Zakres MVP PWA:

1. wyszukiwanie i rozwiązywanie adresu;
2. następny odbiór + lista kolejnych terminów;
3. frakcja, data, freshness i źródło;
4. jawny stan unsupported / ambiguous / stale / review;
5. zapis jednego lub kilku adresów lokalnie, bez kont;
6. lista najbliższych PSZOK;
7. mapa tylko dla obiektów z wiarygodną lokalizacją;
8. instalowalna PWA, mobile-first;
9. podstawowe accessibility i Lighthouse gate.

Nie przenosić parserów ani wiedzy gminnej do frontendu. PWA ma być wyłącznie konsumentem publicznego API WastePL.

### C2. Powiadomienia

Po potwierdzeniu UX PWA:

- lokalne przypomnienia / Web Push o jutrzejszym odbiorze;
- możliwość wyboru godzin przypomnienia;
- brak kont użytkownika w pierwszej iteracji, jeśli nie jest to konieczne;
- jasna obsługa zmian harmonogramu i stale data.

## Faza D — facilities i mapa

### D1. Trusted geocoding facilities

Cel: zwiększyć liczbę PSZOK z wiarygodnymi pinami bez fabrykowania współrzędnych.

Preferowana kolejność:

1. oficjalne współrzędne ze źródła;
2. dopasowanie adresu do oficjalnego PRG;
3. `location=null`, jeśli nie ma wystarczającego dowodu.

Geocoding musi mieć własne provenance i nie może udawać claimu źródła gminnego.

### D2. System kaucyjny

Traktować jako osobny strumień danych, nie blocker harmonogramów.

Najpierw ustalić:

- wiarygodny ogólnopolski feed;
- licencję/warunki użycia;
- freshness i sposób aktualizacji;
- jakość geolokalizacji;
- sposób deduplikacji z innymi punktami zwrotu.

Bez tego nie budować ręcznie utrzymywanej ogólnopolskiej mapy.

## Faza E — skalowanie pilota

### E1. Zamknięcie 8-gminnego pilota

Warunki:

- wszystkie 8 gmin ma uzgodniony aktywny zakres danych albo jawnie zatwierdzony scope boundary;
- collection coverage spełnia ustalony próg pilota;
- real-address gates są rozszerzone i audytowalne;
- live-source checks są regularnie wykonywane;
- znamy rzeczywisty koszt onboardingu i repeat updates;
- incydent źródłowy ma właściciela i runbook.

### E2. Fala 20 gmin

Nie rozpoczynać tylko po to, aby podbić liczbę gmin.

Start dopiero, gdy:

- adapter reuse jest mierzalny;
- onboarding ma kilka kolejnych pełnych `PROSPECTIVE` pomiarów;
- repeat-update automation pozostaje wysoka;
- median human-active onboarding time i koszt utrzymania są akceptowalne;
- proces source drift/review działa operacyjnie.

## 4. Priorytety backlogu

| Priorytet | Zadanie | Wynik biznesowo-techniczny |
| --- | --- | --- |
| P0 | Branch protection + required CI | brak niezweryfikowanych merge'y |
| P0 | Live-source soak `#60` | dowód działania na prawdziwych upstreamach |
| P0 | Polanów `#76` | collection coverage 4/8 |
| P1 | Następna gmina collection | coverage 5/8 |
| P1 | Thin PWA `#51` | pierwszy używalny produkt konsumencki |
| P1 | Facility trusted geocoding | sensowna mapa PSZOK bez fałszywych pinów |
| P2 | Notifications | codzienna wartość użytkowa |
| P2 | Deposit-return feed | rozszerzenie mapy o system kaucyjny |
| P2 | Fala 20 gmin | walidacja skalowalności modelu data-ops |

## 5. Czego teraz nie robić

- nie budować natywnej aplikacji iOS/Android przed walidacją cienkiej PWA;
- nie dodawać kont, profili, social features ani rozbudowanego CMS;
- nie zwiększać liczby prostych PSZOK kosztem collection coverage;
- nie zgadywać mapowań frakcji, tras, budynków ani współrzędnych;
- nie liczyć fixture CI jako zastępstwa dla live-source soak;
- nie robić ogólnopolskiego rolloutu przed dowodem unit economics i source-ops.

## 6. Najbliższa sekwencja wykonawcza

1. branch protection / required CI;
2. realny `live-source-staging` i domknięcie `#60`;
3. `#76` Polanów H2 → manifest `2026.6` → collection 4/8;
4. aktualizacja `current-status` i roadmapy po 2026.6;
5. start cienkiej PWA `#51` równolegle z wyborem następnej gminy collection;
6. collection 5/8;
7. trusted facility geocoding + mapa;
8. powiadomienia;
9. dopiero później system kaucyjny i fala 20 gmin.

## Decyzja

**Data Platform PoC: GO.**

**Kolejny rozwój backendu: GO, ale priorytetem jest coverage i real-source verification, nie nowe abstrakcje.**

**Thin PWA: warunkowe GO po zamknięciu `#60`; rekomendowane rozpoczęcie po Polanowie 4/8.**

**Szeroki publiczny pilot: nadal NO-GO do czasu live-source soak i wzrostu collection coverage.**
