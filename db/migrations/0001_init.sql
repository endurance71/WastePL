CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE municipalities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terc text NOT NULL UNIQUE,
  name text NOT NULL,
  municipality_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE localities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simc text NOT NULL UNIQUE,
  municipality_id uuid NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE streets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ulic text,
  locality_id uuid NOT NULL REFERENCES localities(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(locality_id, ulic)
);

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
CREATE INDEX idx_addresses_geom ON addresses USING gist(geom);
CREATE INDEX idx_addresses_lookup ON addresses(locality_id, street_id, building_number);

CREATE TABLE waste_fractions (
  code text PRIMARY KEY,
  name_pl text NOT NULL
);
INSERT INTO waste_fractions(code, name_pl) VALUES
('MIXED','Odpady zmieszane'),('BIO','Bioodpady'),('PAPER','Papier'),('GLASS','Szkło'),
('METALS_PLASTICS','Metale i tworzywa sztuczne'),('GREEN','Odpady zielone'),
('BULKY','Odpady wielkogabarytowe'),('ASH','Popiół'),('TEXTILES','Tekstylia'),('OTHER','Inne')
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
  UNIQUE(municipality_id, external_key)
);

CREATE TABLE service_area_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_area_id uuid NOT NULL REFERENCES service_areas(id) ON DELETE CASCADE,
  rule_type text NOT NULL CHECK (rule_type IN ('MUNICIPALITY','LOCALITY','STREET','NUMBER_RANGE','EXPLICIT_NUMBERS','EXPLICIT_ADDRESS','EXCLUDE')),
  locality_id uuid REFERENCES localities(id),
  street_id uuid REFERENCES streets(id),
  number_from integer,
  number_to integer,
  parity text CHECK (parity IN ('ALL','ODD','EVEN') OR parity IS NULL),
  explicit_numbers jsonb,
  address_id uuid REFERENCES addresses(id),
  exclusion_payload jsonb,
  priority integer NOT NULL DEFAULT 100
);
CREATE INDEX idx_service_area_rules_resolve ON service_area_rules(locality_id, street_id, priority DESC);

CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid REFERENCES municipalities(id) ON DELETE SET NULL,
  owner_type text NOT NULL,
  owner_name text,
  source_url text NOT NULL UNIQUE,
  source_format text NOT NULL,
  reuse_basis text,
  reuse_terms jsonb,
  parser_key text,
  poll_interval_minutes integer NOT NULL DEFAULT 1440,
  etag text,
  last_modified text,
  last_sha256 text,
  last_checked_at timestamptz,
  active boolean NOT NULL DEFAULT true
);

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
  status text NOT NULL DEFAULT 'FETCHED' CHECK (status IN ('FETCHED','PARSED','NORMALIZED','PUBLISHED','REVIEW_REQUIRED','REJECTED')),
  parse_report jsonb,
  UNIQUE(source_id, sha256)
);

CREATE TABLE collection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_area_id uuid NOT NULL REFERENCES service_areas(id) ON DELETE CASCADE,
  fraction_code text NOT NULL REFERENCES waste_fractions(code),
  collection_date date NOT NULL,
  status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','CHANGED','CANCELLED','COMPLETED')),
  note text,
  source_artifact_id uuid NOT NULL REFERENCES source_artifacts(id),
  verification_status text NOT NULL DEFAULT 'OFFICIAL_SOURCE',
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  fingerprint text NOT NULL,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_collection_events_area_date ON collection_events(service_area_id, collection_date);

CREATE TABLE facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid REFERENCES municipalities(id) ON DELETE SET NULL,
  kind text NOT NULL,
  external_key text,
  name text NOT NULL,
  address_text text,
  geom geometry(Point, 4326) NOT NULL,
  opening_hours jsonb,
  rules_url text,
  operator_name text,
  active boolean NOT NULL DEFAULT true,
  verification_status text NOT NULL DEFAULT 'OFFICIAL_SOURCE',
  confidence numeric(5,4) NOT NULL DEFAULT 1 CHECK (confidence BETWEEN 0 AND 1),
  source_artifact_id uuid REFERENCES source_artifacts(id)
);
CREATE INDEX idx_facilities_geom ON facilities USING gist(geom);
CREATE INDEX idx_facilities_kind ON facilities(kind);

CREATE TABLE data_change_log (
  id bigserial PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  change_type text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  source_artifact_id uuid REFERENCES source_artifacts(id),
  actor_type text NOT NULL DEFAULT 'SYSTEM',
  actor_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
