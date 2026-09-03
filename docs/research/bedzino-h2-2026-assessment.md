# Będzino H2 2026 — source reassessment and safe-subset gate

> Verified: 2026-09-03. Research evidence for issue #85. This document does not activate Będzino collection data and does not replace live acquisition/provenance evidence.

## Decision summary

Będzino remains the preferred next municipality for raising collection coverage from 4/8 to 5/8, but the preferred source strategy changed after fresh source assessment.

The earlier pilot manifest describes the municipal BIP attachment set as a multi-route PDF set blocked by address-level ambiguity. That blocker is directionally correct, but it is no longer the best description of the acquisition path.

The current operator, EKOSAN, publishes a direct H2 2026 schedule index with dedicated links for:

- Będzino `TRASA I`;
- Będzino `TRASA II`;
- Będzino `Wielolokalowe`;
- Będzino `trudno dostępne`.

The two standard route PDFs are directly readable, text-bearing and explicitly cover July through December 2026. Therefore the remaining hard problem is **service-area overlap**, not standard-route template discovery.

No route becomes ACTIVE until current multi-family and difficult-access semantics are captured and the proposed real-address subset is proven non-overlapping.

## Official municipal publication

Current BIP parent:

`https://bip.bedzino.pl/?id=6920&type=article`

The parent is titled `Harmonogram 2026`, was created on 2026-06-12 and last edited/published on 2026-06-16. It currently enumerates 14 attachments.

Municipal news corroboration published on 2026-06-16 links residents to the same BIP schedule article:

`https://gmina.bedzino.pl/2026/06/16/nowe-harmonogramy-odbioru-odpadow-2/`

The BIP attachment inventory contains a mixture of special-route files and locality-named files. It remains useful as municipal discovery/change evidence, but it should not be preferred over a cleaner current operator source when the operator publishes the same H2 service directly.

## Current operator source

Operator schedule index:

`https://ekosanodpady.pl/harmonogramy-ekosan/`

The page identifies EKOSAN Sp. z o.o. as operator and publishes the current Będzino 2026 schedule family. The standard H2 links are:

- `https://ekosanodpady.pl/wp-content/uploads/2026/07/Bedzino-2026-trasa-I.pdf`
- `https://ekosanodpady.pl/wp-content/uploads/2026/07/Bedzino-2026-trasa-II.pdf`

Special-schedule links enumerated by the same operator page are:

- `https://ekosanodpady.pl/wp-content/uploads/2026/07/OSLONY-BEDZINO-2026.pdf`
- `https://ekosanodpady.pl/wp-content/uploads/2026/07/Bedzino-2026-trudnodostepne.pdf`

The current research session could inspect the two standard route PDFs through their extracted text layer. The two special PDFs were enumerated by the official operator index but were not retrievable through the session web cache. A cache miss is **not** treated as proof of source failure.

## Standard route I — verified template evidence

Direct source:

`https://ekosanodpady.pl/wp-content/uploads/2026/07/Bedzino-2026-trasa-I.pdf`

Required source markers observed:

- `HARMONOGRAM ODBIORU ODPADÓW Z TERENU GMINY BĘDZINO`;
- `LIPIEC – GRUDZIEŃ 2026 r.`;
- `Trasa I`;
- organizer: Urząd Gminy Będzino;
- contractor: EKOSAN Sp. z o.o.

Source locality list:

- Barnin;
- Będzinko;
- Będzino;
- Borkowice;
- Dworek;
- Kiszkowo;
- Kładno;
- Komory;
- Łasin Koszaliński;
- Łopienica;
- Miłogoszcz;
- Pleśna;
- Podbórz;
- Skrzeszewo;
- Słowieńkowo;
- Smolne;
- Strachomino;
- Strzepowo;
- Śmiechów;
- Tymień;
- Uliszki;
- Zagaje.

Observed H2 table:

| Month | Mixed | Plastic | Paper + glass | Bio |
| --- | --- | --- | --- | --- |
| July | 14, 28 | 2, 16, 30 | 2, 16, 30 | 3, 17, 31 |
| August | 11, 25 | 13, 27 | 13, 27 | 14, 28 |
| September | 8, 22 | 10, 24 | 10, 24 | 11, 25 |
| October | 6, 20 | 8, 22 | 8 | 9, 23 |
| November | 3, 17 | 5 | 5 | 6 |
| December | 1, 15, 29 | 3 | 3 | 4 |

These values are research/template evidence only. Production publication still requires immutable artifact capture, SHA-256, parser tests, runtime provenance and real-address gates.

## Standard route II — verified template evidence

Direct source:

`https://ekosanodpady.pl/wp-content/uploads/2026/07/Bedzino-2026-trasa-II.pdf`

Required source markers observed:

- same Będzino H2 heading and period;
- `Trasa II`;
- organizer: Urząd Gminy Będzino;
- contractor: EKOSAN Sp. z o.o.

Source locality list exactly as printed by the PDF:

- Barninek;
- Dobiesławiec;
- Dobre;
- Dobre Małe;
- Dobrzyca;
- `Kaziemierz Pomorski`;
- Łekno;
- `Łubinki`;
- Mączno;
- Mścice;
- Pakosław;
- Podamirowo;
- Popowo;
- Przybyradz;
- Stoisław;
- Strzeżenice;
- `Wierchominko`;
- Wierzchomino;
- Ziębrze.

