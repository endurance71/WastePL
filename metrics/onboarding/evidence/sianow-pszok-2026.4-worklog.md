# Sianów PSZOK 2026.4 prospective onboarding worklog

> Measurement mode: `PROSPECTIVE`. Timezone: `Europe/Warsaw`. Timer resolution: whole minutes, rounded to the nearest whole minute from explicit phase boundary timestamps. CI queue/runtime waiting and later external waiting are excluded by stopping the active phase timer before those waits.

## Target

- Municipality: Sianów (`3209073`)
- Data type: `PSZOK`
- Intended source key: `sianow-pszok`
- Intended manifest: `pilot-koszalin-region@2026.4`
- Candidate parser: `municipal-pszok-html`
- Expected reuse class before implementation: `EXTENDED_EXISTING`

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

Current 2026 schedule PDFs published by the municipality independently repeat the PSZOK location and Monday/Thursday/Saturday hours. This is used as corroborating current-period evidence, not as an additional ACTIVE artifact for the facility.

## Phase log

| Phase | Start | End | Rounded minutes | State | Notes |
| --- | --- | --- | ---: | --- | --- |
| discovery | 2026-08-29 12:07:52+02:00 | 2026-08-29 12:10:42+02:00 | 3 | complete | Compared remaining pilot blockers and searched for a lower-risk direct official source suitable for the first post-2026.3 prospective measurement. |
| sourceAssessment | 2026-08-29 12:10:42+02:00 | 2026-08-29 12:11:19+02:00 | 1 | complete | Confirmed direct municipal HTML semantics and corroborating 2026 schedule evidence; no trusted coordinates are claimed. |
| parserImplementation | 2026-08-29 12:11:19+02:00 | — | — | active | Existing municipal PSZOK adapter/handler inspected before code changes. |
| regressionFixture | — | — | — | pending | — |
| addressServiceAreaMapping | — | — | — | pending | PSZOK has no collection service-area mapping; phase will measure the explicit determination that no address/service-area rules are required. |
| review | — | — | — | pending | — |

## Measurement guardrails

- No minutes are reconstructed from Git commit timestamps or PR duration.
- No CI execution time will be counted as human-active work.
- A phase may legitimately be 0 minutes if explicit start/end timestamps fall within less than 30 seconds at this timer resolution.
- Final onboarding metrics will reference this file and the implementation/regression evidence in the repository.
