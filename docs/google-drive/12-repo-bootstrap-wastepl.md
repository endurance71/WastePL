<!-- Source: https://docs.google.com/document/d/1AAm-PA9k1rqIfnLVv3m5oGHmlFtUbxw9arjDAYT5Pgk/edit -->
<!-- Local snapshot: 2026-08-28 -->

# 12 — Repo Bootstrap — WastePL

[Oryginał w Google Docs](https://docs.google.com/document/d/1AAm-PA9k1rqIfnLVv3m5oGHmlFtUbxw9arjDAYT5Pgk/edit)

WASTEPL — REPO BOOTSTRAP
Status: gotowe do przeniesienia do nowego repozytorium GitHub
Data: 27.08.2026


1. REPOZYTORIUM
Docelowa nazwa: WastePL
Widoczność rekomendowana na etapie PoC: private.
Domyślna gałąź: main.
Strategia: małe PR-y, squash merge, branch protection po pierwszym działającym CI.


2. DLACZEGO MODULAR MONOLITH
Na PoC nie ma uzasadnienia dla mikroserwisów. Największym ryzykiem jest poprawność danych i parserów, nie skalowanie requestów HTTP. Jeden monorepo i modular monolith upraszczają transakcje, testy i debugowanie provenance. Granice modułów projektujemy tak, aby w przyszłości można było wydzielić worker/parser service bez przepisywania domeny.


3. STRUKTURA
WastePL/
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
├── .env.example
├── docker-compose.yml
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       └── health/
│   └── worker/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/main.ts
├── packages/
│   ├── domain/
│   ├── data-standard/
│   ├── source-sdk/
│   └── test-fixtures/
├── db/
│   ├── migrations/0001_init.sql
│   └── seeds/
├── schemas/
│   └── wastepl-v0.1.schema.json
├── openapi/
│   └── wastepl-v0.1.yaml
└── docs/
    ├── adr/
    │   ├── 0001-modular-monolith.md
    │   ├── 0002-immutable-source-artifacts.md
    │   └── 0003-service-area-rule-engine.md
    └── sprint-01.md


4. ROOT package.json


{
  "name": "wastepl",
  "private": true,
  "version": "0.1.0",
  "packageManager": "pnpm@10",
  "scripts": {
    "dev": "pnpm --parallel --filter './apps/*' dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "db:up": "docker compose up -d postgres redis minio",
    "db:down": "docker compose down",
    "db:logs": "docker compose logs -f"
  }
}


5. pnpm-workspace.yaml


packages:
  - 'apps/*'
  - 'packages/*'


6. tsconfig.base.json


{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "sourceMap": true
  }
}


7. .env.example


NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://wastepl:wastepl@localhost:5432/wastepl
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=wastepl-raw
S3_ACCESS_KEY=minio
S3_SECRET_KEY=change-me
S3_FORCE_PATH_STYLE=true
LOG_LEVEL=info


8. docker-compose.yml — założenia
Usługi:
• postgres: obraz PostGIS, port 5432, healthcheck pg_isready,
• redis: port 6379, persistent volume opcjonalnie w PoC,
• minio: porty 9000/9001, osobny volume,
• bucket wastepl-raw tworzony przez init job lub skrypt.
Nie umieszczać produkcyjnych haseł ani tokenów w compose.


9. MODUŁY DOMENOWE API
AddressModule
• resolve address,
• PRG/TERYT mapping.


CollectionModule
• resolve service area,
• query collection events,
• quality/source projection.


SourceModule
• Source Registry,
• source metadata,
• artifact history.


FacilityModule
• PSZOK i punkty odbioru,
• spatial search.


ReviewModule — później
• conflicts,
• parser review,
• approve/reject.


10. WORKER
Worker odpowiada za:
1) pobranie source,
2) fingerprint/hash,
3) zapis immutable artifact,
4) wybór adaptera,
5) extraction,
6) JSON Schema validation,
7) domain validation,
8) diff,
9) publish lub REVIEW_REQUIRED.


API nie powinno parsować PDF podczas requestu użytkownika.


11. INTERFEJS ADAPTERA


export interface SourceAdapter<TOutput> {
  readonly key: string;
  readonly version: string;


  supports(input: SourceArtifactMeta): boolean;
  parse(input: SourceArtifact): Promise<ParseResult<TOutput>>;
}


