# Manowo PSZOK 2026.13 — prospective onboarding worklog

Measurement mode: `PROSPECTIVE_TIMER`.

Timezone: `Europe/Warsaw` (`UTC+02:00`).

Only explicitly bounded human-active intervals are counted. CI queue/runtime is excluded. Durations below are rounded to the nearest whole minute for the machine-readable metrics record; the exact boundaries remain here as audit evidence.

## Phase intervals

| Phase | Start | End | Exact elapsed | Recorded minutes | Evidence / decision |
| --- | --- | --- | --- | ---: | --- |
| discovery | 2026-09-03 22:23:10+02:00 | 2026-09-03 22:24:00+02:00 | 50s | 1 | Investigated inter-municipal agreement between Gmina Manowo and PGK Koszalin; confirmed dedicated PSZOK portal for Manowo residents. |
| source assessment | 2026-09-03 22:24:00+02:00 | 2026-09-03 22:24:35+02:00 | 35s | 1 | Verified official PGK portal publishes address context (ul. Komunalna 5, Koszalin), weekly hours for Manowo, resident access and 12 accepted waste fractions. |
| parser implementation | 2026-09-03 22:24:50+02:00 | 2026-09-03 22:25:50+02:00 | 1m 00s | 1 | Extended `municipal-pszok-html` (100% adapter reuse); added Manowo profile with exact 12-fraction catalogue and non-greedy hour regexes. |
| regression fixture | 2026-09-03 22:25:50+02:00 | 2026-09-03 22:25:55+02:00 | 5s | 0 | Captured frozen official HTML fixture, verified SHA-256 and added unit test suite with drift assertions. |
| address/service-area mapping | 2026-09-03 22:26:00+02:00 | 2026-09-03 22:26:05+02:00 | 5s | 0 | Facility activation creates no collection service area; Manowo collection schedule remains ACTIVE and entrypoint remains PLANNED. |
| review | 2026-09-03 22:27:00+02:00 | 2026-09-03 22:37:00+02:00 | 10m 00s | 10 | Validated manifest rollout 2026.13, worker post-gate, public API post-gate and pilot production gate (reaching 8/8 100% PSZOK coverage). |

Recorded total: **13 human-active minutes**.

## Source-backed scope

Primary runtime source:

- `https://www.pgkkoszalin.pl/punkty-zbiorki-odpadow/punkt-zbiorki-odpadow-manowo/`

Published canonically from that direct HTML:

- PSZOK address: `ul. Komunalna 5, 75-724 Koszalin`;
- opening hours: Tuesday `08:00–16:00`, Thursday `08:00–16:00`;
- operator: `Przedsiębiorstwo Gospodarki Komunalnej Sp. z o.o. w Koszalinie`;
- safe canonical material subset: `BULKY`, `CONSTRUCTION`, `GREEN`, `HAZARDOUS`, `MEDICINES`, `BATTERIES`, `ELECTRONICS`, `TYRES`, `TEXTILES`, `PAPER`, `METALS_PLASTICS`, `GLASS`;
- geometry remains `null` without hallucinating coordinates;
- access scope: `MUNICIPALITY_RESIDENTS`.

## Rollout invariants

- `pilot-koszalin-region@2026.12` remains immutable.
- `2026.13` adds and activates `manowo-pszok`.
- Manowo collection source remains ACTIVE.
- PSZOK coverage reaches **8/8 municipalities (100%)**.
- Collection coverage remains **8/8 (100%)**.
- All-data municipality coverage remains **8/8 (100%)**.
