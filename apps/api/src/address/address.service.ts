import { Inject, Injectable } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';

interface AddressCandidateRow extends QueryResultRow {
  id: string;
  prg_id: string | null;
  canonical_text: string;
  municipality_id: string;
  terc: string;
  municipality_name: string;
  score: string | number;
}

export interface ApiMunicipality {
  id: string;
  terc: string;
  name: string;
}

export interface ApiAddress {
  id: string;
  prgId: string | null;
  canonicalText: string;
  municipality: ApiMunicipality;
}

export interface AddressCandidate {
  address: ApiAddress;
  score: number;
}

export interface AddressResolveResponse {
  query: string;
  items: AddressCandidate[];
}

function escapeLike(value: string): string {
  return value.replace(/[!%_]/g, (character) => `!${character}`);
}

function mapAddress(row: AddressCandidateRow): ApiAddress {
  return {
    id: row.id,
    prgId: row.prg_id,
    canonicalText: row.canonical_text,
    municipality: {
      id: row.municipality_id,
      terc: row.terc,
      name: row.municipality_name,
    },
  };
}

@Injectable()
export class AddressService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async search(rawQuery: string, limit = 20): Promise<AddressResolveResponse> {
    const query = rawQuery.trim();
    const escaped = escapeLike(query);
    const prefix = `${escaped}%`;
    const contains = `%${escaped}%`;

    const result = await this.database.pool.query<AddressCandidateRow>(
      `SELECT
         a.id,
         a.prg_id,
         a.canonical_text,
         m.id AS municipality_id,
         m.terc,
         m.name AS municipality_name,
         CASE
           WHEN lower(a.canonical_text) = lower($1) THEN 1.0
           WHEN a.canonical_text ILIKE $2 ESCAPE '!' THEN 0.9
           ELSE 0.75
         END AS score
       FROM addresses a
       JOIN municipalities m ON m.id = a.municipality_id
       WHERE a.canonical_text ILIKE $3 ESCAPE '!'
       ORDER BY score DESC, length(a.canonical_text), a.canonical_text, a.id
       LIMIT $4`,
      [query, prefix, contains, limit],
    );

    return {
      query,
      items: result.rows.map((row) => ({
        address: mapAddress(row),
        score: Number(row.score),
      })),
    };
  }

  async getById(addressId: string): Promise<ApiAddress | null> {
    const result = await this.database.pool.query<AddressCandidateRow>(
      `SELECT
         a.id,
         a.prg_id,
         a.canonical_text,
         m.id AS municipality_id,
         m.terc,
         m.name AS municipality_name,
         1.0 AS score
       FROM addresses a
       JOIN municipalities m ON m.id = a.municipality_id
       WHERE a.id = $1`,
      [addressId],
    );
    const row = result.rows[0];
    return row ? mapAddress(row) : null;
  }
}
