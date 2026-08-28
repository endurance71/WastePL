# Live-source staging gate

## Cel

Workflow `live-source-staging` sprawdza sześć źródeł `ACTIVE` z manifestu `pilot-koszalin-region@2026.2` przeciwko rzeczywistym stronom JST/operatorów. Jest to bramka operacyjna do wykrywania awarii źródeł i driftu szablonów. Nie jest częścią deterministycznego CI pull requestów.

## Izolacja

Gate uruchamia pełną ścieżkę runtime wyłącznie w środowisku efemerycznym GitHub Actions:

- osobna baza `wastepl_live_source_gate`;
- structural migrations bez canonical pilot seedów;
- osobny bucket `wastepl-live-source-<run_id>` w lokalnym MinIO runnera;
- osobny Redis/BullMQ runnera;
- production HTTP fetcher i production parser handlers;
- brak połączenia z produkcyjną bazą, bucketem lub kolejką.

Skrypt ma fail-closed safety checks. Odmówi startu, jeżeli nazwa bazy nie jest dokładnie `wastepl_live_source_gate`, live DB jest równe `DATABASE_URL` lub `S3_BUCKET` nie zaczyna się od `wastepl-live-source-`.

## Uruchamianie

Workflow jest wyłącznie ręczny (`workflow_dispatch`). Nie dodawać wywołań stron gmin do `ci.yml`, testów pull requestów ani golden gates.

Po uruchomieniu workflow:

1. buduje i typecheckuje warstwę domain/worker;
2. tworzy czystą bazę i importuje minimalny authoritative-shaped pack TERYT/PRG potrzebny do testowanego zakresu;
3. synchronizuje manifest `2026.2`;
4. pobiera każde z sześciu źródeł `ACTIVE` przez `HttpSourceFetcher` z timeout/retry/redirect semantics;
5. zapisuje live bytes jako immutable artifacts w izolowanym MinIO;
6. przekazuje artefakty przez durable outbox, BullMQ i te same handlery co runtime;
7. sprawdza krytyczne canonical identities i kompletność bundle `koszalin-pszok`;
8. zapisuje JSON i skrócony Markdown jako artifact workflow.

## Wyniki per źródło

- `HEALTHY` — źródło pobrane i opublikowane przez parser, bez wykrytego porównywalnego byte driftu;
- `CHANGED_BUT_PARSEABLE` — bytes różnią się od regresyjnego HTML fixture, ale parser i krytyczna canonical identity nadal działają;
- `REVIEW_REQUIRED` — runtime jawnie skierował wynik do review; cały workflow może zakończyć się `WARN`;
- `FETCH_FAILED` — źródła nie dało się pobrać zgodnie z retry policy;
- `PARSE_FAILED` — fetch się udał, ale production parser nie zakończył się poprawnym terminal state;
- `WAITING_FOR_COMPANION` — wymagany bundle nie był kompletny lub zgodny czasowo.

Dla surowych PDF-ów fixture regresyjny jest pre-extracted text, dlatego byte SHA live PDF nie jest porównywany bezpośrednio z fixture text. Ich zdrowie ocenia rzeczywiste pobranie i production parser path.

## Semantyka całego runu

`PASS` oznacza, że wszystkie krytyczne źródła są pobieralne, parsowalne i zachowują wymagane canonical evidence. `WARN` oznacza brak krytycznej awarii, ale co najmniej jeden wynik wymaga review. `FAIL` oznacza fetch/parse/bundle failure albo brak krytycznej expected canonical evidence.

`CHANGED_BUT_PARSEABLE` samo w sobie nie jest failure. Publiczne strony mogą zmieniać bytes bez zmiany znaczenia danych.

## Artefakty

Każdy run archiwizuje, także po failure:

- `apps/worker/test-results/live-source-staging-report.json` — machine-readable wynik z source key, TERC, final URL, HTTP status, content type, SHA-256, parser key/version, timing, safe error code i canonical evidence;
- `apps/worker/test-results/live-source-staging-summary.md` — krótki raport do szybkiego odczytu.

Raport nie zapisuje storage credentials ani surowych wewnętrznych stack traces.

## Czego gate nie robi

- nie publikuje danych do produkcji;
- nie promuje `PLANNED` do `ACTIVE`;
- nie zmienia manifestu;
- nie zastępuje fixture-independent production gate z `#45`;
- nie dowodzi pełnego pokrycia 8 gmin;
- nie dowodzi gotowości consumer PWA.

Po stabilnym przejściu live gate można osobno podjąć decyzję o kontrolowanym stagingu długotrwałym i o `ARTIFACT_PROCESSING_ENABLED=true` w realnym środowisku.
