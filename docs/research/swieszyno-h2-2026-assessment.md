# Świeszyno 2026 Collection Schedule Feasibility & Safe Subset Assessment

Date: 2026-09-03  
Status: VERIFIED  
Target: Gmina Świeszyno (`TERC 3209082`)  
Milestone: Pilot municipality collection schedule coverage 6/8 → 7/8 (87.5%)

## 1. Upstream Publication Structure

Gmina Świeszyno publishes official waste collection schedules on its municipal portal:
- URL: `https://swieszyno.pl/harmonogram-wywozu-odpadow-komunalnych-na-rok-2026/`
- Host: `swieszyno.pl` (portal) and `ug.swieszyno.ibip.pl` (official municipal BIP host for binary downloads)

The municipal portal enumerates 4 distinct route PDFs:
1. **Single-family (Nieruchomości Jednorodzinne) TRASA I**:
   - Localities: `Konikowo, Chałupy, Niekłonice`
   - URL: `https://ug.swieszyno.ibip.pl/public/getFile?id=472491`
   - Live PDF SHA-256: `8a37e48e2031ef611135b4157e7706dc1bd9531213ea3af417d9c53fc1d6cd5d`
2. **Single-family (Nieruchomości Jednorodzinne) TRASA II**:
   - Localities: `Niedalino, Czacz, Zegrzyn, Kurozwęcz, Zegrze Pomorskie, Sieranie, Czaple, Świeszyno, Kępa Świeszyńska, Olszak, Włoki, Bagno, Chłopska Kępa, Brzeźniki, Strzekęcino, Golica, Bardzlino, Dunowo, Biała Kępa, Krokowo, Jarzyce, Giezkowo, Czersk Koszaliński, Kłokęcin, Mierzym, Węgorki`
   - URL: `https://ug.swieszyno.ibip.pl/public/getFile?id=472490`
   - Live PDF SHA-256: `82de261454b0d085d60800f1c936f4c01ea6a485a3e57ac18551b56f8fbaff96`
3. **Multi-family (Wspólnoty Mieszkaniowe) TRASA I**:
   - Localities: `Konikowo, Niekłonice`
   - URL: `https://ug.swieszyno.ibip.pl/public/getFile?id=472488`
   - Live PDF SHA-256: `61ef7bc4c397d48d91078bdb52fae82eb66e0726cb2f455ab4aa10ad1fc1464d`
4. **Multi-family (Wspólnoty Mieszkaniowe) TRASA II**:
   - Localities: `Świeszyno, Strzekęcino, Niedalino, Zegrze Pomorskie, Dunowo, Bardzlino, Mierzym`
   - URL: `https://ug.swieszyno.ibip.pl/public/getFile?id=472489`
   - Live PDF SHA-256: `ffd4951b1996ee8f558a785df8bf12f38344e8bd6e2efe7c74b08527cab7018b`

---

## 2. Overlap & Locality Collision Analysis

### 2.1 Multi-family / Single-family Overlap Matrix

| Locality | Single-family Route | Multi-family Wspólnoty Route | Risk / State |
| :--- | :--- | :--- | :--- |
| **Konikowo** | TRASA I (`472491`) | TRASA I (`472488`) | **COLLISION RISK**: Whole-locality rule causes schedule overlap between single and multi-family buildings. Requires explicit building filter. |
| **Niekłonice** | TRASA I (`472491`) | TRASA I (`472488`) | **COLLISION RISK**: Whole-locality rule causes schedule overlap. Requires explicit building filter. |
| **Świeszyno** | TRASA II (`472490`) | TRASA II (`472489`) | **COLLISION RISK**: Overlap with multi-family schedule. |
| **Strzekęcino** | TRASA II (`472490`) | TRASA II (`472489`) | **COLLISION RISK**: Overlap with multi-family schedule. |
| **Niedalino** | TRASA II (`472490`) | TRASA II (`472489`) | **COLLISION RISK**: Overlap with multi-family schedule. |
| **Zegrze Pomorskie** | TRASA II (`472490`) | TRASA II (`472489`) | **COLLISION RISK**: Overlap with multi-family schedule. |
| **Dunowo** | TRASA II (`472490`) | TRASA II (`472489`) | **COLLISION RISK**: Overlap with multi-family schedule. |
| **Bardzlino** | TRASA II (`472490`) | TRASA II (`472489`) | **COLLISION RISK**: Overlap with multi-family schedule. |
| **Mierzym** | TRASA II (`472490`) | TRASA II (`472489`) | **COLLISION RISK**: Overlap with multi-family schedule. |
| **Chałupy** | **TRASA I (`472491`)** | **NONE** | **ZERO OVERLAP**: Purely rural single-family housing. Absent from all multi-family and special route schedules. |

### 2.2 Narrow Road & Difficult-Access Exclusions
Gmina Świeszyno does not maintain or publish any narrow-road or difficult-access street exclusion annexes. Operator EKOSAN Sp. z o.o. services the entire single-family locality of Chałupy directly.

---

## 3. Safe Subset Selection: Chałupy (SIMC `0313377`)

Chałupy is selected as the deterministic, 100% collision-free safe subset:
- **TERC**: `3209082` (Gmina Świeszyno)
- **SIMC**: `0313377` (wieś Chałupy)
- **Service Area Key**: `swieszyno-safe-h2-chalupy`
- **Operator**: EKOSAN Sp. z o.o. (Chałupy 13B, 76-024 Świeszyno)
- **Official PRG Address Points**: 126 address points registered in GUGiK Państwowy Rejestr Granic.

---

## 4. Collection Schedule Profile & Event Counts (H2 2026)

From `Trasa I - Konikowo, Chałupy, Niekłonice.pdf` (`8a37e48e2031ef611135b4157e7706dc1bd9531213ea3af417d9c53fc1d6cd5d`):
- **`MIXED`**: 14 collection dates (bi-weekly Fridays)
  - July: 3, 17, 31
  - August: 14, 28
  - September: 11, 25
  - October: 9, 23
  - November: 6, 20
  - December: 4, 18, 31 (Thursday before New Year's Day)
- **`OTHER`** (segregated waste: papier, tworzywa sztuczne, szkło, bio): 14 collection dates (bi-weekly Wednesdays)
  - July: 1, 15, 29
  - August: 12, 26
  - September: 9, 23
  - October: 7, 21
  - November: 4, 18
  - December: 2, 16, 30
- **`BULKY`**: 1 collection date
  - October: 1 (Thursday)

Total H2 collection events: **29 events**.

---

## 5. Rollout Strategy

1. Maintain parent source `swieszyno-collection-2026` as `PLANNED` attachment index enumerating all 4 child URLs (`id=472491, 472490, 472488, 472489`).
2. Activate child source `swieszyno-collection-trasa-1-safe-h2-2026` as `ACTIVE` with parser `municipal-collection-pdf-text`.
3. Scope the publication service area strictly to `swieszyno-safe-h2-chalupy` (SIMC `0313377`).
4. Keep Konikowo and Niekłonice unmapped until individual building numbers or shelter polygons are formally captured.
