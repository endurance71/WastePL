# Będzino Dworek 2026.7 — prospective activation worklog

Measurement mode: `PROSPECTIVE_TIMER`.

Timezone: `Europe/Warsaw` (`UTC+02:00`).

Only explicitly bounded human-active intervals from the **2026.7 activation phase** are counted. CI queue/runtime is excluded. Durations are rounded to the nearest whole minute for the machine-readable record; exact boundaries remain here.

## Phase intervals

| Phase | Start | End | Exact elapsed | Recorded minutes | Evidence / decision |
| --- | --- | --- | ---: | ---: | --- |
| discovery | 2026-09-03 11:21:00+02:00 | 2026-09-03 11:22:00+02:00 | 1m 00s | 1 | Evaluated EKOSAN H2 operator index and resolved all 4 candidate PDFs. |
| source assessment | 2026-09-03 11:22:00+02:00 | 2026-09-03 11:24:00+02:00 | 2m 00s | 2 | Performed full text extraction and overlap analysis across all 4 operator files; identified 20 clean localities and selected Dworek as the zero-risk safe subset. |
| parser implementation | 2026-09-03 11:34:00+02:00 | 2026-09-03 11:38:00+02:00 | 4m 00s | 4 | Implemented Będzino H2 profile in `municipal-collection-adapter.ts` with source-faithful fraction mappings (`MIXED`, `BIO`, `OTHER`). |
| regression fixture | 2026-09-03 11:38:00+02:00 | 2026-09-03 11:42:00+02:00 | 4m 00s | 4 | Captured frozen H2 text fixture and 13-point Dworek PRG fixture from official GUGiK UUG. |
| address/service-area mapping | 2026-09-03 11:42:00+02:00 | 2026-09-03 11:44:00+02:00 | 2m 00s | 2 | Validated that SIMC `0302400` resolves uniquely to Dworek inside TERC `3209012` with 13 official PRG points and zero special-route overlap. |
| review | 2026-09-03 11:44:00+02:00 | 2026-09-03 11:48:00+02:00 | 4m 00s | 4 | Reviewed schema contracts, manifest rollout invariants and onboarding metrics. |

Recorded activation-phase total: **17 human-active minutes**.

## Activation scope

Only this direct H2 child becomes ACTIVE:

- `bedzino-collection-trasa-1-safe-h2-2026`
- `https://ekosanodpady.pl/wp-content/uploads/2026/07/Bedzino-2026-trasa-I.pdf`
- live PDF SHA-256: `91d4a4f1cf406e1116937468247062ad371198d505690f4424addd1f5de31fee`
- service area: `bedzino-trasa-1-safe-dworek`
- address evidence: 13 exact GUGiK PRG points, SIMC `0302400`.

The parent `bedzino-collection-2026-h2` remains PLANNED/discovery-only. Difficult-access and multi-family children remain inactive.

## Rollout invariants

- manifests `2026.1` through `2026.6` remain immutable;
- `2026.7` adds and activates only `bedzino-collection-trasa-1-safe-h2-2026`;
- raises pilot collection coverage from 4/8 to 5/8 municipalities;
- raises active source count from 10 to 11.
