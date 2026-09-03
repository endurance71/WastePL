# Świeszyno Chałupy 2026.9 — prospective activation worklog

Measurement mode: `PROSPECTIVE_TIMER`.

Timezone: `Europe/Warsaw` (`UTC+02:00`).

Only explicitly bounded human-active intervals from the **2026.9 activation phase** are counted. CI queue/runtime is excluded. Durations are rounded to the nearest whole minute for the machine-readable record; exact boundaries remain here.

## Phase intervals

| Phase | Start | End | Exact elapsed | Recorded minutes | Evidence / decision |
| --- | --- | --- | ---: | ---: | --- |
| discovery | 2026-09-03 14:25:00+02:00 | 2026-09-03 14:28:00+02:00 | 3m 00s | 3 | Evaluated Gmina Świeszyno municipal portal; identified four route PDFs (2 single-family, 2 multi-family). |
| source assessment | 2026-09-03 14:28:00+02:00 | 2026-09-03 14:31:00+02:00 | 3m 00s | 3 | Extracted text across all four route PDFs; discovered multi-family overlaps for Konikowo and Niekłonice; isolated Chałupy as the 100% zero-risk single-family subset. |
| parser implementation | 2026-09-03 14:34:00+02:00 | 2026-09-03 14:36:00+02:00 | 2m 00s | 2 | Implemented `swieszyno-h2-profile.ts` with 29 total collection events (14 MIXED, 14 OTHER, 1 BULKY) and fail-closed markers. |
| regression fixture | 2026-09-03 14:32:00+02:00 | 2026-09-03 14:35:00+02:00 | 3m 00s | 3 | Captured frozen H2 text fixture and 167-point Chałupy PRG fixture from official GUGiK UUG. |
| address/service-area mapping | 2026-09-03 14:36:00+02:00 | 2026-09-03 14:38:00+02:00 | 2m 00s | 2 | Validated that SIMC `0313377` resolves uniquely to Chałupy inside TERC `3209082` with 167 official PRG points and zero multi-family overlap. |
| review | 2026-09-03 14:38:00+02:00 | 2026-09-03 14:41:00+02:00 | 3m 00s | 3 | Reviewed schema contracts, manifest rollout invariants and onboarding metrics. |

Recorded activation-phase total: **16 human-active minutes**.

## Activation scope

Only this direct H2 child becomes ACTIVE:

- `swieszyno-collection-trasa-1-safe-h2-2026`
- `https://ug.swieszyno.ibip.pl/public/getFile?id=472491`
- live PDF SHA-256: `8a37e48e2031ef611135b4157e7706dc1bd9531213ea3af417d9c53fc1d6cd5d`
- service area: `swieszyno-safe-h2-chalupy`
- address evidence: 167 exact GUGiK PRG points, SIMC `0313377`.

The parent `swieszyno-collection-2026` remains PLANNED/discovery-only enumerating all 4 child route URLs. Multi-family and overlapping single-family routes remain inactive.

## Rollout invariants

- manifests `2026.1` through `2026.8` remain immutable;
- `2026.9` adds and activates only `swieszyno-collection-trasa-1-safe-h2-2026`;
- raises pilot collection coverage from 6/8 to 7/8 municipalities (87.5%);
- raises active source count from 12 to 13.
