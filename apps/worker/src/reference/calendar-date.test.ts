import { afterEach, describe, expect, it } from 'vitest';
import { databaseCalendarDate } from './pg-reference-importer.js';

const originalTz = process.env.TZ;

afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe('databaseCalendarDate', () => {
  it.each(['Europe/Warsaw', 'America/Los_Angeles', 'Pacific/Auckland'])(
    'preserves a PostgreSQL-style local calendar date in %s',
    (timezone) => {
      process.env.TZ = timezone;
      const databaseDate = new Date(2026, 7, 28, 0, 0, 0, 0);
      expect(databaseCalendarDate(databaseDate)).toBe('2026-08-28');
    },
  );

  it('does not reinterpret textual SQL dates as instants', () => {
    process.env.TZ = 'Europe/Warsaw';
    expect(databaseCalendarDate('2026-08-28')).toBe('2026-08-28');
    expect(databaseCalendarDate(null)).toBeNull();
  });
});
