# Pilot source wave 3 — Tychowo + Będzino assessment

> Assessment date: 2026-08-28. Scope: official 2026 collection publications only. This document records source evidence and the implementation decision for manifest `pilot-koszalin-region@2026.3`.

## Decision summary

| Municipality | TERC | Current shape | Evidence | Final wave-3 decision |
| --- | --- | --- | --- | --- |
| Tychowo | `3201043` | parent HTML index + 2 text-bearing PDFs | VERIFIED | GO for deliberately partial standard-PDF coverage; hard-to-reach child remains PLANNED |
| Będzino | `3209012` | BIP parent + 14 PDFs, publication shape changed for H2 | VERIFIED inventory, unresolved route semantics | NO-GO for ACTIVE until route/address overlap is deterministic |

## Tychowo

### Tychowo official parent

`https://tychowo.pl/cms/2151/harmonogram-odbioru-odpadow-komunalnych-`

The current municipal schedule page exposes exactly two 2026 attachments. This is preferable to the historical December 2025 news article because the CMS page currently points at revised `zmiana*` artifacts.

### Exact current Tychowo child artifacts

1. Main municipality schedule:
   `https://cms-v2-files.idcom-jst.pl/sites/64/cms/szablony/2151/pliki/zmianaharmonogram_tychowo_20261.pdf`
2. Hard-to-reach/colonial properties:
   `https://cms-v2-files.idcom-jst.pl/sites/64/cms/szablony/2151/pliki/zmianakopia_harmonogram_tychowo_2026_%E2%80%94_kolonijne.pdf`

### Tychowo proven source semantics

The main PDF is text-bearing and explicitly distinguishes at least:

- `zmieszane` → `MIXED`;
- `bio` → `BIO`;
- `papier i tektura` → `PAPER`;
- `tworzywa sztuczne` → retained as `OTHER` with the source label in the normalized note, because the source does not claim metals and WastePL must not silently expand it to `METALS_PLASTICS`;
- `szkło` → `GLASS`.

The main publication also contains sparse `wielkogabaryty` information, but the current plain-text extraction does not preserve enough month/column placement to normalize those rows without guessing. They are therefore not emitted by the wave-3 adapter.

The main publication contains multiple locality groups and a distinct Tychowo multi-family group (`tylko wspólnoty mieszkaniowe z powołanym zarządem`). The current service-area resolver does not use `building_type` as a selector, so whole-city Tychowo plus a second Tychowo multi-family service area would produce ambiguous resolution. The city is deliberately excluded from this rollout.

The hard-to-reach PDF uses explicit property numbers, including examples such as Kowalki 48–56 with gaps, selected Motarzyn/Osówko/Sadkowo properties, Wicewo `22`/`22/1` and `Tychowo ul. Sosnowa 12`. It also contains an unnumbered `Zastawa` entry. This evidence must resolve through authoritative address data; it must not be broadened to whole-locality coverage.

### Correction to the previous Tychowo manifest evidence

Manifest `2026.2` recorded the two attachments from the original news article under `/wiadomosci/128301/files/...`. The current CMS schedule page points to revised `zmiana*` PDFs. Manifest `2026.3` preserves `2026.2` historically and creates two new exact child-source identities instead of mutating old artifact evidence.

### Tychowo adapter strategy

`pgk-koszalin-pdf-text` remains source-specific. Wave 3 introduces `municipal-collection-pdf-text` for the explicitly profiled Tychowo template.

The parser does not hardcode production SIMC values. At artifact-processing time the handler loads active localities for the source municipality from the imported TERYT backbone, then the parser resolves source labels to a unique SIMC inside TERC `3201043`. Missing or duplicate locality resolution is a permanent visible parse failure rather than a guess.

### Standard-child activation gate — passed

`tychowo-collection-standard-2026` is `ACTIVE` in manifest `2026.3` only for source groups that can be published without known overlaps. The parser deliberately excludes the city of Tychowo and every locality for which the hard-to-reach child proves exceptions that cannot yet be represented safely.

The safe rollout contains 3 service areas and 30 whole-locality rules. CI run #110 (`33191470822`) proved on a separate clean database that:

- `pilot-koszalin-region@2026.3` syncs as 8 municipalities, 15 source identities, 7 ACTIVE and 8 PLANNED;
- the source goes through immutable artifact storage, durable outbox, BullMQ, `municipal-collection-pdf-text`, schema validation and `PgCollectionPublisher`;
- initial publication creates 3 current service areas, 30 `LOCALITY` rules and 273 current collection events;
- emitted fractions are exactly `BIO`, `GLASS`, `MIXED`, `OTHER`, `PAPER`;
- identical replay returns `DEDUPLICATED` and does not create a second publication;
- deterministic `HTTP_503` moves source health to `FETCH_FAILED` while keeping last-known-good canonical events;
- a changed artifact produces a second publication, leaves 273 current events and closes the previous 273 events with temporal history;
- parser provenance is persisted as `municipal-collection-pdf-text@0.1.0`.

