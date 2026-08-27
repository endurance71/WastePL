import {
  resolveServiceArea,
  type CanonicalAddressRef,
  type IncludeRuleType,
  type NumberParity,
  type ServiceAreaDefinition,
  type ServiceAreaResolution,
  type ServiceAreaRule,
  type ServiceAreaRuleSelector,
} from '@wastepl/domain';
import type { Pool, QueryResultRow } from 'pg';

const INCLUDE_RULE_TYPES = new Set<IncludeRuleType>([
  'EXPLICIT_ADDRESS',
  'EXPLICIT_NUMBERS',
  'NUMBER_RANGE',
  'STREET',
  'LOCALITY',
  'MUNICIPALITY',
]);

interface AddressRow extends QueryResultRow {
  id: string;
  municipality_id: string;
  locality_id: string;
  street_id: string | null;
  building_number: string;
  canonical_text: string;
}

interface RuleRow extends QueryResultRow {
  area_id: string;
  municipality_id: string;
  external_key: string | null;
  area_name: string;
  rule_id: string;
  rule_type: IncludeRuleType | 'EXCLUDE';
  locality_id: string | null;
  street_id: string | null;
  number_from: number | null;
  number_to: number | null;
  parity: NumberParity | null;
  explicit_numbers: unknown;
  address_id: string | null;
  exclusion_payload: unknown;
  priority: number;
}

export type AddressServiceAreaResolution =
  | ServiceAreaResolution
  | { status: 'ADDRESS_NOT_FOUND'; addressId: string };

function strings(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((item) => typeof item === 'string') ? value : null;
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(payload: Record<string, unknown>, camelCase: string, snakeCase: string): string | null {
  const value = payload[camelCase] ?? payload[snakeCase];
  return typeof value === 'string' ? value : null;
}

function numberField(payload: Record<string, unknown>, camelCase: string, snakeCase: string): number | null {
  const value = payload[camelCase] ?? payload[snakeCase];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parityField(value: unknown): NumberParity | null {
  return value === 'ALL' || value === 'ODD' || value === 'EVEN' ? value : null;
}

function includeSelector(row: RuleRow): ServiceAreaRuleSelector {
  if (row.rule_type === 'EXCLUDE') throw new Error('EXCLUDE rule cannot be mapped as an include selector');
  return {
    type: row.rule_type,
    localityId: row.locality_id,
    streetId: row.street_id,
    numberFrom: row.number_from,
    numberTo: row.number_to,
    parity: row.parity,
    explicitNumbers: strings(row.explicit_numbers),
    addressId: row.address_id,
  };
}

function exclusionSelector(payloadValue: unknown, ruleId: string): ServiceAreaRuleSelector {
  const payload = object(payloadValue);
  const type = payload?.type;
  if (!payload || typeof type !== 'string' || !INCLUDE_RULE_TYPES.has(type as IncludeRuleType)) {
    throw new Error(`EXCLUDE rule ${ruleId} has an invalid exclusion_payload`);
  }
  const explicitNumbersValue = payload.explicitNumbers ?? payload.explicit_numbers;
  return {
    type: type as IncludeRuleType,
    localityId: stringField(payload, 'localityId', 'locality_id'),
    streetId: stringField(payload, 'streetId', 'street_id'),
    numberFrom: numberField(payload, 'numberFrom', 'number_from'),
    numberTo: numberField(payload, 'numberTo', 'number_to'),
    parity: parityField(payload.parity),
    explicitNumbers: strings(explicitNumbersValue),
    addressId: stringField(payload, 'addressId', 'address_id'),
  };
}

function mapRule(row: RuleRow): ServiceAreaRule {
  return {
    id: row.rule_id,
    serviceAreaId: row.area_id,
    kind: row.rule_type === 'EXCLUDE' ? 'EXCLUDE' : 'INCLUDE',
    priority: row.priority,
    selector: row.rule_type === 'EXCLUDE'
      ? exclusionSelector(row.exclusion_payload, row.rule_id)
      : includeSelector(row),
  };
}

function mapAddress(row: AddressRow): CanonicalAddressRef {
  return {
    id: row.id,
    municipalityId: row.municipality_id,
    localityId: row.locality_id,
    streetId: row.street_id,
    buildingNumber: row.building_number,
    canonicalText: row.canonical_text,
  };
}

export class PgServiceAreaResolver {
  constructor(private readonly pool: Pool) {}

  async resolveByAddressId(addressId: string, onDate = new Date()): Promise<AddressServiceAreaResolution> {
    const addressResult = await this.pool.query<AddressRow>(
      `SELECT a.id, a.municipality_id, a.locality_id, a.street_id, a.building_number, a.canonical_text
       FROM addresses a
       JOIN municipalities m ON m.id = a.municipality_id
       WHERE a.id = $1 AND a.active = true AND m.active = true`,
      [addressId],
    );
    const addressRow = addressResult.rows[0];
    if (!addressRow) return { status: 'ADDRESS_NOT_FOUND', addressId };

    const address = mapAddress(addressRow);
    const date = onDate.toISOString().slice(0, 10);
    const rulesResult = await this.pool.query<RuleRow>(
      `SELECT
         sa.id AS area_id, sa.municipality_id, sa.external_key, sa.name AS area_name,
         r.id AS rule_id, r.rule_type, r.locality_id, r.street_id, r.number_from,
         r.number_to, r.parity, r.explicit_numbers, r.address_id, r.exclusion_payload, r.priority
       FROM service_areas sa
       JOIN service_area_rules r ON r.service_area_id = sa.id
       WHERE sa.municipality_id = $1
         AND sa.active = true
         AND (sa.valid_from IS NULL OR sa.valid_from <= $2::date)
         AND (sa.valid_to IS NULL OR sa.valid_to >= $2::date)
       ORDER BY sa.id, r.id`,
      [address.municipalityId, date],
    );

    const byArea = new Map<string, ServiceAreaDefinition>();
    for (const row of rulesResult.rows) {
      const existing = byArea.get(row.area_id);
      const mappedRule = mapRule(row);
      if (existing) {
        existing.rules = [...existing.rules, mappedRule];
      } else {
        byArea.set(row.area_id, {
          id: row.area_id,
          municipalityId: row.municipality_id,
          externalKey: row.external_key,
          name: row.area_name,
          rules: [mappedRule],
        });
      }
    }
    return resolveServiceArea(address, [...byArea.values()]);
  }
}
