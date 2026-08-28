<!-- Source: https://docs.google.com/document/d/1afcxMCa9jpsMCpTpxhT2yNa8j-Q1_mRhRMYzx_tzvFk/edit -->
<!-- Local snapshot: 2026-08-28 -->

# 09 — PostgreSQL + PostGIS Schema v0.1 — WastePL

[Oryginał w Google Docs](https://docs.google.com/document/d/1afcxMCa9jpsMCpTpxhT2yNa8j-Q1_mRhRMYzx_tzvFk/edit)

WASTEPL — PostgreSQL + PostGIS Schema v0.1
Status: PoC database contract
Data: 27.08.2026


1. ZAŁOŻENIA
• PostgreSQL jest źródłem prawdy dla znormalizowanych danych.
• PostGIS służy do lokalizacji adresów i punktów, nie do wymuszania modelowania wszystkich rejonów jako polygonów.
• Strefy odbioru są opisywane regułami adresowymi z priorytetami i wyjątkami.
• Każdy rekord harmonogramu musi wskazywać artifact źródłowy.
• Surowe pliki źródłowe pozostają poza bazą w object storage; baza przechowuje fingerprint i metadane.
• UUID generowane przez pgcrypto.


2. DDL v0.1


CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;


CREATE TABLE municipalities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terc text NOT NULL UNIQUE,
  name text NOT NULL,
  municipality_type text,
  voivodeship_code text,
  county_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE TABLE localities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simc text NOT NULL UNIQUE,
  municipality_id uuid NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  name text NOT NULL,
  locality_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX idx_localities_municipality ON localities(municipality_id);
CREATE INDEX idx_localities_name_lower ON localities(lower(name));


CREATE TABLE streets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ulic text,
  locality_id uuid NOT NULL REFERENCES localities(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_prefix text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(locality_id, ulic)
);


CREATE INDEX idx_streets_locality ON streets(locality_id);
CREATE INDEX idx_streets_name_lower ON streets(lower(name));


CREATE TABLE addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prg_id text UNIQUE,
  municipality_id uuid NOT NULL REFERENCES municipalities(id),
  locality_id uuid NOT NULL REFERENCES localities(id),
  street_id uuid REFERENCES streets(id),
  building_number text NOT NULL,
  postal_code text,
  canonical_text text NOT NULL,
  geom geometry(Point, 4326),
  source_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX idx_addresses_municipality ON addresses(municipality_id);
CREATE INDEX idx_addresses_locality_street_number ON addresses(locality_id, street_id, building_number);
CREATE INDEX idx_addresses_geom ON addresses USING gist(geom);
CREATE INDEX idx_addresses_canonical_trgm_placeholder ON addresses(lower(canonical_text));


CREATE TABLE waste_fractions (
  code text PRIMARY KEY,
  name_pl text NOT NULL,
  category text,
  active boolean NOT NULL DEFAULT true
);


INSERT INTO waste_fractions(code, name_pl, category) VALUES
  ('MIXED', 'Odpady zmieszane', 'municipal'),
  ('BIO', 'Bioodpady', 'municipal'),
  ('PAPER', 'Papier', 'municipal'),
  ('GLASS', 'Szkło', 'municipal'),
  ('METALS_PLASTICS', 'Metale i tworzywa sztuczne', 'municipal'),
  ('GREEN', 'Odpady zielone', 'municipal'),
  ('BULKY', 'Odpady wielkogabarytowe', 'municipal'),
  ('ASH', 'Popiół', 'municipal'),
  ('TEXTILES', 'Tekstylia', 'other'),
  ('OTHER', 'Inne', 'other')
ON CONFLICT DO NOTHING;


CREATE TABLE service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  external_key text,
  name text NOT NULL,
  building_type text CHECK (building_type IN ('SINGLE_FAMILY','MULTI_FAMILY','MIXED','OTHER') OR building_type IS NULL),
  active boolean NOT NULL DEFAULT true,
  valid_from date,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(municipality_id, external_key)
);


CREATE INDEX idx_service_areas_municipality ON service_areas(municipality_id);