The clean-runtime report was archived together with the existing production readiness report as artifact `9693964683` (`sha256:8486020dc8481845c7bf9b85b9d0de0e626e7317c0e619edea182bb3c05bf593`).

### Hard-to-reach-child activation gate — intentionally not passed

`tychowo-collection-difficult-2026` remains `PLANNED` with blocker `EXPLICIT_ADDRESS_REFERENCE_GATE_NOT_YET_COMPLETE`.

It may become ACTIVE only after every supported numbered property resolves uniquely against authoritative PRG data, unnumbered/ambiguous source entries are either explicitly modelled or excluded, and regression tests prove that explicit-address rules override normal locality schedules without leaking a route to neighboring properties.

## Będzino

### Będzino official parent

`https://bip.bedzino.pl/?id=6920&type=article`

The BIP article was published 2026-06-16 and currently exposes 14 attachments. The page history shows edits on 2026-06-12, 2026-06-15 and 2026-06-16, so child identity and validity period must be versioned explicitly.

### Exact current Będzino attachment URLs

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

### Będzino proven source semantics

Indexed Będzino PDFs explicitly label a grouped column as `odpady segregowane (plastik, szkło, papier, biodegradowalne)`. Unlike a source that only says `odpady segregowane`, this parenthetical list is evidence for the represented streams. Any future adapter may expand the grouped date only when this enumerating label is actually present in the parsed artifact.

A sampled official PDF for Łubniki/Mścice shows monthly `odpady zmieszane` and the explicitly enumerated grouped segregated column. A separate Kładno June revision demonstrates that BIP can publish scoped route corrections independently of the main set.

### Why Będzino parent-only ingestion is rejected

The BIP parent is an attachment index, not the schedule itself. Fetching/parsing only the HTML would make canonical output depend on ad-hoc link discovery at parse time and would weaken immutable artifact provenance. Child PDFs therefore need stable source identities.

### Będzino implementation decision

All 14 currently listed BIP attachment URLs are frozen as evidence in manifest `2026.3`, but the source remains `PLANNED`.

The four `od_lipca` artifacts are H2 candidates. The remaining blocker is no longer child discovery; it is deterministic route/address semantics across route I, route II, `OSŁONY` and hard-to-reach sets, including overlap and validity rules. WastePL will not mark these files simultaneously schedulable until that relationship is source-backed.

### Będzino activation gate — not passed

- exact H2 child roles must be proven rather than inferred from filenames alone;
- route/locality/address coverage must come from source content;
- overlap between normal routes, osłony and hard-to-reach properties must be explicitly resolved;
- grouped segregated expansion is allowed only when the source enumerates represented fractions;
- changed one-child artifact must produce a scoped downstream replacement;
- older H1 files remain historical/non-schedulable unless their validity is proven.

Current machine-readable blocker: `H2_ROUTE_I_II_OSLONY_AND_DIFFICULT_COVERAGE_NOT_YET_ADDRESS_DETERMINISTIC`.

## Operational/economic measurement

Wave 3 is the first source wave where onboarding evidence is recorded prospectively for `#65`. Unknown human-active minutes are not reconstructed from Git commit timestamps and are not fabricated.

Auditable implementation metrics from this wave:

| Metric | Tychowo | Będzino |
| --- | --- | --- |
| Exact current child artifacts inventoried | 2 | 14 |
| New production parser class | `NEW_ADAPTER` | none yet / `NEW_ADAPTER_OR_COORDINATOR` likely |
| First-import automation | PASS: clean runtime publication | not attempted because activation gate is NO-GO |
| Replay automation | PASS: source deduplicated | not applicable yet |
| Failure/last-known-good | PASS: `HTTP_503` preserves 273 current events | not applicable yet |
| Changed-artifact replacement | PASS: 273 retired + 273 current | not applicable yet |
| Manual review required by deterministic gate | 0 for activated standard subset | route semantics still require implementation/review |
| Coverage intentionally withheld | city Tychowo + exception localities + hard-to-reach child | entire schedule source |

The useful business signal is already visible: Tychowo required a new parser but can reuse the existing PDF extraction, immutable artifact, outbox/BullMQ, schema-validation and temporal publisher pipeline. Będzino has a materially higher onboarding shape because attachment coordination and route overlap, not raw PDF parsing, are the limiting problem.