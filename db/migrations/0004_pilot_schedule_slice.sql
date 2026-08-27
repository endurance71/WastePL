-- Materialized pilot schedule slice for the first consumer API vertical.
-- Events mirror the deterministic PDF_TEXT regression fixtures from Issue #3.
-- Artifact parse_report marks these as fixture-derived so they cannot be confused with
-- a production fetch of the complete upstream PDF.

INSERT INTO sources (
  municipality_id, owner_type, owner_name, source_url, source_format,
  reuse_basis, parser_key, last_sha256, last_checked_at, active
)
SELECT
  m.id,
  'MUNICIPAL_COMPANY',
  'Przedsiębiorstwo Gospodarki Komunalnej Sp. z o.o. w Koszalinie',
  'https://www.pgkkoszalin.pl/wp-content/uploads/harmonogramy/2026/koszalin2/bio.pdf',
  'PDF_TEXT',
  'Pilot fixture excerpt; upstream public document URL retained for provenance',
  'pgk-koszalin-pdf-text',
  '33deb436560d6df5ef7b8fc2834b5fd64b339261ed8d189e35610ceacfc029c5',
  '2026-08-27T15:00:00Z'::timestamptz,
  true
FROM municipalities m
WHERE m.terc = '3261011'
ON CONFLICT (source_url) DO UPDATE
SET municipality_id = EXCLUDED.municipality_id,
    owner_name = EXCLUDED.owner_name,
    source_format = EXCLUDED.source_format,
    parser_key = EXCLUDED.parser_key,
    last_sha256 = EXCLUDED.last_sha256,
    last_checked_at = EXCLUDED.last_checked_at,
    active = true;

INSERT INTO sources (
  municipality_id, owner_type, owner_name, source_url, source_format,
  reuse_basis, parser_key, last_sha256, last_checked_at, active
)
SELECT
  m.id,
  'MUNICIPAL_COMPANY',
  'Przedsiębiorstwo Gospodarki Komunalnej Sp. z o.o. w Koszalinie',
  'https://www.pgkkoszalin.pl/wp-content/uploads/harmonogramy/2026/manowo/2AB.pdf',
  'PDF_TEXT',
  'Pilot fixture excerpt; upstream public document URL retained for provenance',
  'pgk-koszalin-pdf-text',
  '7d12baebbd6e2342b0426c11e4d7c6aa6f03811a8e1b44494b862d86fcb357f1',
  '2026-08-27T15:00:00Z'::timestamptz,
  true
FROM municipalities m
WHERE m.terc = '3209042'
ON CONFLICT (source_url) DO UPDATE
SET municipality_id = EXCLUDED.municipality_id,
    owner_name = EXCLUDED.owner_name,
    source_format = EXCLUDED.source_format,
    parser_key = EXCLUDED.parser_key,
    last_sha256 = EXCLUDED.last_sha256,
    last_checked_at = EXCLUDED.last_checked_at,
    active = true;

INSERT INTO source_artifacts (
  source_id, retrieved_at, valid_from, valid_to, sha256, storage_uri,
  parser_key, parser_version, extraction_confidence, status, parse_report
)
SELECT
  s.id,
  '2026-08-27T15:00:00Z'::timestamptz,
  '2026-07-01'::date,
  '2026-12-31'::date,
  '33deb436560d6df5ef7b8fc2834b5fd64b339261ed8d189e35610ceacfc029c5',
  'fixture://apps/worker/test/fixtures/pdf-text/koszalin-bio-2026.txt',
  'pgk-koszalin-pdf-text',
  '0.1.0',
  0.995,
  'PUBLISHED',
  '{"fixtureDerived":true,"fixture":"koszalin-bio-2026.txt","note":"Pilot excerpt used for deterministic API vertical; not the raw upstream PDF"}'::jsonb
FROM sources s
WHERE s.source_url = 'https://www.pgkkoszalin.pl/wp-content/uploads/harmonogramy/2026/koszalin2/bio.pdf'
ON CONFLICT (source_id, sha256) DO NOTHING;

INSERT INTO source_artifacts (
  source_id, retrieved_at, valid_from, valid_to, sha256, storage_uri,
  parser_key, parser_version, extraction_confidence, status, parse_report
)
SELECT
  s.id,
  '2026-08-27T15:00:00Z'::timestamptz,
  '2026-01-01'::date,
  '2026-06-30'::date,
  '7d12baebbd6e2342b0426c11e4d7c6aa6f03811a8e1b44494b862d86fcb357f1',
  'fixture://apps/worker/test/fixtures/pdf-text/manowo-2ab-2026.txt',
  'pgk-koszalin-pdf-text',
  '0.1.0',
  0.990,
  'PUBLISHED',
  '{"fixtureDerived":true,"fixture":"manowo-2ab-2026.txt","note":"Pilot excerpt used for deterministic API vertical; not the raw upstream PDF"}'::jsonb
FROM sources s
WHERE s.source_url = 'https://www.pgkkoszalin.pl/wp-content/uploads/harmonogramy/2026/manowo/2AB.pdf'
ON CONFLICT (source_id, sha256) DO NOTHING;

-- Koszalin BIO: Wednesday and Friday service areas over the fixture validity range.
INSERT INTO collection_events (
  service_area_id, fraction_code, collection_date, status, note,
  source_artifact_id, verification_status, confidence, fingerprint
)
SELECT
  sa.id,
  'BIO',
  d::date,
  'SCHEDULED',
  NULL,
  art.id,
  'OFFICIAL_SOURCE',
  0.995,
  encode(digest(sa.id::text || '|BIO|' || d::date::text || '|' || art.id::text, 'sha256'), 'hex')
