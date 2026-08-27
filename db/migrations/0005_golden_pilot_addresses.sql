-- Golden pilot address expansion for Issue #6.
-- Koszalin addresses come from the official PGK BIO fixture excerpt.
-- Bonin building numbers were cross-checked against the public address list for SIMC 0308040.
-- PRG/ULIC identifiers remain NULL until an authoritative PRG/TERYT importer lands.

INSERT INTO streets (ulic, locality_id, name)
SELECT NULL, l.id, seed.name
FROM localities l
CROSS JOIN (VALUES
  ('4 Marca'),
  ('Adama Asnyka'),
  ('Aleja Armii Krajowej'),
  ('Aleja Monte Cassino'),
  ('Bałtycka'),
  ('Bogusława II'),
  ('Frezji')
) AS seed(name)
WHERE l.simc = '0949448'
  AND NOT EXISTS (
    SELECT 1
    FROM streets existing
    WHERE existing.locality_id = l.id
      AND existing.name = seed.name
  );

WITH seed(street_name, building_number, canonical_text) AS (
  VALUES
    ('4 Marca', '10', '4 Marca 10, Koszalin'),
    ('Adama Asnyka', '11', 'Adama Asnyka 11, Koszalin'),
    ('Adama Asnyka', '14', 'Adama Asnyka 14, Koszalin'),
    ('Aleja Armii Krajowej', '9', 'Aleja Armii Krajowej 9, Koszalin'),
    ('Aleja Monte Cassino', '14', 'Aleja Monte Cassino 14, Koszalin'),
    ('Bałtycka', '1', 'Bałtycka 1, Koszalin'),
    ('Bogusława II', '1-3', 'Bogusława II 1-3, Koszalin'),
    ('Frezji', '11', 'Frezji 11, Koszalin')
)
INSERT INTO addresses (
  prg_id, municipality_id, locality_id, street_id, building_number,
  postal_code, canonical_text
)
SELECT
  NULL,
  m.id,
  l.id,
  s.id,
  seed.building_number,
  NULL,
  seed.canonical_text
FROM seed
JOIN municipalities m ON m.terc = '3261011'
JOIN localities l ON l.municipality_id = m.id AND l.simc = '0949448'
JOIN streets s ON s.locality_id = l.id AND s.name = seed.street_name
WHERE NOT EXISTS (
  SELECT 1
  FROM addresses existing
  WHERE existing.municipality_id = m.id
    AND existing.canonical_text = seed.canonical_text
);

WITH seed(building_number) AS (
  VALUES
    ('2'), ('3A'), ('4'), ('5'), ('6'), ('7A'), ('7B'), ('7C'), ('8'), ('9'), ('10A'),
    ('11'), ('11C'), ('11D'), ('11E'), ('14'), ('16'), ('24A'), ('29'), ('44C'), ('48')
)
INSERT INTO addresses (
  prg_id, municipality_id, locality_id, street_id, building_number,
  postal_code, canonical_text
)
SELECT
  NULL,
  m.id,
  l.id,
  NULL,
  seed.building_number,
  '76-009',
  'Bonin ' || seed.building_number || ', 76-009 Bonin'
FROM seed
JOIN municipalities m ON m.terc = '3209042'
JOIN localities l ON l.municipality_id = m.id AND l.simc = '0308040'
WHERE NOT EXISTS (
  SELECT 1
  FROM addresses existing
  WHERE existing.municipality_id = m.id
    AND existing.locality_id = l.id
    AND upper(existing.building_number) = upper(seed.building_number)
);

INSERT INTO service_areas (municipality_id, external_key, name, building_type)
SELECT m.id, seed.external_key, seed.name, 'MULTI_FAMILY'
FROM municipalities m
CROSS JOIN (VALUES
  ('koszalin-bio-poniedziałek', 'Koszalin zabudowa wielorodzinna BIO - poniedziałek'),
  ('koszalin-bio-wtorek', 'Koszalin zabudowa wielorodzinna BIO - wtorek'),
  ('koszalin-bio-czwartek', 'Koszalin zabudowa wielorodzinna BIO - czwartek')
) AS seed(external_key, name)
WHERE m.terc = '3261011'
ON CONFLICT (municipality_id, external_key) DO UPDATE
SET name = EXCLUDED.name,
    building_type = EXCLUDED.building_type,
    active = true;

WITH seed(canonical_text, external_key) AS (
  VALUES
    ('4 Marca 10, Koszalin', 'koszalin-bio-środa'),
    ('Adama Asnyka 11, Koszalin', 'koszalin-bio-poniedziałek'),
    ('Adama Asnyka 14, Koszalin', 'koszalin-bio-poniedziałek'),
    ('Aleja Armii Krajowej 9, Koszalin', 'koszalin-bio-piątek'),
    ('Aleja Monte Cassino 14, Koszalin', 'koszalin-bio-wtorek'),
    ('Bałtycka 1, Koszalin', 'koszalin-bio-czwartek'),
    ('Bogusława II 1-3, Koszalin', 'koszalin-bio-poniedziałek'),
    ('Frezji 11, Koszalin', 'koszalin-bio-środa')
)
INSERT INTO service_area_rules (service_area_id, rule_type, address_id, priority)
SELECT sa.id, 'EXPLICIT_ADDRESS', a.id, 100
FROM seed
JOIN municipalities m ON m.terc = '3261011'
JOIN service_areas sa ON sa.municipality_id = m.id AND sa.external_key = seed.external_key
JOIN addresses a ON a.municipality_id = m.id AND a.canonical_text = seed.canonical_text
WHERE NOT EXISTS (
  SELECT 1
  FROM service_area_rules existing
  WHERE existing.service_area_id = sa.id
    AND existing.rule_type = 'EXPLICIT_ADDRESS'
    AND existing.address_id = a.id
);

-- Materialize weekly BIO events for the weekday service areas added above.
WITH weekdays(external_key, iso_dow) AS (
  VALUES
    ('koszalin-bio-poniedziałek', 1),
    ('koszalin-bio-wtorek', 2),
    ('koszalin-bio-czwartek', 4)
)
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
FROM weekdays w
JOIN municipalities m ON m.terc = '3261011'
JOIN service_areas sa ON sa.municipality_id = m.id AND sa.external_key = w.external_key
JOIN sources s ON s.source_url = 'https://www.pgkkoszalin.pl/wp-content/uploads/harmonogramy/2026/koszalin2/bio.pdf'
JOIN source_artifacts art
  ON art.source_id = s.id
 AND art.sha256 = '33deb436560d6df5ef7b8fc2834b5fd64b339261ed8d189e35610ceacfc029c5'
CROSS JOIN generate_series('2026-07-01'::date, '2026-12-31'::date, interval '1 day') AS d
WHERE EXTRACT(ISODOW FROM d) = w.iso_dow;
