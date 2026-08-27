-- Pilot reference slice for Issue #4.
-- TERC/SIMC identifiers are sourced from GUS TERYT/BDL.
-- PRG IDs are intentionally left NULL until an authoritative PRG import is implemented;
-- WastePL must never fabricate official address identifiers.

INSERT INTO municipalities (terc, name, municipality_type)
VALUES
  ('3261011', 'Koszalin', 'DISTRICT_CITY'),
  ('3209042', 'Manowo', 'RURAL')
ON CONFLICT (terc) DO UPDATE
SET name = EXCLUDED.name,
    municipality_type = EXCLUDED.municipality_type;

INSERT INTO localities (simc, municipality_id, name)
SELECT '0949448', m.id, 'Koszalin'
FROM municipalities m
WHERE m.terc = '3261011'
ON CONFLICT (simc) DO UPDATE
SET municipality_id = EXCLUDED.municipality_id,
    name = EXCLUDED.name;

INSERT INTO localities (simc, municipality_id, name)
SELECT seed.simc, m.id, seed.name
FROM municipalities m
CROSS JOIN (VALUES
  ('0308040', 'Bonin'),
  ('0308152', 'Manowo'),
  ('0308206', 'Wyszebórz')
) AS seed(simc, name)
WHERE m.terc = '3209042'
ON CONFLICT (simc) DO UPDATE
SET municipality_id = EXCLUDED.municipality_id,
    name = EXCLUDED.name;

-- The ULIC identifier is intentionally NULL in this minimal slice until it is imported
-- from the authoritative TERYT ULIC/PRG feed. The street entity itself is needed by
-- the resolver because the official Koszalin fixture addresses are street-based.
INSERT INTO streets (ulic, locality_id, name)
SELECT NULL, l.id, '1 Maja'
FROM localities l
WHERE l.simc = '0949448';

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
  '75-800',
  seed.canonical_text
FROM municipalities m
JOIN localities l ON l.municipality_id = m.id AND l.simc = '0949448'
JOIN streets s ON s.locality_id = l.id AND s.name = '1 Maja'
CROSS JOIN (VALUES
  ('3', '1 Maja 3, 75-800 Koszalin'),
  ('8', '1 Maja 8, 75-800 Koszalin')
) AS seed(building_number, canonical_text)
WHERE m.terc = '3261011';

INSERT INTO addresses (
  prg_id, municipality_id, locality_id, street_id, building_number,
  postal_code, canonical_text
)
SELECT
  NULL,
  m.id,
  l.id,
  NULL,
  '2',
  '76-009',
  'Bonin 2, 76-009 Bonin'
FROM municipalities m
JOIN localities l ON l.municipality_id = m.id AND l.simc = '0308040'
WHERE m.terc = '3209042';

INSERT INTO service_areas (municipality_id, external_key, name, building_type)
SELECT m.id, seed.external_key, seed.name, seed.building_type
FROM municipalities m
CROSS JOIN (VALUES
  ('koszalin-bio-środa', 'Koszalin zabudowa wielorodzinna BIO - środa', 'MULTI_FAMILY'),
  ('koszalin-bio-piątek', 'Koszalin zabudowa wielorodzinna BIO - piątek', 'MULTI_FAMILY')
) AS seed(external_key, name, building_type)
WHERE m.terc = '3261011'
ON CONFLICT (municipality_id, external_key) DO UPDATE
SET name = EXCLUDED.name,
    building_type = EXCLUDED.building_type,
    active = true;

INSERT INTO service_areas (municipality_id, external_key, name, building_type)
SELECT
  m.id,
  'manowo-bonin-deborogi-policko-wyszeborz',
  'Gmina Manowo: Bonin, Dęborogi, Policko, Wyszebórz',
  NULL
FROM municipalities m
WHERE m.terc = '3209042'
ON CONFLICT (municipality_id, external_key) DO UPDATE
SET name = EXCLUDED.name,
    active = true;

INSERT INTO service_area_rules (
  service_area_id, rule_type, address_id, priority
)
SELECT sa.id, 'EXPLICIT_ADDRESS', a.id, 100
FROM service_areas sa
JOIN municipalities m ON m.id = sa.municipality_id AND m.terc = '3261011'
JOIN addresses a ON a.municipality_id = m.id
WHERE
  (sa.external_key = 'koszalin-bio-środa' AND a.canonical_text = '1 Maja 3, 75-800 Koszalin')
  OR
  (sa.external_key = 'koszalin-bio-piątek' AND a.canonical_text = '1 Maja 8, 75-800 Koszalin');

INSERT INTO service_area_rules (
  service_area_id, rule_type, locality_id, priority
)
SELECT sa.id, 'LOCALITY', l.id, 100
FROM service_areas sa
JOIN municipalities m ON m.id = sa.municipality_id AND m.terc = '3209042'
JOIN localities l ON l.municipality_id = m.id AND l.simc IN ('0308040', '0308206')
WHERE sa.external_key = 'manowo-bonin-deborogi-policko-wyszeborz';
