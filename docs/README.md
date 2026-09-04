# Dokumentacja WastePL

GitHub jest kanonicznym źródłem kontraktów, statusu projektu i dokumentacji technicznej WastePL. Google Drive jest warstwą prezentacyjną dla zespołu, inwestorów i JST; nie zastępuje plików z tego repozytorium.

## Zacznij tutaj

- [Bieżący status](current-status.md) — zweryfikowany etap, metryki, ryzyka i następne kroki.
- [Roadmapa](product/roadmap.md) — aktualna kolejność prac i bramki jakościowe.
- [Wizja i produkt](product/vision-and-product.md) — problem, odbiorcy, zakres i zasady produktu.
- [Feasibility i research](product/feasibility-and-research.md) — źródła, wykonalność i ograniczenia skalowania.
- [Model biznesowy i B2G](product/business-and-b2g.md) — hipotezy komercyjne, sprzedaż do JST i ramy prawne.
- [Architektura](architecture/overview.md) — system, przepływ danych i stan wdrożenia.
- [Standard danych](architecture/data-standard.md) — znaczenie encji, jakości i pochodzenia danych.
- [Live-source staging gate](runbooks/live-source-staging-gate.md) — rzeczywisty test publicznych upstreamów.
- [Onboarding economics](onboarding-economics.md) — metryki wdrożenia i automatyzacji.
- [Retrospektywa Sprintu 01](planning/sprint-01-retrospective.md) — dokument historyczny.

## Kontrakty i decyzje

Kontraktów nie kopiuje się do dokumentów opisowych. Ich obowiązujące wersje znajdują się w:

- [publicznym OpenAPI](../openapi/wastepl-v0.1.yaml) i [wewnętrznym OpenAPI](../openapi/wastepl-internal-v0.1.yaml);
- [JSON Schema v0.1](../schemas/wastepl-v0.1.schema.json), [facility v0.2](../schemas/wastepl-facility-v0.2.schema.json) i [source manifest v0.1](../schemas/source-manifest-v0.1.schema.json);
- [migracjach bazy](../db/migrations/);
- [ADR](adr/) opisujących przyjęte decyzje;
- [aktualnym manifeście pilota `2026.13`](../manifests/pilot-koszalin-region-2026.13.json).

## Zasady utrzymania

1. Zmiana zachowania API, modelu danych lub architektury wymaga aktualizacji kontraktu lub ADR w tym samym PR.
2. `docs/current-status.md` wskazuje datę oraz commit `main`, względem którego stan został zweryfikowany.
3. `docs/product/roadmap.md` opisuje stan obecny i kolejność bramek; dokumenty sprintowe i retrospektywy są historyczne i nie powinny być używane jako bieżący status.
4. Materiały prawne, finansowe i badawcze są datowanymi materiałami roboczymi. Twierdzenia, które mogą się zmienić, muszą wskazywać źródło pierwotne i datę weryfikacji.
5. Liczby pilota zawsze rozróżniają:
   - municipality source presence;
   - pełne address coverage względem wszystkich adresów PRG;
   - audited-address correctness na jawnej próbce;
   - dane deterministycznych fixtures od rzeczywistych live-source runs.
6. `8/8 gmin z ACTIVE source` nigdy nie jest automatycznie opisywane jako `100% address coverage`.
7. `415/415` oznacza poprawność w audytowanych zestawach adresów, dopóki pełny PRG Address Coverage Census nie ustali denominatora całego pilota.
8. Zielony deterministyczny CI nie zastępuje ręcznego lub cyklicznego live-source testu publicznych upstreamów.
9. Przed PR należy uruchomić co najmniej `pnpm docs:check`, `pnpm contracts:check` i `git diff --check`; zmiany kodu uruchamiają również odpowiednie build/typecheck/test/E2E gates.
10. Google Drive aktualizuje się dopiero po scaleniu zmian z GitHuba. [Indeks migracji Drive](google-drive/README.md) wskazuje odpowiedniki dawnych dokumentów.

## Źródło prawdy dla bieżącego stanu

Jeżeli dwa dokumenty są ze sobą sprzeczne, pierwszeństwo mają w tej kolejności:

1. wersjonowane kontrakty, migracje i manifesty;
2. machine-readable raporty/gates;
3. `docs/current-status.md`;
4. `docs/product/roadmap.md`;
5. dokumenty historyczne sprintów, discovery i prezentacyjne.
