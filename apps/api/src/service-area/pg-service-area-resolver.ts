import {
  DatabaseServiceAreaResolver,
  type AddressServiceAreaResolution,
  type ServiceAreaQueryExecutor,
} from '@wastepl/domain';
import type { Pool } from 'pg';

export type { AddressServiceAreaResolution } from '@wastepl/domain';

function poolExecutor(pool: Pool): ServiceAreaQueryExecutor {
  return {
    async query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
      const result = await pool.query(sql, params);
      return { rows: result.rows as T[] };
    },
  };
}

/**
 * API compatibility wrapper around the shared persistence-backed resolver.
 * The shared implementation is also intended for full-population Census audits,
 * ensuring resident runtime and audit semantics cannot drift independently.
 */
export class PgServiceAreaResolver {
  private readonly resolver: DatabaseServiceAreaResolver;

  constructor(pool: Pool) {
    this.resolver = new DatabaseServiceAreaResolver(poolExecutor(pool));
  }

  resolveByAddressId(
    addressId: string,
    onDate = new Date(),
  ): Promise<AddressServiceAreaResolution> {
    return this.resolver.resolveByAddressId(addressId, onDate);
  }
}
