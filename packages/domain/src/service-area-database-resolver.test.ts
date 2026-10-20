import { describe, expect, it } from 'vitest';
import {
  DatabaseServiceAreaResolver,
  type ServiceAreaQueryExecutor,
} from './service-area-database-resolver.js';

interface FakeCall {
  sql: string;
  params: unknown[] | undefined;
}

class FakeExecutor implements ServiceAreaQueryExecutor {
  readonly calls: FakeCall[] = [];

  constructor(
    private readonly addressRows: unknown[],
    private readonly ruleRows: unknown[],
  ) {}

  async query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
    this.calls.push({ sql, params });
    if (sql.includes('FROM addresses a')) {
      return { rows: this.addressRows as T[] };
    }
    if (sql.includes('FROM service_areas sa')) {
      return { rows: this.ruleRows as T[] };
    }
    throw new Error(`Unexpected SQL in fake executor: ${sql}`);
  }
}

const ADDRESS = {
  id: 'addr-1',
  municipality_id: 'mun-1',
  locality_id: 'loc-1',
  street_id: null,
  building_number: '12A',
  canonical_text: 'Testowo 12A',
};

function localityRule() {
  return {
    area_id: 'area-1',
    municipality_id: 'mun-1',
    external_key: 'test-locality',
    area_name: 'Test locality',
    rule_id: 'rule-include',
    rule_type: 'LOCALITY',
    locality_id: 'loc-1',
    street_id: null,
    number_from: null,
    number_to: null,
    parity: null,
    explicit_numbers: null,
    address_id: null,
    exclusion_payload: null,
    priority: 100,
  };
}

describe('DatabaseServiceAreaResolver', () => {
  it('loads active address and date-valid rules before using domain resolution semantics', async () => {
    const database = new FakeExecutor([ADDRESS], [localityRule()]);
    const resolver = new DatabaseServiceAreaResolver(database);

    const result = await resolver.resolveByAddressId(
      'addr-1',
      new Date('2026-08-27T12:00:00Z'),
    );

    expect(result.status).toBe('MATCHED');
    if (result.status !== 'MATCHED') return;
    expect(result.serviceArea.externalKey).toBe('test-locality');
    expect(result.matchedBy.ruleType).toBe('LOCALITY');
    expect(result.matchedBy.priority).toBe(100);

    expect(database.calls).toHaveLength(2);
    expect(database.calls[0]?.params).toEqual(['addr-1']);
    expect(database.calls[1]?.params).toEqual(['mun-1', '2026-08-27']);
    expect(database.calls[1]?.sql).toContain('sa.active = true');
    expect(database.calls[1]?.sql).toContain('sa.valid_from');
    expect(database.calls[1]?.sql).toContain('sa.valid_to');
  });

  it('maps persisted EXCLUDE payloads through the same resolver path', async () => {
    const excluded = {
      ...localityRule(),
      rule_id: 'rule-exclude',
      rule_type: 'EXCLUDE',
      locality_id: null,
      exclusion_payload: {
        type: 'EXPLICIT_ADDRESS',
        addressId: 'addr-1',
      },
      priority: 200,
    };
    const database = new FakeExecutor([ADDRESS], [localityRule(), excluded]);
    const resolver = new DatabaseServiceAreaResolver(database);

    const result = await resolver.resolveByAddressId('addr-1');
    expect(result.status).toBe('NOT_FOUND');
  });

  it('returns ADDRESS_NOT_FOUND without loading service-area rules when the address is absent', async () => {
    const database = new FakeExecutor([], [localityRule()]);
    const resolver = new DatabaseServiceAreaResolver(database);

    await expect(
      resolver.resolveByAddressId('missing-address'),
    ).resolves.toEqual({
      status: 'ADDRESS_NOT_FOUND',
      addressId: 'missing-address',
    });
    expect(database.calls).toHaveLength(1);
  });

  it('fails visibly on malformed persisted EXCLUDE payloads instead of silently widening coverage', async () => {
    const malformed = {
      ...localityRule(),
      rule_id: 'rule-invalid-exclude',
      rule_type: 'EXCLUDE',
      locality_id: null,
      exclusion_payload: { type: 'UNKNOWN_SELECTOR' },
    };
    const database = new FakeExecutor([ADDRESS], [malformed]);
    const resolver = new DatabaseServiceAreaResolver(database);

    await expect(resolver.resolveByAddressId('addr-1')).rejects.toThrow(
      'EXCLUDE rule rule-invalid-exclude has an invalid exclusion_payload',
    );
  });
});
