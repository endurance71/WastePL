# Polanów Garbno 2026.6 — prospective activation worklog

Measurement mode: `PROSPECTIVE_TIMER`.

Timezone: `Europe/Warsaw` (`UTC+02:00`).

Only explicitly bounded human-active intervals from the **2026.6 activation phase** are counted. CI queue/runtime is excluded. Durations are rounded to the nearest whole minute for the machine-readable record; exact boundaries remain here.

Important limitation: acquisition research (#79) and the Garbno parser profile (#80) were completed before this activation timer was started. Their human-active time is **not reconstructed from Git timestamps and not imputed**. Therefore this record is an auditable measured lower bound for activation work, not a full estimate of Polanów onboarding engineering cost.

## Phase intervals

| Phase | Start | End | Exact elapsed | Recorded minutes | Evidence / decision |
| --- | --- | --- | ---: | ---: | --- |
| discovery | 2026-08-30 10:52:31+02:00 | 2026-08-30 10:52:45+02:00 | 14s | 0 | Revalidated issue #76 goal and confirmed Polanów remains the intended fourth collection municipality rather than switching to another PLANNED source after the preparatory work. |
| source assessment | 2026-08-30 10:52:45+02:00 | 2026-08-30 10:52:56+02:00 | 11s | 0 | Revalidated canonical H2 parent 2846, 15-child acquisition proof, Garbno child SHA and the safety rule excluding difficult-access/multi-family children. |
| parser implementation | 2026-08-30 10:52:56+02:00 | 2026-08-30 10:53:11+02:00 | 15s | 0 | No activation-phase parser change was needed. Revalidated the already-merged exact Garbno profile, fail-closed duplicate-table checks, generic `segregacja -> OTHER` mapping and profile-specific parser provenance. Preparatory parser implementation time from #80 is intentionally not reconstructed. |
| regression fixture | 2026-08-30 10:53:11+02:00 | 2026-08-30 10:53:40+02:00 | 29s | 0 | Rechecked the frozen H2 text fixture, 32-event distribution, manifest-test surfaces and absence of a hardcoded latest-manifest dependency outside the live-source baseline already advanced to 2026.6. |
| address/service-area mapping | 2026-08-30 10:53:40+02:00 | 2026-08-30 10:53:57+02:00 | 17s | 0 | Revalidated LOCALITY resolver semantics, ambiguity behavior and the 39 exact Garbno PRG points under SIMC `0308749`; rollout gate requires exactly one `polanow-garbno-single-family` area for all 39. |
| review | 2026-08-30 10:53:57+02:00 | 2026-08-30 10:57:13+02:00 | 3m 16s | 3 | Reviewed schema/manifest contracts, production sequencing and public API expectations. Found one missing acceptance item: Polanów-specific last-known-good behavior. Added an explicit HTTP 503 preservation/recovery gate before the consumer API gate. |

Recorded activation-phase total: **3 human-active minutes**.

## Preparatory work excluded from this timer

The following evidence is required by the rollout but predates this measurement interval and is deliberately not assigned reconstructed minutes:

- PR #79 / `docs/research/polanow-h2-2026-acquisition.md`: canonical H2 parent, strict CMS resolver and 15/15 live PDF capture;
- PR #80 / `apps/worker/src/adapters/pdf-text/polanow-garbno-profile.ts`: deterministic Garbno parser profile and regression fixture;
- official GUGiK probe run `33270864743`: 39 Garbno PRG address points, raw WFS SHA-256 `046744234ebfe444a5327af87450b463f19ea9dc72132f3452cf3d38ed48419a`.

This separation prevents the activation metric from pretending that the earlier engineering work took zero time.

## Activation scope

Only this direct H2 child becomes ACTIVE:

- `polanow-collection-garbno-h2-2026`
- `https://bip.polanow.pl/pobierz.php?d=zal&id=b9dd65849fc6ebcb56cb8e3ce17710d5`
- live PDF SHA-256: `d578df780951f1f391fa81007bd61e8048f001e1fca771a4561408c4c8913643`
- service area: `polanow-garbno-single-family`
- address evidence: 39 exact GUGiK PRG points, SIMC `0308749`.

The parent `polanow-collection-2026` remains PLANNED/discovery-only. Difficult-access and multi-family children remain inactive.

## Rollout invariants

- manifests `2026.1` through `2026.5` remain immutable;
- `2026.6` adds and activates only `polanow-collection-garbno-h2-2026`;
- Tychowo collection provenance remains `municipal-collection-pdf-text@0.1.1`;
- Garbno publication provenance is `municipal-collection-pdf-text@0.2.0`;
- generic `segregacja` remains `OTHER`; no PAPER/GLASS/METALS_PLASTICS expansion is inferred;
- deterministic production gate requires first publish, replay, 39/39 unique service-area coverage, last-known-good preservation/recovery and public API 39/39 with zero critical wrong-date mismatches;
- real public-upstream live soak from #60 remains a separate requirement.
