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
- wynik: `success`;
- head SHA: `04bd1cb13d0e001813e5f7a1c36adce1acfe17bc`.

Ten run był zielony, ale nie obejmuje obecnego HEAD `a13b66c`, ponieważ po nim zostały zmergowane kolejne rozszerzenia coverage. Dlatego aktualny `main` powinien zostać ponownie przepuszczony przez `live-source-staging` przy najbliższej możliwości (scheduled run lub ręczny `workflow_dispatch`).

## Branch protection — otwarta luka P0

Na dzień 2026-09-07 GitHub raportuje dla `main`:

- `protected: false`;
- required status checks: `off`.

Oznacza to, że obecne CI działa i jest zielone, ale GitHub nie wymusza jeszcze procesu PR + required CI na poziomie konfiguracji brancha. Problem jest śledzony w issue `#84` (`P0 Enforce main branch protection and required CI`).

Docelowo należy wymusić co najmniej:

1. pull request dla zwykłych zmian;
2. wymagany check `ci` przed merge;
3. blokadę merge dla pending/failed CI;
4. blokadę zwykłych direct push do `main`;
5. opcjonalnie wymagany CodeQL po ustabilizowaniu nazwy/check contextu.

## Ocena stanu

Repozytorium jest technicznie zdrowe: aktualny `main` ma zielone CI i CodeQL, a zwiększanie coverage nie wprowadziło konfliktów ani ambiguity. Najważniejszym ograniczeniem produktowym pozostaje głębokość pokrycia adresowego (51,20%), a najważniejszym ograniczeniem operacyjnym — brak branch protection.

## Następne działania

Priorytet działań po tej weryfikacji:

1. uruchomić/zweryfikować `live-source-staging` na HEAD `a13b66c`;
2. domknąć issue `#84` przez włączenie branch protection/ruleset i required CI;
3. kontynuować zwiększanie address coverage bez luzowania kryteriów jednoznaczności;
4. okresowo synchronizować `docs/current-status.md` i roadmapę z aktualnym Census oraz Actions.
