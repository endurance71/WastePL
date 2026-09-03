# Sianów Grabówko 2026.8 — prospective activation worklog

Measurement mode: `PROSPECTIVE_TIMER`.

Timezone: `Europe/Warsaw` (`UTC+02:00`).

Only explicitly bounded human-active intervals from the **2026.8 activation phase** are counted. CI queue/runtime is excluded. Durations are rounded to the nearest whole minute for the machine-readable record; exact boundaries remain here.

## Phase intervals

| Phase | Start | End | Exact elapsed | Recorded minutes | Evidence / decision |
| --- | --- | --- | ---: | ---: | --- |
| discovery | 2026-09-03 13:48:00+02:00 | 2026-09-03 13:50:00+02:00 | 2m 00s | 2 | Downloaded and analyzed Sianów difficult-access schedule `15-utrudnione.pdf`; discovered Skwierzynka street carve-outs; isolated clean candidate localities. |
| source assessment | 2026-09-03 13:50:00+02:00 | 2026-09-03 13:53:00+02:00 | 3m 00s | 3 | Extracted text and proved 100% zero-overlap for Grabówko and Dąbrowa against `15-utrudnione.pdf`; selected Grabówko single-family route (`9-Dabrowa-i-Grabowko.pdf`). |
| parser implementation | 2026-09-03 14:00:00+02:00 | 2026-09-03 14:04:00+02:00 | 4m 00s | 4 | Implemented `sianow-h2-profile.ts` with 38 total collection events (13 MIXED, 13 OTHER, 11 BIO, 1 BULKY) and fail-closed markers. |
| regression fixture | 2026-09-03 14:04:00+02:00 | 2026-09-03 14:08:00+02:00 | 4m 00s | 4 | Captured frozen H2 text fixture and 31-point Grabówko PRG fixture from official GUGiK UUG. |
| address/service-area mapping | 2026-09-03 14:08:00+02:00 | 2026-09-03 14:10:00+02:00 | 2m 00s | 2 | Validated that SIMC `0310858` resolves uniquely to Grabówko inside TERC `3209073` with 31 official PRG points and zero special-route overlap. |
| review | 2026-09-03 14:10:00+02:00 | 2026-09-03 14:14:00+02:00 | 4m 00s | 4 | Reviewed schema contracts, manifest rollout invariants and onboarding metrics. |

Recorded activation-phase total: **19 human-active minutes**.

## Activation scope

Only this direct H2 child becomes ACTIVE:

- `sianow-collection-dabrowa-grabowko-safe-h2-2026`
- `https://sianow.pl/wp-content/uploads/2026/06/9-Dabrowa-i-Grabowko.pdf`
- live PDF SHA-256: `618c62bcca3a374d78ecb8db1aa935cbae6fd08e7a280787245270327bf7b16c`
- service area: `sianow-safe-h2-grabowko`
- address evidence: 31 exact GUGiK PRG points, SIMC `0310858`.

The parent `sianow-collection-2026-h2` remains PLANNED/discovery-only. Difficult-access and multi-family children remain inactive.

## Rollout invariants

- manifests `2026.1` through `2026.7` remain immutable;
- `2026.8` adds and activates only `sianow-collection-dabrowa-grabowko-safe-h2-2026`;
- raises pilot collection coverage from 5/8 to 6/8 municipalities (75%);
- raises active source count from 11 to 12.
