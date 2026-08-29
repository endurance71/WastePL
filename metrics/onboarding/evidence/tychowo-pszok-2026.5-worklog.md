# Tychowo PSZOK 2026.5 — prospective onboarding worklog

Measurement mode: `PROSPECTIVE_TIMER`.

Timezone: `Europe/Warsaw` (`UTC+02:00`).

Only explicitly bounded human-active intervals are counted. CI queue/runtime is excluded. Durations below are rounded to the nearest whole minute for the machine-readable metrics record; the exact boundaries remain here as audit evidence.

## Phase intervals

| Phase | Start | End | Exact elapsed | Recorded minutes | Evidence / decision |
| --- | --- | --- | ---: | ---: | --- |
| discovery | 2026-08-29 13:44:37+02:00 | 2026-08-29 13:45:51+02:00 | 1m 14s | 1 | Compared remaining pilot municipalities; selected Tychowo PSZOK as the next direct official source instead of the cross-municipality Manowo facility model. |
| source assessment | 2026-08-29 13:45:51+02:00 | 2026-08-29 13:47:09+02:00 | 1m 18s | 1 | Chose the official Tychowo BIP HTML as the sole runtime artifact. PDF-only operator/access/proof claims are deliberately excluded from this single-artifact profile. |
| parser implementation | 2026-08-29 13:47:09+02:00 | 2026-08-29 13:48:42+02:00 | 1m 33s | 2 | Extended `municipal-pszok-html` to `0.3.0`; added Tychowo profile and made access provenance conditional when the source-backed scope is `UNKNOWN`. |
| regression fixture | 2026-08-29 13:48:42+02:00 | 2026-08-29 13:50:30+02:00 | 1m 48s | 2 | Added frozen BIP evidence slice, parser/drift assertions and immutable-artifact runtime coverage. |
| address/service-area mapping | 2026-08-29 13:50:30+02:00 | 2026-08-29 13:50:47+02:00 | 17s | 0 | PSZOK activation creates no collection service-area rule; existing safe Tychowo collection subset and difficult-address blocker remain unchanged. |
| review | 2026-08-29 13:50:47+02:00 | 2026-08-29 14:11:13+02:00 | 20m 26s | 20 | Reviewed immutable `2026.5` rollout, source identity preservation, safe material mapping, parser-version provenance, worker/API post-gates and production-gate sequencing. |

Recorded total: **26 human-active minutes**.

## Source-backed scope

Primary runtime source:

- `https://bip.tychowo.pl/artykul/646/9305/oplata-za-gospodarowanie-odpadami-komunalnymi`

Published canonically from that direct BIP HTML:

- PSZOK address: `ul. Dolna 8, Tychowo`;
- opening hours: Tuesday, Thursday, Saturday `08:00–14:30`;
- safe canonical material subset: `PAPER`, `GLASS`, `BIO`, `BATTERIES`, `ELECTRONICS`, `BULKY`, `TYRES`, `CONSTRUCTION`;
- geometry remains `null`;
- access scope remains `UNKNOWN`, proof requirement remains `null`, operator remains `null` because those claims are not present in the primary HTML runtime artifact;
- plastics-only wording is not silently broadened to `METALS_PLASTICS`.

The linked regulation was useful corroborating research but is **not** mixed into the canonical single-artifact provenance for this activation.

## Rollout invariants

- `pilot-koszalin-region@2026.4` remains immutable.
- `2026.5` adds and activates only `tychowo-pszok`.
- Tychowo standard collection source remains ACTIVE.
- Tychowo difficult-address collection source remains PLANNED with `EXPLICIT_ADDRESS_REFERENCE_GATE_NOT_YET_COMPLETE`.
- Collection coverage therefore remains 3/8 municipalities.
- PSZOK coverage increases from 4/8 to 5/8 municipalities.
- Any-data municipality coverage remains 6/8 because Tychowo already had active collection data.
- `ARTIFACT_PROCESSING_ENABLED` remains deployment opt-in.
- Real public-upstream live soak from #60 remains a separate requirement.
