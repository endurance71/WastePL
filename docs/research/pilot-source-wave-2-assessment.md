# Pilot source wave 2 — assessment 2026-08-28

## Cel

Ocena sześciu gmin pozostających poza aktywnym pokryciem harmonogramów oraz wybór najmniejszej bezpiecznej fali aktywacyjnej. Zasada nadrzędna: udany HTTP lub podobieństwo URL nie oznacza wsparcia. Źródło staje się `ACTIVE` dopiero po istnieniu deterministycznego parsera/handlera, regresyjnego evidence packa i uczciwego modelu semantycznego.

## Decyzja fali

Do pierwszej aktywacji wybrano **PSZOK Bobolice** i **PSZOK Świeszyno**. Oba źródła są bezpośrednimi oficjalnymi stronami HTML i publikują wystarczające, jednoznaczne dane do zbudowania canonical facility bez zgadywania współrzędnych ani rozbijania niejednoznacznych frakcji.

Ta fala zwiększa liczbę gmin z co najmniej jednym aktywnym typem danych, ale **nie zwiększa liczby gmin z aktywnym harmonogramem odbioru**. Harmonogramy nadal mają być raportowane osobno.

## Bobolice — TERC 3209033

### Harmonogram 2026

- Parent: `https://bobolice.pl/cms/5665`
- Kształt: `MIXED_MEDIA`
- Evidence: `PARTIAL`
- Status: `PLANNED`
- Blocker: `CURRENT_H2_MIXED_IMAGE_AND_ATTACHMENT_SET_REQUIRES_CHILD_ARTIFACT_ADAPTER`

Bieżąca publikacja 2026 była wielokrotnie aktualizowana, a w połowie roku zmienił się wykonawca odbioru. Strona miesza treści/obrazy/załączniki. WastePL nie deklaruje obsługi, dopóki dokładne child artifacts i ich okres obowiązywania nie będą utrzymywane deterministycznie.

### PSZOK Boboliczki

- Parent: `https://bobolice.pl/cms/8587`
- Kształt: `DIRECT_CONTENT`
- Evidence: `VERIFIED`
- Status w 2026.2: `ACTIVE`
- Parser: `municipal-pszok-html`

Źródło publikuje lokalizację opisową w Boboliczkach przy nieczynnym składowisku, godziny poniedziałek/środa/sobota, zakres użytkowników oraz listę przyjmowanych grup odpadów. Brak źródłowych współrzędnych jest zachowany jako `location=null`; WastePL nie geokoduje takiego punktu „na oko”.

## Sianów — TERC 3209073

### Harmonogram II półrocze 2026

- Parent: `https://sianow.pl/dla-mieszkanca/odpady-komunalne/nieruchomosci-zamieszkale/harmonogram-odbioru-odpadow/`
- Kształt: `MULTI_ROUTE_PDF_SET`
- Evidence: `VERIFIED`
- Status: `PLANNED`
- Blocker: `GENERIC_SEGREGATED_COLUMN_NOT_CANONICALLY_MAPPED`

Parent publikuje osobne PDF-y dla tras 1–15, tras S1–S3 oraz W1–W5. Exact child URLs są zapisane w manifeście 2026.2. Próbkowany oficjalny PDF używa kolumny „odpady segregowane”, podczas gdy WastePL ma kanoniczne frakcje m.in. PAPER, GLASS i METALS_PLASTICS. Bez jawnego źródłowego mapowania nie wolno automatycznie rozdzielać tej kolumny.

## Świeszyno — TERC 3209082

### Harmonogram 2026

- Parent: `https://swieszyno.pl/harmonogram-wywozu-odpadow-komunalnych-na-rok-2026/`
- Kształt: `ATTACHMENT_INDEX`
- Evidence: `PARTIAL`
- Status: `PLANNED`
- Blocker: `LEGACY_CHILD_HOST_REQUIRES_STABLE_ARTIFACT_CAPTURE`

