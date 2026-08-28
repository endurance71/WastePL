# Dokumentacja WastePL

GitHub jest kanonicznym źródłem kontraktów, statusu projektu i dokumentacji technicznej WastePL. Google Drive jest warstwą prezentacyjną dla zespołu, inwestorów i JST; nie zastępuje plików z tego repozytorium.

## Zacznij tutaj

- [Bieżący status](current-status.md) — zweryfikowany etap, metryki, ryzyka i następne kroki.
- [Wizja i produkt](product/vision-and-product.md) — problem, odbiorcy, zakres oraz zasady produktu.
- [Feasibility i research](product/feasibility-and-research.md) — źródła, wykonalność i ograniczenia badania.
- [Model biznesowy i B2G](product/business-and-b2g.md) — hipotezy komercyjne, sprzedaż do JST i ramy prawne.
- [Roadmapa](product/roadmap.md) — etapy, bramki i miary powodzenia.
- [Architektura](architecture/overview.md) — system, przepływ danych i stan wdrożenia.
- [Standard danych](architecture/data-standard.md) — znaczenie encji, jakości i pochodzenia danych.
- [Retrospektywa Sprintu 01](planning/sprint-01-retrospective.md) — plan, wynik i wnioski.

## Kontrakty i decyzje

Kontraktów nie kopiuje się do dokumentów opisowych. Ich obowiązujące wersje znajdują się w:

- [publicznym OpenAPI](../openapi/wastepl-v0.1.yaml) i [wewnętrznym OpenAPI](../openapi/wastepl-internal-v0.1.yaml);
- [JSON Schema v0.1](../schemas/wastepl-v0.1.schema.json), [facility v0.2](../schemas/wastepl-facility-v0.2.schema.json) i [source manifest v0.1](../schemas/source-manifest-v0.1.schema.json);
- [migracjach bazy](../db/migrations/);
- [ADR](adr/) opisujących przyjęte decyzje;
- [manifeście pilota](../manifests/pilot-koszalin-region-2026.1.json).

## Zasady utrzymania

1. Zmiana zachowania API, modelu danych lub architektury wymaga aktualizacji kontraktu lub ADR w tym samym PR.
2. `docs/current-status.md` podaje datę i pełny SHA, dla którego zweryfikowano stan.
3. Materiały prawne, finansowe i badawcze są datowanymi materiałami roboczymi. Twierdzenia, które mogą się zmienić, muszą wskazywać źródło pierwotne i datę weryfikacji.
4. Liczby pilota zawsze rozróżniają dane deterministycznych fixtures od danych pobranych produkcyjnie.
5. Przed PR należy uruchomić `pnpm docs:check`, `pnpm contracts:check` i `git diff --check`.
6. Google Drive aktualizuje się dopiero po scaleniu zmian z GitHuba. [Indeks migracji Drive](google-drive/README.md) wskazuje odpowiedniki dawnych dokumentów.
