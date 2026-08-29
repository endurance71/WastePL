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
| discovery | 2026-08-29 20:51:07+02:00 | — | — | active | Re-validate current H2 parent, exact 15 child identities and stable capture evidence before implementation. |
| sourceAssessment | — | — | — | pending | Determine safe source subset/fractions and exclude overlaps. |
| parserImplementation | — | — | — | pending | Extend existing municipal collection parser, no new parser family unless evidence requires it. |
| regressionFixture | — | — | — | pending | Freeze only required source evidence and add template/semantic drift tests. |
| addressServiceAreaMapping | — | — | — | pending | PRG/TERYT-backed service areas and address correctness gate. |
| review | — | — | — | pending | Manifest, runtime/API gates, metrics and final review. |

## Known hypotheses to re-validate

- Official H2 parent: `https://bip.polanow.pl/harmonogram-odbioru-odpadow-komunalnych---ii-polrocze-2026/d/70/2846/`.
- Untimed acquisition run `33269197493` observed 15/15 HTTP PDF captures and 15 unique SHA-256 values; this must be converted into committed/final source evidence before activation.
- Standard single-family PDFs use `zmieszane / bio / segregacja / gabaryty`; generic `segregacja` must not be split or published as a canonical recyclable fraction.
- Multi-family and hard-to-reach sets overlap ordinary routes and must be excluded unless the resolver can distinguish them deterministically.

## Guardrails

- Never use H1 document `d/70/2660` or its PDFs as H2 evidence.
- No silent `segregacja` split.
- No building-type assumptions where resolver does not support building type.
- No locality-wide rule if an unhandled hard-to-reach address would receive different MIXED/BIO/BULKY dates.
- Historical manifests remain immutable.
- Full production/runtime/API/address gates must pass on the exact merge head.
