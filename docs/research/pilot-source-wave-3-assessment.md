# Pilot source wave 3 — Tychowo + Będzino assessment

> Assessment date: 2026-08-28. Scope: official 2026 collection publications only. This document records evidence; it does not by itself authorize `ACTIVE` status.

## Decision summary

| Municipality | TERC | Current shape | Evidence | Decision before implementation |
| --- | --- | --- | --- | --- |
| Tychowo | `3201043` | parent HTML index + 2 text-bearing PDFs | VERIFIED | GO for deterministic PDF adapter + exact child sources |
| Będzino | `3209012` | BIP parent + 14 PDFs, publication shape changed for H2 | PARTIAL → strengthened | GO for child-artifact/route modelling; no parent-only activation |

## Tychowo

### Official parent

`https://tychowo.pl/cms/2151/harmonogram-odbioru-odpadow-komunalnych-`

The current municipal schedule page exposes exactly two 2026 attachments. This is preferable to the historical December 2025 news article because the CMS page currently points at revised `zmiana*` artifacts.

### Exact current child artifacts

1. Main municipality schedule:
   `https://cms-v2-files.idcom-jst.pl/sites/64/cms/szablony/2151/pliki/zmianaharmonogram_tychowo_20261.pdf`
2. Hard-to-reach/colonial properties:
   `https://cms-v2-files.idcom-jst.pl/sites/64/cms/szablony/2151/pliki/zmianakopia_harmonogram_tychowo_2026_%E2%80%94_kolonijne.pdf`

### Proven source semantics

The main PDF is text-bearing and explicitly distinguishes at least:

- `zmieszane` → `MIXED`;
- `bio` → `BIO`;
- `papier i tektura` → `PAPER`;
- `tworzywa sztuczne` → `METALS_PLASTICS` only if the canonical mapping remains intentionally named as the yellow-container fraction in WastePL; parser evidence must not invent metals if the source only claims plastics;
- `szkło` → `GLASS`;
- `wielkogabaryty` → `BULKY`.

The main publication contains multiple locality groups and a distinct Tychowo multi-family group (`tylko wspólnoty mieszkaniowe z powołanym zarządem`).

The hard-to-reach PDF uses explicit property numbers, including examples such as Kowalki 48–56 with gaps, Motarzyn selected numbers, Osówko selected numbers, Sadkowo selected numbers, Wicewo `22`/`22/1` and `Tychowo ul. Sosnowa 12`. This must resolve as explicit address evidence, not as whole-locality coverage.

### Important correction to the previous manifest

Manifest `2026.2` recorded the two attachments from the original news article under `/wiadomosci/128301/files/...`. The municipality's current CMS schedule page now points to revised `zmiana*` PDFs. A new manifest version must preserve `2026.2` historically and introduce the current exact artifact identities instead of mutating old evidence.

### Adapter strategy

Do not extend `pgk-koszalin-pdf-text` with another municipality-specific branch. Introduce a separate municipal collection parser key and keep source identity explicit.

The adapter should obtain locality SIMC mappings from the imported TERYT backbone at artifact-processing time rather than hardcoding dozens of SIMC values in parser source code.

### Tychowo activation gate

`ACTIVE` is allowed only when:

- both exact current PDFs have deterministic regression evidence;
- all whole-locality coverage names resolve uniquely to TERYT SIMC inside TERC `3201043`;
- all hard-to-reach explicit properties resolve or produce explicit review/no-go evidence;
- fraction mapping is source-backed;
- raw-PDF extraction + parser + canonical publisher is covered by runtime tests;
- revised artifact replacement does not overwrite unrelated service areas.

## Będzino

### Official parent

`https://bip.bedzino.pl/?id=6920&type=article`

The BIP article was published 2026-06-16 and currently exposes 14 attachments. The page history shows edits on 2026-06-12, 2026-06-15 and 2026-06-16, so child identity and validity period must be versioned explicitly.

### Exact current attachment URLs observed on the BIP page

H2 / revised publication:

1. `https://bip.bedzino.pl/backend/uploads/files//2026-06-16_od_lipca_B%C4%99dzino%202026%20trudnodost%C4%99pnedocx.pdf`
2. `https://bip.bedzino.pl/backend/uploads/files//2026-06-16_od_lipca_OS%C5%81ONY%20B%C4%98DZINO%202026.pdf`
3. `https://bip.bedzino.pl/backend/uploads/files//2026-06-16_od_lipca_B%C4%99dzino%202026%20trasa%20I.pdf`
4. `https://bip.bedzino.pl/backend/uploads/files//2026-06-16_od_lipca_B%C4%99dzino%202026%20trasa%20II.pdf`

Additional June/H1 artifacts still listed by BIP:

