# Onboarding Worklog: Bobolice Kłanino Safe Subset (Wave 10)

## Target
- Municipality: Gmina Bobolice (`TERC 3209033`)
- Safe Locality: Kłanino (`SIMC 0304214`)
- Manifest Wave: `2026.10`
- Target Milestone: **8/8 (100%)** pilot municipality collection schedule coverage

## Source Architecture
- Entrypoint: `https://bobolice.pl/cms/5665` (Harmonogramy wywozu odpadów komunalnych)
- Contractor: ATF Transport Sp. z o.o. / ATF Polska Sp. z o.o. (Połczyn Zdrój)
- Format: 9 graphical route sheets published as images. Sheet 6 contains rural route Kłanino, Ubiedrze, Różewko, Wilczogóra, Przydargiń.
- Sheet 7 contains difficult-access / narrow-road exclusions ("nieruchomości o utrudnionym dostępie").
- Zero-overlap analysis proved Kłanino is 100% collision-free (0 entries on Sheet 7, 0 multi-family buildings).

## Prospective Timers
| Phase | Duration (min) | Start (UTC) | End (UTC) | Notes |
|---|---|---|---|---|
| discovery | 3 | 2026-09-03T13:00:00Z | 2026-09-03T13:03:00Z | Inspected Bobolice portal, identified ATF contractor change and 9 route sheets |
| sourceAssessment | 3 | 2026-09-03T13:04:00Z | 2026-09-03T13:07:00Z | Downloaded 9 sheets, analyzed Sheet 7 difficult access exclusions, proved Kłanino safe |
| parserImplementation | 2 | 2026-09-03T13:40:00Z | 2026-09-03T13:42:00Z | Implemented bobolice-klanino-h2-profile.ts with 63 collection events |
| regressionFixture | 3 | 2026-09-03T13:45:00Z | 2026-09-03T13:48:00Z | Extracted text fixture from Sheet 6 and verified unit tests |
| addressServiceAreaMapping | 2 | 2026-09-03T13:50:00Z | 2026-09-03T13:52:00Z | Generated PRG fixture for Kłanino (65 addresses) and reference loader |
| review | 3 | 2026-09-03T14:10:00Z | 2026-09-03T14:13:00Z | Implemented runtime and API gates, manifest 2026.10, verified 8/8 coverage |

**Total active minutes:** 16 minutes
