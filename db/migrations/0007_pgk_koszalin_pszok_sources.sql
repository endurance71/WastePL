-- Sprint 02 / Issue #17: official PGK Koszalin PSZOK source registry entries.
-- These rows point only at official PGK pages. Raw bytes remain immutable source_artifacts.

INSERT INTO sources (
  municipality_id,
  owner_type,
  owner_name,
  source_url,
  source_format,
  parser_key,
  poll_interval_minutes,
  active
)
SELECT
  m.id,
  'MUNICIPAL_COMPANY',
  'Przedsiębiorstwo Gospodarki Komunalnej Sp. z o.o. w Koszalinie',
  'https://www.pgkkoszalin.pl/punkty-zbiorki-odpadow/punkt-zbiorki-odpadow-koszalin/',
  'HTML',
  'pgk-koszalin-pszok-html',
  1440,
  true
FROM municipalities m
WHERE m.terc = '3261011'
ON CONFLICT (source_url) DO UPDATE SET
  municipality_id = EXCLUDED.municipality_id,
  owner_type = EXCLUDED.owner_type,
  owner_name = EXCLUDED.owner_name,
  source_format = EXCLUDED.source_format,
  parser_key = EXCLUDED.parser_key,
  active = true;

INSERT INTO sources (
  municipality_id,
  owner_type,
  owner_name,
  source_url,
  source_format,
  parser_key,
  poll_interval_minutes,
  active
)
SELECT
  m.id,
  'MUNICIPAL_COMPANY',
  'Przedsiębiorstwo Gospodarki Komunalnej Sp. z o.o. w Koszalinie',
  'https://www.pgkkoszalin.pl/najczesciej-zadawane-pytania-f-a-q/',
  'HTML',
  'pgk-koszalin-pszok-html',
  1440,
  true
FROM municipalities m
WHERE m.terc = '3261011'
ON CONFLICT (source_url) DO UPDATE SET
  municipality_id = EXCLUDED.municipality_id,
  owner_type = EXCLUDED.owner_type,
  owner_name = EXCLUDED.owner_name,
  source_format = EXCLUDED.source_format,
  parser_key = EXCLUDED.parser_key,
  active = true;
