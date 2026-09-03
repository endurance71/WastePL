# Bobolice H2 2026 Collection Schedule Feasibility & Safe Subset Assessment

Date: 2026-09-03  
Status: VERIFIED  
Target: Gmina Bobolice (`TERC 3209033`)  
Milestone: Pilot municipality collection schedule coverage 7/8 → 8/8 (100%)

## 1. Upstream Publication Structure

Gmina Bobolice publishes official municipal waste collection schedules on its municipal portal:
- URL: `https://bobolice.pl/cms/5169` (Gospodarka Odpadami) and `https://bobolice.pl/cms/5665` (Harmonogramy)
- Host: `bobolice.pl` (Urząd Miejski w Bobolicach)

### Operator Change & H2 Publication Reality
- In July 2026 (effective from 25 June / July 2026), the municipality replaced contractor PGK Koszalin with **ATF Transport Sp. z o.o. / ATF Polska Sp. z o.o.** (Słoneczna 2b, 78-320 Połczyn Zdrój).
- The updated H2 2026 schedule was published on 22 July 2026 as a set of 9 scanned/graphical route sheets:
  1. `Sheet 0` (`...-0.jpg`): Bobolice ulice (Koszalińska, Łąkowa, Matejki, Ogrodowa, Plac Zwycięstwa, Ratuszowa, Reymonta, Seligera, Spichrzowa, Spółdzielcza, Szkolna, Tylna, Wiejska, Wojska Polskiego).
  2. `Sheet 1` (`...-1.jpg`): Bobolice ulice (Fabryczna, Mickiewicza, Przemysłowa, Reja, Robotnicza, Sienkiewicza, Warszawska); Błotko, Chlebowo, Chmielno, Dworzysko, Jatynka, Łozice, Łozice-Cegielnia, Nowe Łozice, Nowosiółki, Ostrówek, Piaszczyte, Ujazd.
  3. `Sheet 2` (`...-2.jpg`): Bobolice ulice (1 Maja, Akacjowa, Brzozowa, Dworcowa, Działkowa, Głowackiego, Górskiego, Jedności Narodowej, Kochanowskiego, Kolejowa, Kwiatów Polnych, Langiewicza, Lipowa, Mieszka I, Osiedlowa, Parkowa, Pionierów, Plac Chrobrego, Pocztowa, Polanowska, Polna, Słowackiego, Spacerowa, Spokojna, Sportowa, Szpitalna, Traugutta, Tuwima, Zielona); Chociwle 32.
  4. `Sheet 3` (`...-3.jpg`): Boboliczki, Chociwle, Cybulino, Drzewiany, Golęszany, Gozd, Górawino, Kępsko, Kurowo, Lubowo, Pniewki, Pomorzany, Porost, Radwanki, Retnica, Rylewo, Stare Borne, Trzebień.
  5. `Sheet 4` (`...-4.jpg`): Janowiec, Opatówek, Sarnowo.
  6. `Sheet 5` (`...-5.jpg`): Bożniewice, Darginek, Dargiń, Dobrociechy, Glinka, Głodowa, Krępa, Przydargiń-Kolonia, Różany, Świelino, Zieleniewo.
  7. `Sheet 6` (`...-6.jpg`): **Kłanino, Przydargiń, Różewko, Ubiedrze, Wilczogóra**.
  8. `Sheet 7` (`...-7.jpg`): **Nieruchomości o utrudnionym dostępie (CRITICAL EXCLUSION SHEET)**.
  9. `Sheet 8` (`...-8.jpg`): Chociwle 27, 27A, 35.

---

## 2. Overlap & Locality Collision Analysis

