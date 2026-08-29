# Polanów collection H2 2026.6 prospective onboarding worklog

> Measurement mode: `PROSPECTIVE`. Timezone: `Europe/Warsaw`. Timer resolution: whole minutes rounded from explicit phase boundaries. CI/external waiting is excluded. No duration is reconstructed from Git timestamps or earlier untimed research.

## Target

- Municipality: Polanów (`3209063`)
- Data type: `COLLECTION_SCHEDULE`
- Intended manifest: `pilot-koszalin-region@2026.6`
- Candidate parser: `municipal-collection-pdf-text`
- Expected reuse class: `EXTENDED_EXISTING`
- Goal: raise safe collection coverage from 3/8 to 4/8 without publishing generic `segregacja`, multi-family ambiguity or hard-to-reach wrong dates.

## Prospective boundary

Earlier exploratory research and issue #76 are treated only as input hypotheses. The measured onboarding begins fresh at `2026-08-29 20:51:07+02:00`; every phase below is re-validated after that boundary before being counted.

## Phase log

| Phase | Start | End | Rounded minutes | State | Notes |
| --- | --- | --- | ---: | --- | --- |
| discovery | 2026-08-29 20:51:07+02:00 | 2026-08-29 20:52:20+02:00 | 1 | complete | Re-validated H2 parent 2846 and committed 15/15 final static PDF URLs, sizes and SHA-256 evidence from acquisition run 33269197493. |
| sourceAssessment | 2026-08-29 20:52:20+02:00 | 2026-08-29 20:53:22+02:00 | 1 | complete | Fixed safe policy: 34 rural localities across 7 standard PDFs; publish only MIXED/BIO/BULKY; omit generic segregacja; exclude multi-family and MIXED/BIO hard-to-reach overlaps. |
| parserImplementation | 2026-08-29 20:56:19+02:00 | — | — | active | Fresh active interval after interruption. An earlier announced parser start at 20:53:22 did not receive a close boundary and included no parser code change; it is disclosed but not counted. |
| regressionFixture | — | — | — | pending | Freeze only required source evidence and add template/semantic drift tests. |
| addressServiceAreaMapping | — | — | — | pending | PRG/TERYT-backed service areas and address correctness gate. |
| review | — | — | — | pending | Manifest, runtime/API gates, metrics and final review. |

## Frozen discovery evidence

- Official H2 parent: `https://bip.polanow.pl/harmonogram-odbioru-odpadow-komunalnych---ii-polrocze-2026/d/70/2846/`.
- `docs/research/polanow-h2-capture-2026-08-29.json` freezes all 15 child wrapper hashes and final `/upload/zal/2026/2026-06-24/*.pdf` URLs.
- Acquisition run `33269197493`: wrappers HTTP 15/15, PDFs `%PDF` 15/15, unique SHA-256 15/15.
- H1 document `d/70/2660` is not valid H2 evidence.

## Safe source assessment

- Standard single-family H2 PDFs publish `zmieszane / bio / segregacja / gabaryty`.
- WastePL publishes `MIXED`, `BIO`, `BULKY`; generic `segregacja` is required as template evidence but deliberately omitted from canonical events.
- Multi-family PDFs are withheld because resolver does not currently use building type and their street/locality coverage overlaps single-family routes.
- Rural localities with hard-to-reach MIXED/BIO schedule overrides are withheld from locality-wide standard coverage.
- Entries explicitly marked `sama segregacja` do not alter MIXED/BIO/BULKY and therefore do not force exclusion while `segregacja` remains omitted.
- `docs/research/polanow-h2-safe-subset.md` is the source-level allow-list/exclusion contract.

## Timer integrity note

A parser phase was verbally announced at `20:53:22`, immediately before an interrupted session. There was no explicit end timestamp and no parser-code commit during that interval. It is therefore not reconstructed from session/Git elapsed time. A new countable parser interval starts at `20:56:19`.

## Guardrails

- Never use H1 document `d/70/2660` or its PDFs as H2 evidence.
- No silent `segregacja` split.
- No building-type assumptions where resolver does not support building type.
- No locality-wide rule if an unhandled hard-to-reach address would receive different MIXED/BIO/BULKY dates.
- Historical manifests remain immutable.
- Full production/runtime/API/address gates must pass on the exact merge head.