Oficjalny parent wskazuje cztery trasy, ale child artifacts są obsługiwane przez starszy host BIP i nie zostały jeszcze zamrożone jako deterministyczny evidence pack.

### PSZOK Chałupy 13B

- Parent: `https://swieszyno.pl/punkt-selektywnej-zbiorki-odpadow-komunalnych-pszok/`
- Kształt: `DIRECT_CONTENT`
- Evidence: `VERIFIED`
- Status w 2026.2: `ACTIVE`
- Parser: `municipal-pszok-html`

Strona publikuje Chałupy 13B, operatora EKOSAN Sp. z o.o., dostęp dla mieszkańców oraz godziny poniedziałek 09:00–17:00 i wtorek–piątek 08:00–16:00. Strona główna podaje jedynie przykładową kategorię odpadów budowlanych, dlatego adapter publikuje tylko tę kategorię i ostrzeżenie o częściowym katalogu materiałów zamiast przepisywać niewczytane załączniki.

## Będzino — TERC 3209012

### Harmonogram II półrocze 2026

- Parent: `https://bip.bedzino.pl/?id=6920&type=article`
- Kształt: `MULTI_ROUTE_PDF_SET`
- Evidence: `PARTIAL`
- Status: `PLANNED`
- Blocker: `MULTI_ATTACHMENT_H2_SET_REQUIRES_CHILD_DISCOVERY_AND_ROUTE_COVERAGE_MODEL`

BIP publikuje wiele osobnych plików dla tras, miejscowości i nieruchomości trudnodostępnych. Próbkowane route PDF-y są tekstowe i regularne, co czyni Będzino dobrym kandydatem do kolejnej fali, ale aktywacja całej gminy wymaga pełnej enumeracji child setu oraz jawnego modelu pokrycia tras.

## Polanów — TERC 3209063

### Harmonogram 2026

- Registry parent: `https://bip.polanow.pl/zalacznik/c12f707570cc18225e6954fa8a79780d/70/2660/`
- Kształt: `ATTACHMENT_INDEX`
- Evidence: `PARTIAL`
- Status: `PLANNED`
- Blocker: `CURRENT_H2_CHILD_SET_NOT_YET_CANONICALLY_ENUMERATED`

Aktualne strony gminy/BIP wskazują harmonogram II półrocza, ale exact H2 attachment set nie został jeszcze jednoznacznie powiązany z obecną registry identity. Nie wolno użyć starszego/łatwo dostępnego PDF-a tylko dlatego, że ma poprawny rok i podobny tytuł.

## Tychowo — TERC 3201043

### Harmonogram 2026

- Parent: `https://tychowo.pl/wiadomosci/128301/harmomogram-odbioru-odpadow-komunalnych-na-2026-r-`
- Kształt: `ATTACHMENT_INDEX`
- Evidence: `VERIFIED`
- Status: `PLANNED`
- Blocker: `PDF_TEMPLATE_NOT_YET_REGRESSION_CAPTURED`

Parent ma dwa dokładnie zidentyfikowane child PDF-y: harmonogram standardowy i harmonogram dla nieruchomości trudnodostępnych. To dobry kandydat do kolejnej aktywacji, ale treść PDF-ów musi najpierw zostać przechwycona jako deterministic fixture i przejść walidację kanonicznych frakcji/coverage.

## Kolejność dalszej pracy

1. Bobolice PSZOK + Świeszyno PSZOK: parser, fixtures, handler E2E, readiness, golden gates.
2. Tychowo: przechwycenie dwóch PDF-ów i ocena template.
3. Będzino: kompletna enumeracja H2 child setu + route coverage model.
4. Sianów: rozstrzygnięcie źródłowej semantyki generic „odpady segregowane”.
5. Świeszyno schedule: stabilne przechwycenie legacy child artifacts.
6. Bobolice schedule i Polanów: dopiero po ustabilizowaniu exact current child identities.