FROM service_areas sa
JOIN municipalities m ON m.id = sa.municipality_id AND m.terc = '3261011'
JOIN sources s ON s.source_url = 'https://www.pgkkoszalin.pl/wp-content/uploads/harmonogramy/2026/koszalin2/bio.pdf'
JOIN source_artifacts art
  ON art.source_id = s.id
 AND art.sha256 = '33deb436560d6df5ef7b8fc2834b5fd64b339261ed8d189e35610ceacfc029c5'
CROSS JOIN generate_series('2026-07-01'::date, '2026-12-31'::date, interval '1 day') AS d
WHERE
  (sa.external_key = 'koszalin-bio-środa' AND EXTRACT(ISODOW FROM d) = 3)
  OR
  (sa.external_key = 'koszalin-bio-piątek' AND EXTRACT(ISODOW FROM d) = 5);

-- Manowo fixture: mixed dates.
WITH mixed(collection_date) AS (
  VALUES
    ('2026-01-13'::date), ('2026-01-27'::date),
    ('2026-02-10'::date), ('2026-02-24'::date),
    ('2026-03-10'::date), ('2026-03-24'::date),
    ('2026-04-08'::date), ('2026-04-21'::date),
    ('2026-05-05'::date), ('2026-05-19'::date),
    ('2026-06-02'::date), ('2026-06-16'::date), ('2026-06-30'::date)
)
INSERT INTO collection_events (
  service_area_id, fraction_code, collection_date, status, note,
  source_artifact_id, verification_status, confidence, fingerprint
)
SELECT
  sa.id,
  'MIXED',
  mixed.collection_date,
  'SCHEDULED',
  NULL,
  art.id,
  'OFFICIAL_SOURCE',
  0.990,
  encode(digest(sa.id::text || '|MIXED|' || mixed.collection_date::text || '|' || art.id::text, 'sha256'), 'hex')
FROM mixed
JOIN service_areas sa ON sa.external_key = 'manowo-bonin-deborogi-policko-wyszeborz'
JOIN municipalities m ON m.id = sa.municipality_id AND m.terc = '3209042'
JOIN sources s ON s.source_url = 'https://www.pgkkoszalin.pl/wp-content/uploads/harmonogramy/2026/manowo/2AB.pdf'
JOIN source_artifacts art
  ON art.source_id = s.id
 AND art.sha256 = '7d12baebbd6e2342b0426c11e4d7c6aa6f03811a8e1b44494b862d86fcb357f1';

-- Manowo fixture: every segregated date expands to the four canonical fractions
-- explicitly listed by the source: plastic/metals, glass, paper and biodegradable.
WITH segregated(collection_date) AS (
  VALUES
    ('2026-01-07'::date), ('2026-01-20'::date),
    ('2026-02-03'::date), ('2026-02-17'::date),
    ('2026-03-03'::date), ('2026-03-17'::date), ('2026-03-31'::date),
    ('2026-04-14'::date), ('2026-04-28'::date),
    ('2026-05-12'::date), ('2026-05-26'::date),
    ('2026-06-09'::date), ('2026-06-23'::date)
), fractions(fraction_code) AS (
  VALUES ('METALS_PLASTICS'), ('GLASS'), ('PAPER'), ('BIO')
)
INSERT INTO collection_events (
  service_area_id, fraction_code, collection_date, status, note,
  source_artifact_id, verification_status, confidence, fingerprint
)
SELECT
  sa.id,
  fractions.fraction_code,
  segregated.collection_date,
  'SCHEDULED',
  NULL,
  art.id,
  'OFFICIAL_SOURCE',
  0.990,
  encode(digest(sa.id::text || '|' || fractions.fraction_code || '|' || segregated.collection_date::text || '|' || art.id::text, 'sha256'), 'hex')
FROM segregated
CROSS JOIN fractions
JOIN service_areas sa ON sa.external_key = 'manowo-bonin-deborogi-policko-wyszeborz'
JOIN municipalities m ON m.id = sa.municipality_id AND m.terc = '3209042'
JOIN sources s ON s.source_url = 'https://www.pgkkoszalin.pl/wp-content/uploads/harmonogramy/2026/manowo/2AB.pdf'
JOIN source_artifacts art
  ON art.source_id = s.id
 AND art.sha256 = '7d12baebbd6e2342b0426c11e4d7c6aa6f03811a8e1b44494b862d86fcb357f1';

INSERT INTO collection_events (
  service_area_id, fraction_code, collection_date, status, note,
  source_artifact_id, verification_status, confidence, fingerprint
)
SELECT
  sa.id,
  'BULKY',
  '2026-05-30'::date,
  'SCHEDULED',
  NULL,
  art.id,
  'OFFICIAL_SOURCE',
  0.990,
  encode(digest(sa.id::text || '|BULKY|2026-05-30|' || art.id::text, 'sha256'), 'hex')
FROM service_areas sa
JOIN municipalities m ON m.id = sa.municipality_id AND m.terc = '3209042'
JOIN sources s ON s.source_url = 'https://www.pgkkoszalin.pl/wp-content/uploads/harmonogramy/2026/manowo/2AB.pdf'
JOIN source_artifacts art
  ON art.source_id = s.id
 AND art.sha256 = '7d12baebbd6e2342b0426c11e4d7c6aa6f03811a8e1b44494b862d86fcb357f1'
WHERE sa.external_key = 'manowo-bonin-deborogi-policko-wyszeborz';
