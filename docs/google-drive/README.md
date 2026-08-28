# Indeks migracji Google Drive

GitHub jest źródłem prawdy. Dawne lokalne migawki dokumentów `00–12` usunięto z bieżącego drzewa po konsolidacji; pozostają dostępne w historii Git. Dokumenty na Google Drive będą warstwą prezentacyjną aktualizowaną dopiero po scaleniu PR z dokumentacją.

Folder prezentacyjny: [WastePL na Google Drive](https://drive.google.com/drive/folders/1oAILVMYcnsI49RYQretn_q1tofgFSeGk).

## Mapa dawnych dokumentów

| Dokument Drive | Kanoniczny odpowiednik |
| --- | --- |
| 00 — START HERE | [Mapa dokumentacji](../README.md) i [bieżący status](../current-status.md) |
| 01 — Feasibility Study; 06 — Research | [Feasibility i research](../product/feasibility-and-research.md) |
| 02 — Produkt, MVP i model biznesowy | [Wizja i produkt](../product/vision-and-product.md) oraz [model biznesowy i B2G](../product/business-and-b2g.md) |
| 03 — Data Standard; 11 — JSON Schema | [Standard danych](../architecture/data-standard.md) i [kanoniczne schematy](../../schemas/) |
| 04 — Architektura | [Architektura](../architecture/overview.md) i [ADR](../adr/) |
| 05 — Roadmap, pilot i metryki | [Roadmapa](../product/roadmap.md) |
| 07 — Finansowanie, prawo i B2G | [Model biznesowy i B2G](../product/business-and-b2g.md) |
| 08 — OpenAPI | [Publiczne](../../openapi/wastepl-v0.1.yaml) i [wewnętrzne OpenAPI](../../openapi/wastepl-internal-v0.1.yaml) |
| 09 — PostgreSQL/PostGIS | [Migracje](../../db/migrations/) |
| 10 — Sprint 01 Backlog | [Historyczny zakres](../sprint-01.md) i [retrospektywa](../planning/sprint-01-retrospective.md) |
| 12 — Repo Bootstrap | [README repozytorium](../../README.md) |

Po scaleniu PR dokumenty Drive `01–04` i `06–12` należy przenieść bez usuwania do `Archive — 2026-08-27 source drafts`. Aktywne `00` i `05` należy zaktualizować, a `13 — Current Status — WastePL` utworzyć na podstawie plików kanonicznych.
