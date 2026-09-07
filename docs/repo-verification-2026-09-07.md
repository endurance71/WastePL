# WastePL — weryfikacja repozytorium 2026-09-07

Ten dokument jest krótkim snapshotem operacyjnym wykonanym na podstawie aktualnego stanu GitHub i nie zastępuje `docs/current-status.md` ani roadmapy. Jego celem jest zapisanie zweryfikowanych faktów o bieżącym `main` oraz wskazanie dwóch otwartych luk operacyjnych.

## Zweryfikowany HEAD

- branch: `main`
- commit: `a13b66c726ab8a54fe65d46a0f0929e0330bd85b`
- merge/PR: `#137`
- zmiana: rozszerzenie address coverage Świeszyna o Trasa II safe rural localities (479 oficjalnych punktów PRG)

## CI i bezpieczeństwo

Na aktualnym HEAD zakończyły się sukcesem:

- `ci` run `#277` — `success`;
- `codeql` run `#20` — `success`.

Wniosek: bieżący kod na `main` przeszedł podstawowy pipeline CI i CodeQL SAST.

## Address coverage

Stan po PR #137:

- regionalny pilot: **12 816 / 25 030 = 51,20%** oficjalnych adresów PRG obsługiwanych jednoznacznie;
- Świeszyno: **646 / 2 430 = 26,58%**;
- ambiguity: **0,00%**;
- conflicts: **0**;
- engine errors: **0**.

Coverage należy interpretować jako udział pełnej populacji adresów PRG, a nie jako liczbę gmin z obecnym źródłem harmonogramu.

## Live-source staging

Workflow `.github/workflows/live-source-staging.yml` działa codziennie oraz obsługuje `workflow_dispatch`.

Najnowszy zweryfikowany run:

- workflow: `live-source-staging`;
- run: `#8` / GitHub Actions run ID `34021554761`;
- data: 2026-09-06;
- event: `schedule`;
- wynik: **PASS / success**;
- head SHA: `04bd1cb13d0e001813e5f7a1c36adce1acfe17bc`;
- manifest: `pilot-koszalin-region@2026.13`;
- tryb: `LIVE_HTTP_ISOLATED_RUNTIME`.

Zweryfikowany artefakt `live-source-staging-report-34021554761` potwierdza:

- **17/17 ACTIVE sources observed**;
- **8 HEALTHY**;
- **9 CHANGED_BUT_PARSEABLE**;
- **0 REVIEW_REQUIRED**;
- **0 critical failures**;
- `canonicalChecks.missingSourceKeys = []`;
- `canonicalChecks.allExpectedObserved = true`;
- bundle `koszalin-pszok` kompletny (`main` + `faq`);
- izolowana baza `wastepl_live_source_gate` i izolowany bucket;
- `productionMutationAllowed = false`.

Sam job `live-source-gate` wykonał z sukcesem instalację frozen-lockfile, build gate'a, rzeczywisty isolated runtime gate oraz upload raportu.

Ten run był zielony i potwierdza zdrowie pełnych 17 aktywnych upstreamów manifestu, ale nie obejmuje obecnego HEAD `a13b66c`, ponieważ po nim zostały zmergowane kolejne rozszerzenia coverage. Dlatego aktualny `main` powinien zostać ponownie przepuszczony przez `live-source-staging` przy najbliższej możliwości (scheduled run lub ręczny `workflow_dispatch`).

## Branch protection — otwarta luka P0 ograniczona planem GitHub

Na dzień 2026-09-07 GitHub raportuje dla `main`:

- `protected: false`;
- required status checks: `off`.

Issue `#84` dokumentuje dodatkowo zweryfikowane ograniczenie platformy: dla obecnego **prywatnego repozytorium na GitHub Free** natywne Branch Protection Rules / wymagane status checks nie mogą zostać włączone bez zmiany warunków konta/repozytorium. Weryfikacja API zwracała komunikat: `Upgrade to GitHub Pro or make this repository public to enable this feature.`

Oznacza to, że obecne CI działa i jest zielone, ale GitHub nie wymusza procesu PR + required CI na poziomie konfiguracji brancha. Do czasu zmiany planu lub widoczności repo obowiązują opisane w runbooku kontrole kompensacyjne: CI i CodeQL na PR oraz push do `main`, `--frozen-lockfile`, akcje przypięte do pełnych SHA i proces squash-merge po zielonych checkach.

Docelowe opcje rozwiązania #84:

1. przejść na plan umożliwiający ochronę prywatnego repozytorium; albo
2. zmienić repozytorium na publiczne, jeśli będzie to zgodne ze strategią projektu i polityką ujawniania kodu; następnie
3. wymusić pull request dla zwykłych zmian;
4. wymagać checku `ci` przed merge;
5. blokować merge dla pending/failed CI oraz zwykłe direct push do `main`;
6. opcjonalnie wymagać również CodeQL po ustabilizowaniu check contextu.

## Ocena stanu

Repozytorium jest technicznie zdrowe: aktualny `main` ma zielone CI i CodeQL, a zwiększanie coverage nie wprowadziło konfliktów ani ambiguity. Najważniejszym ograniczeniem produktowym pozostaje głębokość pokrycia adresowego (51,20%), a najważniejszym ograniczeniem operacyjnym — brak wymuszanej przez platformę ochrony `main` przy obecnym planie i widoczności repozytorium.

## Następne działania

Priorytet działań po tej weryfikacji:

1. uruchomić/zweryfikować `live-source-staging` na HEAD `a13b66c`;
2. utrzymać kontrole kompensacyjne dla #84 i zdecydować, czy branch protection ma zostać odblokowane przez GitHub Pro czy ewentualną zmianę widoczności repo;
3. kontynuować zwiększanie address coverage bez luzowania kryteriów jednoznaczności;
4. okresowo synchronizować `docs/current-status.md` i roadmapę z aktualnym Census oraz Actions.