CREATE TABLE service_area_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_area_id uuid NOT NULL REFERENCES service_areas(id) ON DELETE CASCADE,
  rule_type text NOT NULL CHECK (rule_type IN (
    'MUNICIPALITY',
    'LOCALITY',
    'STREET',
    'NUMBER_RANGE',
    'EXPLICIT_NUMBERS',
    'EXPLICIT_ADDRESS',
    'EXCLUDE'
  )),
  locality_id uuid REFERENCES localities(id),
  street_id uuid REFERENCES streets(id),
  number_from integer,
  number_to integer,
  parity text CHECK (parity IN ('ALL','ODD','EVEN') OR parity IS NULL),
  explicit_numbers jsonb,
  address_id uuid REFERENCES addresses(id),
  exclusion_payload jsonb,
  priority integer NOT NULL DEFAULT 100,
  source_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX idx_service_area_rules_area ON service_area_rules(service_area_id);
CREATE INDEX idx_service_area_rules_locality_street ON service_area_rules(locality_id, street_id);
CREATE INDEX idx_service_area_rules_priority ON service_area_rules(priority DESC);


CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid REFERENCES municipalities(id) ON DELETE SET NULL,
  owner_type text NOT NULL CHECK (owner_type IN (
    'MUNICIPALITY','MUNICIPAL_COMPANY','WASTE_OPERATOR','DEPOSIT_OPERATOR','OTHER_PUBLIC','OTHER'
  )),
  owner_name text,
  source_url text NOT NULL,
  source_format text NOT NULL CHECK (source_format IN (
    'API','JSON','CSV','XLSX','HTML','PDF_TEXT','PDF_SCAN','IMAGE','ICS','OTHER'
  )),
  reuse_basis text,
  reuse_terms jsonb,
  parser_key text,
  poll_interval_minutes integer NOT NULL DEFAULT 1440,
  etag text,
  last_modified text,
  last_sha256 text,
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_url)
);


CREATE INDEX idx_sources_municipality ON sources(municipality_id);
CREATE INDEX idx_sources_active_check ON sources(active, last_checked_at);


CREATE TABLE source_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  valid_from date,
  valid_to date,
  sha256 text NOT NULL,
  storage_uri text NOT NULL,
  parser_key text,
  parser_version text,
  extraction_confidence numeric(5,4) CHECK (extraction_confidence BETWEEN 0 AND 1),
  status text NOT NULL DEFAULT 'FETCHED' CHECK (status IN (
    'FETCHED','PARSED','NORMALIZED','PUBLISHED','REVIEW_REQUIRED','REJECTED'
  )),
  parse_report jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id, sha256)
);


CREATE INDEX idx_source_artifacts_source_time ON source_artifacts(source_id, retrieved_at DESC);
CREATE INDEX idx_source_artifacts_status ON source_artifacts(status);


CREATE TABLE collection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_area_id uuid NOT NULL REFERENCES service_areas(id) ON DELETE CASCADE,
  fraction_code text NOT NULL REFERENCES waste_fractions(code),
  collection_date date NOT NULL,
  status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','CHANGED','CANCELLED','COMPLETED')),
  note text,
  source_artifact_id uuid NOT NULL REFERENCES source_artifacts(id),
  verification_status text NOT NULL DEFAULT 'OFFICIAL_SOURCE' CHECK (verification_status IN (
    'VERIFIED','OFFICIAL_SOURCE','UNVERIFIED','REVIEW_REQUIRED'
  )),
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  fingerprint text NOT NULL,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE UNIQUE INDEX uq_collection_event_current
  ON collection_events(service_area_id, fraction_code, collection_date, fingerprint)
  WHERE valid_to IS NULL;
CREATE INDEX idx_collection_events_area_date ON collection_events(service_area_id, collection_date);
CREATE INDEX idx_collection_events_source ON collection_events(source_artifact_id);


CREATE TABLE facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid REFERENCES municipalities(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN (
    'PSZOK','DEPOSIT_RVM','DEPOSIT_MANUAL','ELECTRONICS','TEXTILES','BATTERIES','MEDICINES','OTHER'
  )),
  external_key text,
  name text NOT NULL,
  address_text text,
  address_id uuid REFERENCES addresses(id),
  geom geometry(Point, 4326) NOT NULL,
  opening_hours jsonb,
  rules_url text,
  operator_name text,
  active boolean NOT NULL DEFAULT true,
  verification_status text NOT NULL DEFAULT 'OFFICIAL_SOURCE' CHECK (verification_status IN (
    'VERIFIED','OFFICIAL_SOURCE','UNVERIFIED','REVIEW_REQUIRED'
  )),
  confidence numeric(5,4) NOT NULL DEFAULT 1 CHECK (confidence BETWEEN 0 AND 1),
  source_artifact_id uuid REFERENCES source_artifacts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX idx_facilities_geom ON facilities USING gist(geom);