### 2.1 Critical Exclusion Sheet (Sheet 7 — Utrudniony Dostęp)
Sheet 7 enumerates both specific addresses and whole localities with special narrow/difficult access schedules:
- Whole localities on Sheet 7: Bolechowice, Buszynko Drugie, Buszynko Pierwsze, Darżewo, Grotniki, Jadwiżyn, Jatynia, Kępiste, Kije, Kurówko, Lubino, Spokojne, Stare Łozice, Więcemierz, Wojęcino.
- Localities with specific building number carve-outs on Sheet 7:
  - Bobolice: Mickiewicza 13B, Pionierów 4, Pocztowa 9A, 9B, 9C, 9D
  - Chlebowo: 2, 3, 6, 8, 22, 27
  - Chociwle: 1B, 26, 30, 33G (and Sheet 8: 27, 27A, 35; Sheet 2: 32)
  - Dobrociechy: 5
  - Drzewiany: 37, 79, 81
  - Głodowa: 30
  - Golęszany: 5
  - Gozd: 1, 24, 51
  - Kępsko: 7
  - Krępa: 15, 18, 21, dz.nr 201
  - Łozice: 8A, 14
  - Opatówek: 9, 10
  - Piaszczyte: 1, 3
  - Pomorzany: 4, 5
  - Porost: 1, 65, 67, 68, 70, 73, 74A, 75, 78, 100G
  - Rylewo: 6
  - Stare Borne: 19

Any whole-locality activation of the above localities without building-level filtering would violate the Zero-Overlap Hard Invariant.

### 2.2 Multi-family Housing ("Bobolice wielorodzinna")
The town of Bobolice has multi-family apartment blocks serviced under a separate schedule (`harmonogramy_bobolice_2026_wielorodzinna.pdf`). Rural villages outside the town of Bobolice do not have multi-family housing and are unaffected.

---

## 3. Safe Subset Selection: Kłanino (SIMC `0304214`)

**Kłanino** is selected as the deterministic, 100% collision-free safe subset:
- **TERC**: `3209033` (Gmina Bobolice)
- **SIMC**: `0304214` (wieś Kłanino)
- **Postal code**: `76-020`
- **Streets**: None (pure rural address numbering `Kłanino 1` .. `Kłanino 55b`)
- **PRG Address Count**: Exactly **65 address points** verified via GUGiK Państwowy Rejestr Granic.
- **Zero-Overlap Proof**:
  - `Sheet 7` (Utrudniony dostęp): Kłanino has 0 mentions and 0 addresses.
  - `Sheet 8` & `Sheet 2` carve-outs: Kłanino has 0 mentions.
  - Multi-family schedule: Kłanino is purely rural single-family housing.
  - Other sheets: Kłanino appears exclusively on Sheet 6.

---

## 4. Schedule & Fraction Specification (Sheet 6, VII–XII 2026)

Sheet 6 specifies pickup dates for:
`Kłanino, Przydargiń, Różewko, Ubiedrze, Wilczogóra`

| Month | Zmieszane (MIXED) | Metale i Tworzywa + Szkło (METALS_PLASTICS, GLASS) | Papier + Bio (PAPER, BIO) |
| :--- | :--- | :--- | :--- |
| **Lipiec** | 9\*, 17, 31 | 10, 24 | 17, 31 |
| **Sierpień** | 14, 28 | 7, 21 | 14, 28 |
| **Wrzesień** | 11, 25 | 4, 18 | 11, 25 |
| **Październik** | 9, 23 | 2, 16, 30 | 9, 23 |
| **Listopad** | 6, 20 | 14\*, 27 | 6, 20 |
| **Grudzień** | 4, 17\* | 11, 23\* | 4, 17\* |

\* Oznacza przesunięcie z uwagi na dni świąteczne (zgodnie z objaśnieniem na arkuszu).

### Total Collection Events:
- **MIXED (Zmieszane)**: 13 dates
- **METALS_PLASTICS (Metale i tworzywa sztuczne)**: 13 dates
- **GLASS (Szkło)**: 13 dates
- **PAPER (Papier)**: 12 dates
- **BIO (Bioodpady)**: 12 dates
- **Total Normalized Events**: 63 events across H2 2026.