export type ParseResult<T> = {
  data: T;
  confidence: number;
  warnings: string[];
  metrics: {
    recordsRead: number;
    recordsProduced: number;
  };
};


Każdy adapter ma fixtures i deterministyczne testy. Adapter nie zapisuje bezpośrednio do produkcyjnych tabel domenowych.


12. PIPELINE GRANICE ODPOWIEDZIALNOŚCI
Fetcher: pobiera bytes i metadata HTTP.
Artifact Store: immutable bytes + sha256.
Adapter: interpretuje format źródłowy.
Normalizer: mapuje output adaptera do WastePL Schema.
Validator: schema + domena.
Diff Engine: porównuje normalized snapshot z poprzednim.
Publisher: transakcja DB / wersjonowanie.
Review Queue: przypadki niejednoznaczne.


13. ADR-0001 — MODULAR MONOLITH
Decision:
PoC implementujemy jako jeden monorepo z API i workerem współdzielącymi packages/domain oraz contracts.


Consequences:
+ mniej operacyjnego narzutu,
+ prostsze transakcje i debugowanie,
+ jeden kontrakt typów,
− należy pilnować granic modułów,
− worker nie może stać się zbiorem importów z API internals.


14. ADR-0002 — IMMUTABLE SOURCE ARTIFACTS
Decision:
Każda nowa zawartość źródła jest zapisywana jako immutable artifact identyfikowany przez SHA-256.


Consequences:
+ audytowalność,
+ reprodukowalne parser tests,
+ możliwość odtworzenia historycznej decyzji,
− koszt storage, akceptowalny względem wartości provenance.


15. ADR-0003 — SERVICE AREA RULE ENGINE
Decision:
Podstawowym modelem zasięgu strefy są reguły adresowe, nie polygon GIS.


Specificity order:
EXPLICIT_ADDRESS > EXPLICIT_NUMBERS > NUMBER_RANGE > STREET > LOCALITY > MUNICIPALITY.


Conflict:
Jeśli dwie strefy uzyskują równoważny najwyższy wynik, nie zgadujemy — REVIEW_REQUIRED / 409 w API.


16. SECURITY BASELINE
• zero sekretów w repo,
• allowlist typów/rozmiarów pobieranych artifactów,
• timeout i maksymalny rozmiar source fetch,
• parser nie wykonuje makr XLSX ani kodu z dokumentów,
• HTML parser nie uruchamia JavaScript z obcej strony,
• storage raw nie jest publiczny,
• outbound fetch chroniony przed SSRF — Source Registry jest kontrolowany, bez dowolnych URL od użytkownika,
• logi nie powinny zawierać pełnych danych użytkownika ponad to, co niezbędne do diagnostyki,
• publiczny endpoint ma rate limiting przed otwarciem na internet.


17. CI — PIERWSZA WERSJA
Na każdy PR:
1) install z lockfile,
2) lint,
3) typecheck,
4) unit tests,
5) JSON Schema fixtures,
6) migration test na ephemeral Postgres/PostGIS,
7) golden parser fixtures bez dostępu do live internetu.


Live-source smoke tests nie powinny blokować PR, ponieważ zewnętrzne strony mogą być chwilowo niedostępne. Uruchamiać je osobno/scheduled.


18. README — GŁÓWNY KOMUNIKAT
WastePL is a vendor-neutral data layer for municipal waste collection in Poland. It normalizes fragmented public schedules and waste facilities into one auditable, versioned data model and API.


PoC focus:
• address → service area → collection schedule,
• official source provenance,
• deterministic adapters,
• PRG/TERYT address normalization,
• pilot municipalities around Koszalin.


19. PIERWSZY COMMIT
Rekomendowany commit:
chore: bootstrap WastePL data platform


Zakres pierwszego commita:
• root workspace,
• docker-compose,
• OpenAPI v0.1,
• JSON Schema v0.1,
• SQL migration 0001,
• ADR-0001..0003,
• Sprint 01 backlog,
• README.


20. GITHUB BLOCKER
W aktualnie dostępnym połączeniu GitHub możliwe jest tworzenie plików, branchy, commitów, issues i PR w istniejącym repozytorium, ale nie ma akcji utworzenia nowego repozytorium. Dlatego niczego nie zapisano do przypadkowego repo. Po utworzeniu pustego prywatnego repo WastePL wszystkie materiały z tego dokumentu i folderu Drive powinny zostać przeniesione jako pierwszy commit.