CREATE INDEX idx_facilities_kind ON facilities(kind);
CREATE INDEX idx_facilities_municipality ON facilities(municipality_id);


CREATE TABLE facility_acceptance (
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  waste_code text NOT NULL,
  label_pl text NOT NULL,
  conditions jsonb,
  limits jsonb,
  PRIMARY KEY(facility_id, waste_code)
);


CREATE TABLE alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid REFERENCES municipalities(id) ON DELETE CASCADE,
  service_area_id uuid REFERENCES service_areas(id) ON DELETE CASCADE,
  source_artifact_id uuid REFERENCES source_artifacts(id),
  alert_type text NOT NULL CHECK (alert_type IN (
    'SCHEDULE_CHANGE','DELAY','CANCELLATION','FACILITY_CLOSURE','SERVICE_NOTICE','OTHER'
  )),
  title text NOT NULL,
  body text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX idx_alerts_active_time ON alerts(active, starts_at, ends_at);


CREATE TABLE data_change_log (
  id bigserial PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  change_type text NOT NULL CHECK (change_type IN ('CREATE','UPDATE','SUPERSEDE','DELETE','VERIFY','REJECT')),
  before_data jsonb,
  after_data jsonb,
  source_artifact_id uuid REFERENCES source_artifacts(id),
  actor_type text NOT NULL DEFAULT 'SYSTEM' CHECK (actor_type IN ('SYSTEM','REVIEWER','MUNICIPALITY','OPERATOR')),
  actor_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX idx_change_log_entity ON data_change_log(entity_type, entity_id, created_at DESC);


3. ALGORYTM WYBORU STREFY — ZAŁOŻENIE
Resolver strefy nie wybiera „pierwszej pasującej”. Wszystkie pasujące reguły są zbierane, następnie sortowane po priority i specyficzności:
EXPLICIT_ADDRESS > EXPLICIT_NUMBERS > NUMBER_RANGE > STREET > LOCALITY > MUNICIPALITY.
Reguły EXCLUDE odejmują adresy po zastosowaniu reguł dodatnich. Jeśli dwie różne strefy uzyskają równoważny najwyższy wynik, system zwraca SERVICE_AREA_AMBIGUOUS i kieruje przypadek do review queue.


4. WERSJONOWANIE HARMONOGRAMÓW
Nie nadpisujemy historycznych eventów. Przy publikacji nowej wersji:
1) pobieramy artifact i liczymy SHA-256,
2) parsujemy i normalizujemy,
3) porównujemy fingerprinty z aktualnym zestawem,
4) rekordy wycofane dostają valid_to,
5) nowe/zmienione rekordy dostają nowy source_artifact_id,
6) zapisujemy data_change_log,
7) publikacja automatyczna jest dozwolona tylko po przejściu reguł confidence.


5. PROGI JAKOŚCI — PoC
confidence >= 0.98 i brak konfliktu zakresu: kandydat do autopublish.
0.90–0.9799: publikacja tylko po automatycznych testach i zgodności count/fraction/date.
< 0.90: REVIEW_REQUIRED.
Każda zmiana typu service-area coverage: REVIEW_REQUIRED w pierwszej fazie pilota niezależnie od confidence.


6. DANE SUROWE
source_artifacts.storage_uri wskazuje obiekt immutable w object storage. Zalecana ścieżka:
raw/{municipality_terc}/{source_id}/{YYYY}/{MM}/{sha256}.{ext}
Surowego artifactu nie usuwamy przy zmianie harmonogramu; retencja w PoC minimum 24 miesiące albo do decyzji prawnej/produktowej.


7. INDEKSY DO DODANIA PO POMIARACH
Nie optymalizować przedwcześnie. Po zebraniu realnych danych rozważyć:
• pg_trgm dla wyszukiwania adresów,
• unaccent dla nazw miejscowości/ulic,
• partycjonowanie collection_events po roku dopiero przy realnej potrzebie,
• materialized view „next_collection_by_address” dopiero po profilowaniu.


8. MIGRACJE
Kanonicznym źródłem schematu ma być SQL w repozytorium, np. db/migrations/0001_init.sql. ORM/query builder nie może stać się jedyną reprezentacją modelu, ponieważ PostGIS i reguły wersjonowania są częścią domeny.
