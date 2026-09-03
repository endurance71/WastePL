# Analiza wykonalności i plan aktywacji Sianów H2 2026 (TERC `3209073`)

> Data analizy: 2026-09-03  
> Status: Gotowe do aktywacji w kolejnym etapie (6/8 gmin)  
> Podstawa prawna i źródłowa: Oficjalny serwis informacyjny Urzędu Gminy i Miasta w Sianowie  
> URL rodzica: `https://sianow.pl/dla-mieszkanca/odpady-komunalne/nieruchomosci-zamieszkale/harmonogram-odbioru-odpadow/`

---

## 1. Kontekst i cel

Po osiągnięciu pokrycia zbiórek na poziomie 5/8 gmin (Koszalin, Manowo, Tychowo, Polanów, Będzino) oraz 8/8 gmin w zakresie aktywnych typów danych, **Gmina i Miasto Sianów** jest naturalnym, najlepiej udokumentowanym kandydatem do podniesienia wskaźnika odbioru odpadów z **5/8 na 6/8**.

W manifeście `pilot-koszalin-region@2026.7` źródło `sianow-collection-2026-h2` posiada status `PLANNED` z blokerem:
`GENERIC_SEGREGATED_COLUMN_NOT_CANONICALLY_MAPPED`.

Niniejszy dokument formalizuje analizę tras, dowód separacji nieruchomości trudnodostępnych oraz rozwiązanie blokera semantycznego w oparciu o precedensy wypracowane w Polanowie (Garbno) i Będzinie (Dworek).

---

## 2. Inwentarz oficjalnych załączników H2 (23 pliki PDF)

Oficjalny indeks publikuje 23 odrębne harmonogramy PDF dla II półrocza 2026 roku:

### Trasy wiejskie (jednorodne miejscowości)
1. `1-Skwierzynka.pdf` — Miejscowość Skwierzynka (SIMC `0311540`)
2. `2-Wegorzewo-Koszalinskie.pdf` — Miejscowość Węgorzewo Koszalińskie (SIMC `0311680`)
3. `3-Sieciemin.pdf` — Miejscowość Sieciemin (SIMC `0311527`)
4. `4-Klos.pdf` — Miejscowość Kłos (SIMC `0311390`)
5. `5-Sucha-Koszalinska.pdf` — Miejscowość Sucha Koszalińska (SIMC `0311609`)
6. `6-Trawica.pdf` — Miejscowość Trawica
7. `7-Osieki-...pdf` — Osieki (ulice letniskowe)
8. `8-Gorzebadz-i-Kedzierzyn.pdf` — Gorzebądz i Kędzierzyn
9. `9-Dabrowa-i-Grabowko.pdf` — Dąbrowa i Grabówko
10. `10-Skibno-oraz-Skibienko.pdf` — Skibno i Skibienko
11. `11-Kleszcze-Lazy-i-Osieki.pdf` — Kleszcze, Łazy, Osieki
12. `12-Bielkowo-Iwiecino-Rzepkowo-i-Wierciszewo.pdf`
13. `13-Karnieszewice-Kolzin-Plonka-oraz-Trawica-1.pdf`
14. `14-Borowiec.pdf` — Borowiec

### Trasy miejskie (Sianów miasto — podział na ulice)
* `S1-Sianow-Armii-Polskiej-chrobrego-itd.pdf`
* `S2-Sianow-Kopernika-Lubuszan-Mila-Ogrodowa-Przyjaciol-Slowackigo-Wegorzewska-oraz-Zgody.pdf`
* `S3-Sianow-Brzozowa-Bukowa-Debowa-Dworcowa-Jarzebinowa-Klonowa-Kwiatowa-Lipowa-Podgorna-Rzemieslnicza-Sloneczna-Topolowa.pdf`

### Trasy zbiórek wielorodzinnych / workowych
* `w1-Szczeglino.pdf`, `w2-Kleszcze.pdf`, `w3-Rzepkowo.pdf`, `w4-ulice-Sianow.pdf`, `w5-Klos-i-Skibno.pdf`

### Trasa wyłączona / trudnodostępna (CRITICAL EXCLUSION)
* `15-utrudnione.pdf` — harmonogram dla posesji o utrudnionym dojeździe.

---

## 3. Analiza ryzyka nakładania tras (Zero-Overlap Proof)

Zgodnie z zasadami WastePL:
* **Miasto Sianów (`S1`, `S2`, `S3`, `w4`)** wymaga dopasowywania na poziomie ulic (`STREET`), a obecność zabudowy wielorodzinnej (`w4`) niesie ryzyko niejednoznaczności typów budynków (`building_type`).
* **Trasa `15-utrudnione.pdf`** zawiera enumerację posesji w wybranych miejscowościach.
* **Kandydat na bezpieczny podzbiór (Safe Rural Subset):**
  Podobnie jak w Będzinie (Dworek) i Polanowie (Garbno), należy wybrać miejscowość wiejską:
  * występującą w dokładnie jednym, dedykowanym pliku PDF (np. `1-Skwierzynka.pdf` lub `2-Wegorzewo-Koszalinskie.pdf`),
  * całkowicie nieobecną w wykazie `15-utrudnione.pdf`,
  * posiadającą wyłącznie zabudowę jednorodzinną / zagrodową,
  * w pełni identyfikowalną w rejestrach TERYT (SIMC) oraz PRG (punkty adresowe).

---

## 4. Rozstrzygnięcie blokera semantycznego (Frakcja Segregowana)

W harmonogramach PGK dla Sianowa występuje układ:
1. `Zmieszane odpady komunalne` → mapowane jednoznacznie na `MIXED`
2. `Bioodpady` → mapowane jednoznacznie na `BIO`
3. `Odpady segregowane` (połączona zbiórka) → **zgodnie z precedensem ADR-0004 i Polanowa nie wolno sztucznie rozbijać tej kolumny na PAPER, GLASS, METALS_PLASTICS**. Zostaje ona bezpiecznie zmapowana na `OTHER` z czytelną notą źródłową w API (`"Odpady segregowane (tworzywa, papier, szkło wg wytycznych gminy)"`).

---

## 5. Plan wdrożenia podniesienia pokrycia 5/8 → 6/8

1. **Pobranie i zamrożenie artefaktu:**
   Pobranie `1-Skwierzynka.pdf` lub `2-Wegorzewo-Koszalinskie.pdf`, rejestracja SHA-256 i weryfikacja warstwy tekstowej.
2. **Profil parsera:**
   Wykorzystanie adaptera `municipal-collection-pdf-text` z nowym profilem `sianow-h2-profile.ts` (wzorowanym na `bedzino-h2-profile.ts`).
3. **Paczka referencyjna PRG:**
   Wygenerowanie snapshotu adresowego PRG dla wybranej miejscowości (np. Skwierzynka lub Węgorzewo).
4. **Bramki jakościowe:**
   Utworzenie `sianow-post-gate.ts` oraz `sianow-api-post-gate.ts` (wymagane 0 błędnych dat, 0 niejednoznaczności, 100% poprawności).
5. **Manifest `2026.8`:**
   Aktywacja źródła w manifeście, aktualizacja metryk onboardingowych i podniesienie pokrycia gmin do 6/8.