5. `https://bip.bedzino.pl/backend/uploads/files//2026-06-15_Kladno_zm.pdf`
6. `https://bip.bedzino.pl/backend/uploads/files/zalatw_sprawe/gospodarka_odpadami/harmonogramy_wywozu/2026-06-12_Trudnodost%C4%99pne.pdf`
7. `https://bip.bedzino.pl/backend/uploads/files/zalatw_sprawe/gospodarka_odpadami/harmonogramy_wywozu/2026-06-12_Dobre%20Ma%C5%82e%2C%20Dobrzyca%2C%20M%C4%85czno%2C%20Popowo%2C%20Stois%C5%82aw%2C%20Wierzchomino%2C%20Wierzchominko%2C%20Zi%C4%99brze.pdf`
8. `https://bip.bedzino.pl/backend/uploads/files/zalatw_sprawe/gospodarka_odpadami/harmonogramy_wywozu/2026-06-12_%C5%81ubniki%2C%20M%C5%9Bcice.pdf`
9. `https://bip.bedzino.pl/backend/uploads/files/zalatw_sprawe/gospodarka_odpadami/harmonogramy_wywozu/2026-06-12_%C5%81asin%2C%20%C5%81opienica%20oraz%20Ple%C5%9Bna.pdf`
10. `https://bip.bedzino.pl/backend/uploads/files/zalatw_sprawe/gospodarka_odpadami/harmonogramy_wywozu/2026-06-12_B%C4%99dzinko%2C%20Borkowice%2C%20Dworek%2C%20Kiszkowo%2C%20Komory%2C%20Skrzeszewo%2C%20S%C5%82owienkowo%2C%20%C5%9Amiech%C3%B3w.pdf`
11. `https://bip.bedzino.pl/backend/uploads/files/zalatw_sprawe/gospodarka_odpadami/harmonogramy_wywozu/2026-06-12_Kazmierz%20Pomorski%2C%20Strze%C5%BCenice.pdf`
12. `https://bip.bedzino.pl/backend/uploads/files/zalatw_sprawe/gospodarka_odpadami/harmonogramy_wywozu/2026-06-12_Smolne%2C%20Strachomino%2C%20Strzepowo.pdf`
13. `https://bip.bedzino.pl/backend/uploads/files/zalatw_sprawe/gospodarka_odpadami/harmonogramy_wywozu/2026-06-12_Barnin%2C%20B%C4%99dzino%2C%20Mi%C5%82ogoszcz%2C%20Tymie%C5%84%2C%20Uliszki%2C%20Zagaje.pdf`
14. `https://bip.bedzino.pl/backend/uploads/files/zalatw_sprawe/gospodarka_odpadami/harmonogramy_wywozu/2026-06-12_Barninek%2C%20Dobies%C5%82awiec%20oraz%20Podamirowo.pdf`

### Proven source semantics

Indexed Będzino PDFs explicitly label a grouped column as `odpady segregowane (plastik, szkło, papier, biodegradowalne)`. Unlike a source that only says `odpady segregowane`, this parenthetical list gives evidence for the four represented canonical streams. The adapter may emit the same date for the four source-backed fractions only when this exact enumerating label is present.

A sampled official PDF for Łubniki/Mścice shows monthly `odpady zmieszane` and the explicitly enumerated grouped segregated column. A separate Kładno June revision demonstrates that BIP can publish scoped route corrections independently of the main set.

### Why parent-only ingestion is rejected

The BIP parent is an attachment index, not the schedule itself. Fetching/parsing only the HTML would make canonical output depend on ad-hoc link discovery at parse time and would weaken immutable artifact provenance. Child PDFs therefore need stable source identities.

### Będzino implementation decision

For current pilot coverage, model exact child PDFs as versioned source records. Do not silently treat all 14 as simultaneously valid for the same period. The four `od_lipca` artifacts must be assessed as the H2 set; older June/H1 files remain historical evidence until their validity/overlap is made explicit.

The current blocker is reduced from `child discovery` to `H2 route-coverage semantics`: exact child URLs are known, but route I/II/OSŁONY/trudnodostępne must be mapped deterministically to addresses/localities before activation.

### Będzino activation gate

- exact H2 child set and roles are frozen in the new manifest version;
- each child has deterministic parser evidence;
- route/locality/address coverage is extracted from source content, not guessed from filenames;
- overlap between normal routes, osłony and hard-to-reach properties is explicitly resolved;
- grouped segregated mapping is accepted only when the source enumerates the represented fractions;
- changed one-child artifact produces a scoped downstream replacement;
- old H1 artifacts remain historical/non-schedulable unless validity is proven.

## Operational/economic measurement

Wave 3 is the first source wave where onboarding effort is measured prospectively for `#65`. Unknown historical effort is not backfilled with estimates.

Measurements start at assessment and will record:

- source discovery/evidence minutes;
- parser implementation minutes;
- regression-fixture minutes;
- TERYT/address mapping minutes;
- manual review interventions;
- number of exact child artifacts;
- adapter reuse class (`UNCHANGED`, `CONFIG_ONLY`, `EXTENDED`, `NEW_ADAPTER`);
- first-import automation result;
- repeat-update automation result when observable.

Current qualitative classification:

- Tychowo: `NEW_ADAPTER`, 2 child artifacts, medium route complexity, explicit-address subset present;
- Będzino: `NEW_ADAPTER_OR_COORDINATOR`, 14 listed artifacts / 4 H2 candidates, high route/validity complexity.
