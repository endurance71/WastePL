import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { PgServiceAreaResolver } from './pg-service-area-resolver.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const integrationIt = databaseUrl ? it : it.skip;

describe('PgServiceAreaResolver integration', () => {
  integrationIt('resolves golden Koszalin and Manowo pilot addresses deterministically', async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const resolver = new PgServiceAreaResolver(pool);

    const golden = [
      {
        canonicalText: '1 Maja 3, 75-800 Koszalin',
        expectedServiceArea: 'koszalin-bio-środa',
        expectedRuleType: 'EXPLICIT_ADDRESS',
      },
      {
        canonicalText: '1 Maja 8, 75-800 Koszalin',
        expectedServiceArea: 'koszalin-bio-piątek',
        expectedRuleType: 'EXPLICIT_ADDRESS',
      },
      {
        canonicalText: 'Bonin 2, 76-009 Bonin',
        expectedServiceArea: 'manowo-bonin-deborogi-policko-wyszeborz',
        expectedRuleType: 'LOCALITY',
      },
    ] as const;

    try {
      for (const fixture of golden) {
        const addressResult = await pool.query<{ id: string }>(
          'SELECT id FROM addresses WHERE canonical_text = $1 ORDER BY id LIMIT 1',
          [fixture.canonicalText],
        );
        const addressId = addressResult.rows[0]?.id;
        if (!addressId) throw new Error(`Pilot address missing: ${fixture.canonicalText}`);

        const result = await resolver.resolveByAddressId(
          addressId,
          new Date('2026-08-27T12:00:00Z'),
        );

        expect(result.status).toBe('MATCHED');
        if (result.status !== 'MATCHED') continue;
        expect(result.serviceArea.externalKey).toBe(fixture.expectedServiceArea);
        expect(result.matchedBy.ruleType).toBe(fixture.expectedRuleType);
        expect(result.matchedBy.ruleId).toBeTruthy();
        expect(result.matchedBy.specificity).toBeGreaterThan(0);
      }
    } finally {
      await pool.end();
    }
  });

  integrationIt('returns ADDRESS_NOT_FOUND for an unknown canonical address id', async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const resolver = new PgServiceAreaResolver(pool);
      await expect(
        resolver.resolveByAddressId('00000000-0000-4000-8000-000000000000'),
      ).resolves.toEqual({
        status: 'ADDRESS_NOT_FOUND',
        addressId: '00000000-0000-4000-8000-000000000000',
      });
    } finally {
      await pool.end();
    }
  });
});
