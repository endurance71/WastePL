# Będzino PSZOK 2026.12 — prospective onboarding worklog

Measurement mode: `PROSPECTIVE_TIMER`.

Timezone: `Europe/Warsaw` (`UTC+02:00`).

Only explicitly bounded human-active intervals are counted. CI queue/runtime is excluded. Durations below are rounded to the nearest whole minute for the machine-readable metrics record; the exact boundaries remain here as audit evidence.

## Phase intervals

| Phase | Start | End | Exact elapsed | Recorded minutes | Evidence / decision |
| --- | --- | --- | --- | ---: | --- |
| discovery | 2026-09-03 22:12:45+02:00 | 2026-09-03 22:14:00+02:00 | 1m 15s | 1 | Evaluated missing PSZOK pilot municipalities; selected Będzino PSZOK as direct official municipal article. |
| source assessment | 2026-09-03 22:14:00+02:00 | 2026-09-03 22:16:30+02:00 | 2m 30s | 3 | Verified official article publishes address context (Będzino nr 17, GZK Będzino), opening hours, resident access and 12 accepted waste fractions. |
| parser implementation | 2026-09-03 22:17:35+02:00 | 2026-09-03 22:17:55+02:00 | 20s | 0 | Extended `municipal-pszok-html` (100% adapter reuse); added Będzino profile with exact 12-fraction catalogue. |
| regression fixture | 2026-09-03 22:18:00+02:00 | 2026-09-03 22:18:15+02:00 | 15s | 0 | Captured frozen official HTML fixture, verified SHA-256 and added unit test suite with drift assertions. |
| address/service-area mapping | 2026-09-03 22:18:20+02:00 | 2026-09-03 22:18:25+02:00 | 5s | 0 | Facility activation creates no collection service area; Będzino Dworek collection schedule remains ACTIVE and parent remains PLANNED. |
| review | 2026-09-03 22:19:00+02:00 | 2026-09-03 22:29:00+02:00 | 10m 00s | 10 | Validated manifest rollout 2026.12, worker post-gate, public API post-gate and pilot production gate. |

Recorded total: **14 human-active minutes**.

## Source-backed scope

Primary runtime source:

- `https://archiwum.bedzino.pl/pszok-juz-dziala/`

Published canonically from that direct HTML:

- PSZOK address: `Będzino 17, 76-037 Będzino`;
- opening hours: Tuesday `10:00–16:00`, Thursday `12:00–18:00`, Saturday `08:00–14:00`;
- operator: `Gminny Zakład Komunalny w Będzinie`;
- safe canonical material subset: `BULKY`, `CONSTRUCTION`, `GREEN`, `HAZARDOUS`, `MEDICINES`, `BATTERIES`, `ELECTRONICS`, `TYRES`, `TEXTILES`, `PAPER`, `METALS_PLASTICS`, `GLASS`;
- geometry remains `null` without hallucinating coordinates;
- access scope: `MUNICIPALITY_RESIDENTS`.

## Rollout invariants

- `pilot-koszalin-region@2026.11` remains immutable.
- `2026.12` adds and activates `bedzino-pszok`.
- Będzino Dworek collection source remains ACTIVE.
- PSZOK coverage increases from 6/8 to 7/8 municipalities (87.5%).
- Collection coverage remains 8/8 (100%).
- All-data municipality coverage remains 8/8 (100%).
