# Polanów PSZOK 2026.11 — prospective onboarding worklog

Measurement mode: `PROSPECTIVE_TIMER`.

Timezone: `Europe/Warsaw` (`UTC+02:00`).

Only explicitly bounded human-active intervals are counted. CI queue/runtime is excluded. Durations below are rounded to the nearest whole minute for the machine-readable metrics record; the exact boundaries remain here as audit evidence.

## Phase intervals

| Phase | Start | End | Exact elapsed | Recorded minutes | Evidence / decision |
| --- | --- | --- | --- | ---: | --- |
| discovery | 2026-09-03 21:13:11+02:00 | 2026-09-03 21:14:26+02:00 | 1m 15s | 1 | Evaluated missing PSZOK pilot municipalities (Polanów, Będzino, Manowo); selected Polanów PSZOK as direct official BIP article 79. |
| source assessment | 2026-09-03 21:59:29+02:00 | 2026-09-03 22:01:03+02:00 | 1m 34s | 2 | Verified official BIP HTML article 79 publishes full address context, opening hours, operator (ZUK Polanów), resident access and 10 accepted waste fractions. |
| parser implementation | 2026-09-03 22:03:11+02:00 | 2026-09-03 22:03:48+02:00 | 37s | 1 | Extended `municipal-pszok-html` (100% adapter reuse); added Polanów profile with exact accepted-materials catalogue. |
| regression fixture | 2026-09-03 22:03:50+02:00 | 2026-09-03 22:04:05+02:00 | 15s | 0 | Captured frozen official BIP HTML fixture, verified SHA-256 and added unit test suite with drift assertions. |
| address/service-area mapping | 2026-09-03 22:04:10+02:00 | 2026-09-03 22:04:15+02:00 | 5s | 0 | Facility activation creates no collection service area; Polanów Garbno collection schedule remains ACTIVE and parent remains PLANNED. |
| review | 2026-09-03 22:06:00+02:00 | 2026-09-03 22:16:00+02:00 | 10m 00s | 10 | Validated manifest rollout 2026.11, worker post-gate, public API post-gate and pilot production gate. |

Recorded total: **14 human-active minutes**.

## Source-backed scope

Primary runtime source:

- `https://bip.polanow.pl/punkt-selektywnego-zbierania-odpadow-komunalnych-(pszok)/d/70/79/`

Published canonically from that direct BIP HTML:

- PSZOK address: `ul. Stawna 2, 76-010 Polanów`;
- opening hours: Monday, Wednesday `07:00–14:30`, Saturday `10:00–14:00`;
- operator: `Zakład Usług Komunalnych w Polanowie`;
- safe canonical material subset: `BULKY`, `CONSTRUCTION`, `HAZARDOUS`, `MEDICINES`, `BATTERIES`, `ELECTRONICS`, `TYRES`, `PAPER`, `METALS_PLASTICS`, `GLASS`;
- geometry remains `null` without hallucinating coordinates;
- access scope: `MUNICIPALITY_RESIDENTS`.

## Rollout invariants

- `pilot-koszalin-region@2026.10` remains immutable.
- `2026.11` adds and activates `polanow-pszok`.
- Polanów Garbno collection source remains ACTIVE.
- PSZOK coverage increases from 5/8 to 6/8 municipalities.
- Collection coverage remains 8/8 (100%).
- All-data municipality coverage remains 8/8 (100%).