The three quoted spellings above must not be fuzzy-corrected silently. Any normalization to official TERYT names requires an explicit evidence-backed alias and exact one-result reference match.

Observed H2 table:

| Month | Mixed | Plastic | Paper + glass | Bio |
| --- | --- | --- | --- | --- |
| July | 7, 21 | 9, 23 | 9, 23 | 10, 24 |
| August | 4, 18 | 6, 20 | 6, 20 | 7, 21 |
| September | 1, 15, 29 | 3, 17 | 3, 17 | 4, 18 |
| October | 13, 27 | 1, 15, 29 | 15 | 2, 16, 30 |
| November | 10, 24 | 12 | 12 | 13 |
| December | 8, 22 | 10 | 10 | 11 |

Again, these dates are not a production dataset until captured through the normal immutable artifact path.

## Fraction semantics

The current EKOSAN PDFs are more precise than the old generic PGK single `odpady segregowane` column, but the canonical mapping must still remain source-faithful.

The source publishes:

- mixed municipal waste;
- segregated plastic;
- one shared `PAPIER, SZKŁO` column;
- bio.

Safe mapping rules:

- mixed -> `MIXED`;
- bio -> `BIO`;
- plastic must not be expanded to `METALS_PLASTICS` unless the source explicitly includes metals; use a conservative representation/note under the current contract;
- shared paper + glass dates must not be duplicated into independent `PAPER` and `GLASS` events as if the source published separate schedules; use a source-faithful combined/`OTHER` semantic until the domain has an explicit combined representation.

A third-party application's decision to expand these columns is not canonical evidence for WastePL.

## Why standard locality membership is still not enough

The same official operator index publishes separate `Wielolokalowe` and `trudno dostępne` schedules.

Therefore `Trasa I` or `Trasa II` locality membership alone does not prove that every PRG address in that locality follows the standard route. A special schedule may carve out:

- specific house numbers;
- named streets;
- plots/properties;
- multi-family buildings;
- difficult-access properties.

WastePL must fail closed rather than assigning a standard route to such an address.

Historical Będzino publications demonstrate that difficult-access schedules can indeed be address-specific. That history is useful for risk identification, but the current 2026 H2 special-schedule artifacts must be captured before deriving current exclusions.

## Revised acquisition gate

Before parser implementation is merge-ready, run an isolated acquisition probe that:

1. fetches the current EKOSAN schedule index;
2. resolves exactly the four Będzino 2026 child URLs listed above;
3. requires PDF signature/content type and non-empty body;
4. records final URL, retrieval timestamp, byte length and SHA-256;
5. extracts text with the production PDF text extractor;
6. verifies H2 markers for all four children;
7. archives JSON + Markdown evidence without production DB/bucket/queue writes;
8. fails if standard or special child identity changes unexpectedly.

The probe should treat the municipal BIP parent as corroborating discovery evidence, not as a reason to combine old PGK and current EKOSAN schedule dates into one canonical artifact.

## Revised service-area gate

After all four current H2 artifacts are frozen:

1. resolve standard route locality names against official TERYT;
2. parse or enumerate every current multi-family and difficult-access coverage rule;
3. convert only source-explicit special addresses into exclusion/elevated-priority rules;
4. build a real PRG test pack that contains positive standard cases and negative/special cases;
5. require exactly one consumer result for every counted address;
6. require 0 critical wrong-date mismatches and 0 ambiguity;
7. exclude any locality/address whose relationship remains unresolved.

A small safe subset is an acceptable rollout. Unsupported is preferable to wrong.

## Parser-family recommendation

Reuse `municipal-collection-pdf-text` and add a dedicated Będzino H2 profile.

Do not create a new ingestion architecture. The profile should:

- accept only the expected Będzino source keys/direct operator URLs;
- assert current H2 heading, period and route marker;
- parse exactly six month rows, July through December;
- require the expected four schedule columns;
- resolve localities exactly against reference context;
- use explicit aliases only for proven source spelling differences;
- fail `UNSUPPORTED_TEMPLATE` on structural drift;
- fail `MISSING_METADATA` when locality/special-address reference coverage is incomplete;
- preserve parser/source/artifact provenance.

## Current status after reassessment

What is now proven:

- official municipal H2 publication exists and is current;
- official operator schedule index exists;
- direct standard `TRASA I` and `TRASA II` H2 PDFs exist;
- both standard PDFs are text-bearing and expose complete July–December date tables;
- both standard PDFs contain explicit locality membership;
- standard parser-family reuse is technically plausible.

What is **not** yet proven:

- immutable SHA-256 of all four current operator children through an isolated acquisition run;
- current H2 address semantics of `Wielolokalowe`;
- current H2 address semantics of `trudno dostępne`;
- exact PRG exclusions and zero-overlap service-area model;
- production parser/runtime/API correctness;
- eligibility for manifest `2026.7` activation.

## Current blocker

`CURRENT_H2_SPECIAL_SCHEDULE_ADDRESS_EXCLUSIONS_NOT_YET_FROZEN`

The next implementation step is an isolated four-child EKOSAN acquisition/evidence probe followed by explicit special-address overlap analysis. No Będzino collection source is ACTIVE because of this document.