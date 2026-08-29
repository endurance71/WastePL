# Polanów H2 2026 — safe collection subset for rollout 2026.6

## Decision

WastePL may activate a deliberately partial H2 collection subset for Polanów only when the source locality can be represented by a locality-wide rule without giving any known hard-to-reach or multi-family property a wrong `MIXED`, `BIO` or `BULKY` date.

Published fractions from the standard single-family PDFs:

- `MIXED` ← source column `zmieszane`;
- `BIO` ← source column `bio`;
- `BULKY` ← source column `gabaryty`;
- source column `segregacja` is **not published** because it does not identify a canonical WastePL recyclable fraction split.

No `PAPER`, `GLASS`, `METALS_PLASTICS` or generic synthetic fraction is inferred from `segregacja`.

## Safe source children and locality allow-lists

The static PDF identities and SHA-256 evidence are frozen in `docs/research/polanow-h2-capture-2026-08-29.json`.

### Polanow-1 — Garbno

Source: `1782289119_Polanow-1.pdf`

Safe localities:

- Garbno

### Polanow-3 — Bukowo group

Source: `1782289185_Polanow-3.pdf`

Safe localities:

- Bukowo
- Dadzewo
- Domachowo
- Karsina
- Nadbór
- Osetno
- Powidz
- Świerczyna

Excluded from the same PDF:

- Jacinki — explicit hard-to-reach address 41;
- Krytno — explicit hard-to-reach addresses 25, 26;
- Karsinka — explicit hard-to-reach address 15;
- Nacław — separate multi-family route;
- Puławy — explicit hard-to-reach addresses 1, 2;
- Rekowo — explicit hard-to-reach address 3;
- Rzyszczewko — explicit hard-to-reach addresses 1, 2, 4;
- Sowinko — explicit hard-to-reach address 7;
- Stołpie — explicit hard-to-reach addresses 1, 2/2.

### Polanow-4 — Bożenice group

Source: `1782289243_Polanow-4.pdf`

Safe localities:

- Bożenice
- Komorowo
- Rochowo
- Rzeczyca Mała
- Warblewo
- Wielin

Excluded:

- Buszyno — hard-to-reach addresses;
- Doły — hard-to-reach address 28;
- Krąg — hard-to-reach address 7G and separate multi-family route;
- Rzeczyca Wielka — separate multi-family route.

### Polanow-5 — Bagnica group

Source: `1782289323_Polanow-5.pdf`

Safe localities:

- Bagnica
- Chróstowo
- Gilewo
- Liszkowo
- Pokrzywno
- Rosocha

Excluded because the official difficult-access child lists explicit properties with a different standard schedule:

- Bartlewo
- Cetuń
- Czyżewo
- Głusza
- Jeżewo
- Kierzkowo
- Łąkie
- Nowy Żelibórz
- Pyszki
- Racław
- Samostrzel
- Stary Żelibórz
- Zagaje

Additionally:

- Żydowo — hard-to-reach properties and separate multi-family route.

### Polanow-8a — Chocimino group

Source: `1782289517_Polanow-8a.pdf`

Safe localities:

- Chocimino
- Chocimino Leśne
- Jaromierz Polanowski
- Łokwica
- Wietrzno
- Trzebaw

Excluded:

- Dzikowo — hard-to-reach address 2.

### Polanow-8b — Dalimierz group

Source: `1782289596_Polanow-8b.pdf`

Safe localities:

- Dalimierz
- Piaskowo
- Stare Wiatrowo

Excluded because the difficult-access child lists explicit properties:

- Gołogóra
- Gosław
- Gostkowo
- Kępiny
- Kopaniec
- Lipki
- Pieczyska
- Zdzieszewo

### Polanow-9 — Kania group

Source: `1782289627_Polanow-9.pdf`

Safe localities for the published fraction subset:

- Kania
- Przybrodzie
- Racibórz Polanowski
- Strzeżewo

The difficult-access source marks Kania properties 2, 2B, 3, 6, 9 and Racibórz Polanowski as **`sama segregacja`**. Because rollout 2026.6 does not publish `segregacja`, this exception does not alter the published `MIXED`, `BIO` or `BULKY` dates. If WastePL later models that segregated stream, these locality-wide assumptions must be revisited.

## Deliberately inactive H2 sources

The following are frozen as evidence but not used for collection publication in 2026.6:

- `1782289149_Polanow-2.pdf` — Kościernica includes a hard-to-reach exception;
- `1782289363_Polanow-6.pdf` — Polanów city route A overlaps building-type/multi-family coverage and contains a hard-to-reach Bobolicka property;
- `1782289449_Polanow-7.pdf` — Polanów city route B overlaps multi-family streets and Knieja hard-to-reach properties;
- `1782289693_Polanow-utrudnione-PN.pdf` — explicit-address evidence only;
- `1782289759_Polanow-utrudnione-WT.pdf` — explicit-address evidence only;
- `1782289798_Polanow-W1.pdf` — multi-family Polanów; building type is not used by the current resolver;
- `1782289839_Polanow-W2.pdf` — multi-family Nacław/Żydowo;
- `1782289875_Polanow-W3.pdf` — multi-family Krąg/Rzeczyca Wielka.

## Coverage result

Safe locality-wide subset: **34 unique rural localities** across seven H2 standard PDFs.

This is enough to treat Polanów as a genuinely useful partial collection rollout while keeping unsupported properties as no-coverage instead of returning known-wrong dates.

## Required gates before ACTIVE

1. Production PDF.js extraction regression for the seven selected files.
2. Every allow-listed locality resolves uniquely to official SIMC under TERC `3209063`.
3. Real PRG address sample covers every selected service area/source profile.
4. Consumer API correctness >= 99%; critical wrong-date mismatch = 0; ambiguity = 0.
5. Production runtime first import, replay and last-known-good evidence.
6. `pilot-koszalin-region@2026.6` activates only the seven explicit Polanów child source identities; parent/index and excluded child identities stay `PLANNED`/non-schedulable.
