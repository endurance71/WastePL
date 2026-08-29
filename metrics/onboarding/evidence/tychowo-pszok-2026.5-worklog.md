# Tychowo PSZOK 2026.5 prospective onboarding worklog

> Measurement mode: `PROSPECTIVE`. Timezone: `Europe/Warsaw`. Timer resolution: whole minutes rounded from explicit phase boundaries. CI/external waiting is excluded. No duration is reconstructed from Git timestamps.

## Target

- Municipality: Tychowo (`3201043`)
- Data type: `PSZOK`
- Intended source key: `tychowo-pszok`
- Intended manifest: `pilot-koszalin-region@2026.5`
- Candidate parser: `municipal-pszok-html`
- Expected reuse class: `EXTENDED_EXISTING`

## Candidate official evidence

Primary current municipal HTML:

`https://tychowo.pl/cms/2153/gospodarka_odpadami`

The current 2026 page identifies PSZOK at ul. Dolna 8 in Tychowo and states that problem waste such as paints/lacquers, waste electrical/electronic equipment and expired medicines may be delivered there.

The page links the official PSZOK regulation:

`https://cms-v2-files.idcom-jst.pl/sites/64/cms/szablony/2153/pliki/regulamin_pszok.pdf`

The regulation confirms Tuesday/Thursday/Saturday 08:00–14:30, operator Gminny Ośrodek Sportu i Gospodarki Komunalnej, eligible Tychowo households/property users, proof/identity rules and an explicit accepted-waste catalogue. Whether the PDF becomes a required runtime artifact or only corroborating assessment evidence is intentionally unresolved until sourceAssessment ends.

## Phase log

| Phase | Start | End | Rounded minutes | State | Notes |
| --- | --- | --- | ---: | --- | --- |
| discovery | 2026-08-29 13:44:37+02:00 | 2026-08-29 13:45:51+02:00 | 1 | complete | Compared remaining pilot PSZOK candidates; Tychowo is a single local facility while Manowo spans multiple Koszalin locations and introduces cross-municipality reconciliation complexity. |
| sourceAssessment | 2026-08-29 13:45:51+02:00 | — | — | active | Determine the minimum source-backed claims that can be activated safely from the direct HTML without silently depending on an unversioned child PDF. |
| parserImplementation | — | — | — | pending | — |
| regressionFixture | — | — | — | pending | — |
| addressServiceAreaMapping | — | — | — | pending | PSZOK does not create collection service-area rules; this phase will still record the explicit scope determination. |
| review | — | — | — | pending | — |

## Guardrails

- Tychowo collection coverage must remain unchanged.
- No trusted coordinates will be invented.
- If runtime uses only HTML, only claims present in that HTML may be emitted; PDF-only operator/access/material detail may not leak into canonical output.
- If the PDF is made a required runtime artifact, it must be a separately immutable/versioned source identity or bundle member; parent-link discovery alone is insufficient provenance.
- Existing historical manifests remain immutable.
