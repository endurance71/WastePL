# Sianów PSZOK 2026.4 prospective onboarding worklog

> Measurement mode: `PROSPECTIVE`. Timezone: `Europe/Warsaw`. Timer resolution: whole minutes, rounded to the nearest whole minute from explicit phase boundary timestamps. CI queue/runtime waiting and external waiting are excluded by stopping the active phase timer before those waits.

## Target

- Municipality: Sianów (`3209073`)
- Data type: `PSZOK`
- Source key: `sianow-pszok`
- Manifest: `pilot-koszalin-region@2026.4`
- Parser: `municipal-pszok-html`
- Reuse class: `EXTENDED_EXISTING`

## Official evidence inspected prospectively

Primary municipal page:

`https://sianow.pl/dla-mieszkanca/odpady-komunalne/nieruchomosci-zamieszkale/punkt-selektywnej-zbiorki-odpadow-komunalnych/`

The official page states:

- PSZOK location: Sianów, ul. Łubuszan 80, on the waste recovery facility site;
- operator: Przedsiębiorstwo Gospodarki Komunalnej Sp. z o.o. in Koszalin;
- Monday 08:00–16:00;
- Thursday 08:00–16:00;
- Saturday 08:00–14:00;
- access for residents of Gmina i Miasto Sianów under the municipal waste fee;
- proof of payment must be shown when delivering waste;
- explicit accepted-material catalogue including bulky waste, electronics, tyres, green waste, construction/demolition municipal waste, expired medicines/chemicals, batteries/accumulators, hazardous household chemicals and textiles.

Current 2026 schedule PDFs published by the municipality independently repeat the PSZOK location and Monday/Thursday/Saturday hours. This is corroborating current-period evidence, not an additional ACTIVE artifact for the facility.

## Phase log

| Phase | Start | End | Rounded minutes | State | Notes |
| --- | --- | --- | ---: | --- | --- |
| discovery | 2026-08-29 12:07:52+02:00 | 2026-08-29 12:10:42+02:00 | 3 | complete | Compared remaining pilot blockers and searched for a lower-risk direct official source suitable for the first post-2026.3 prospective measurement. |
| sourceAssessment | 2026-08-29 12:10:42+02:00 | 2026-08-29 12:11:19+02:00 | 1 | complete | Confirmed direct municipal HTML semantics and corroborating 2026 schedule evidence; no trusted coordinates are claimed. |
| parserImplementation | 2026-08-29 12:11:19+02:00 | 2026-08-29 12:14:30+02:00 | 3 | complete | Extended `municipal-pszok-html` with a source-key-specific Sianów profile and registered TERC 3209073 in the existing production handler. |
| regressionFixture | 2026-08-29 12:14:30+02:00 | 2026-08-29 12:16:06+02:00 | 2 | complete | Added frozen minimal official-content regression fixture, adapter assertions, semantic-drift rejection and immutable-artifact runtime coverage. |
| addressServiceAreaMapping | 2026-08-29 12:16:06+02:00 | 2026-08-29 12:16:13+02:00 | 0 | complete | PSZOK does not create collection service-area rules. Facility access is source-backed `MUNICIPALITY_RESIDENTS`; seven active seconds round to 0 at the declared timer resolution. |
| review | 2026-08-29 12:16:13+02:00 | 2026-08-29 12:19:17+02:00 | 3 | complete-pre-CI | Reviewed rollout isolation, created manifest 2026.4 and strengthened manifest rollout assertions. |
| review follow-up | 2026-08-29 13:26+02:00 | 2026-08-29 13:30:55+02:00 | 5 | complete | Wired the Sianów worker and public-API production post-gates, diagnosed CI #135, advanced the live-source baseline from 2026.3 to 2026.4 and removed the misleading secondary missing-report upload failure. |

Closed, auditable human-active intervals total: **17 minutes**.

A prior follow-up interval was explicitly started in the previous session at `2026-08-29 12:26:09+02:00` while the public-API post-gate was being added, but no explicit end boundary was captured before that session ended. Its duration is **not reconstructed from Git timestamps and is not imputed** into the 17-minute total. Therefore 17 minutes is an auditable measured lower bound, not a claim that every active second across interrupted sessions was captured.

## Measurement guardrails

- No minutes are reconstructed from Git commit timestamps or PR duration.
- No CI execution time is counted as human-active work.
- A phase may legitimately be 0 minutes if explicit start/end timestamps fall within less than 30 seconds at this timer resolution.
- Only closed timer intervals contribute numeric minutes.
- An unclosed interval remains disclosed rather than backfilled with synthetic precision.
- Final onboarding metrics reference this file and implementation/regression evidence in the repository.
