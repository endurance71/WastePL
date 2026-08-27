import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { AddressService, type ApiAddress, type ApiMunicipality } from '../address/address.service.js';
import { DatabaseService } from '../database/database.service.js';
import { PgServiceAreaResolver } from '../service-area/pg-service-area-resolver.js';

interface EventRow extends QueryResultRow {
  collection_date: string;
  fraction_code: string;
  status: 'SCHEDULED' | 'CHANGED' | 'CANCELLED' | 'COMPLETED';
}

interface ProvenanceRow extends QueryResultRow {
  source_url: string;
  source_format: string;
  verification_status: 'VERIFIED' | 'OFFICIAL_SOURCE' | 'UNVERIFIED' | 'REVIEW_REQUIRED';
  confidence: string | number;
  retrieved_at: Date;
}

export interface CollectionScheduleResponse {
  address: ApiAddress;
  municipality: ApiMunicipality;
  serviceArea: {
    id: string;
    name: string;
  };
  events: Array<{
    date: string;
    fraction: string;
    status: 'SCHEDULED' | 'CHANGED' | 'CANCELLED' | 'COMPLETED';
  }>;
  source: {
    url: string;
    format: string;
  };
  quality: {
    verificationStatus: 'VERIFIED' | 'OFFICIAL_SOURCE' | 'UNVERIFIED' | 'REVIEW_REQUIRED';
    confidence: number;
    retrievedAt: string;
    warnings: string[];
  };
}

export interface CollectionScheduleQuery {
  addressId: string | null;
  address: string | null;
  from: string;
  days: number;
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) throw new Error(`Invalid ISO date ${isoDate}`);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateAtNoonUtc(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`);
}

@Injectable()
export class CollectionService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AddressService) private readonly addresses: AddressService,
  ) {}

  private async resolveInputAddress(query: CollectionScheduleQuery): Promise<ApiAddress> {
    if (query.addressId) {
      const byId = await this.addresses.getById(query.addressId);
      if (!byId) {
        throw new NotFoundException({
          code: 'ADDRESS_NOT_FOUND',
          message: 'Canonical address was not found',
        });
      }
      return byId;
    }

    const text = query.address?.trim() ?? '';
    const result = await this.addresses.search(text);
    if (result.items.length === 0) {
      throw new NotFoundException({
        code: 'ADDRESS_NOT_FOUND',
        message: 'Address query did not match a canonical address',
      });
    }

    const exact = result.items.filter((candidate) => candidate.score === 1);
    if (exact.length === 1 && exact[0]) return exact[0].address;
    if (result.items.length === 1 && result.items[0]) return result.items[0].address;

    throw new ConflictException({
      code: 'AMBIGUOUS_ADDRESS',
      message: 'Address query matched multiple canonical addresses',
      candidates: result.items.slice(0, 10),
    });
  }

  async getSchedule(query: CollectionScheduleQuery): Promise<CollectionScheduleResponse> {
    const address = await this.resolveInputAddress(query);
    const resolver = new PgServiceAreaResolver(this.database.pool);
    const resolution = await resolver.resolveByAddressId(address.id, dateAtNoonUtc(query.from));

    if (resolution.status === 'ADDRESS_NOT_FOUND' || resolution.status === 'NOT_FOUND') {
      throw new NotFoundException({
        code: 'SERVICE_AREA_NOT_FOUND',
        message: 'No waste collection service area applies to this address',
      });
    }

    if (resolution.status === 'AMBIGUOUS') {
      throw new ConflictException({
        code: 'AMBIGUOUS_SERVICE_AREA',
        message: 'Multiple equally ranked service areas apply to this address',
        candidates: resolution.candidates,
      });
    }

    const until = addDays(query.from, query.days);
    const eventResult = await this.database.pool.query<EventRow>(
      `SELECT
         to_char(collection_date, 'YYYY-MM-DD') AS collection_date,
         fraction_code,
         status
       FROM collection_events
       WHERE service_area_id = $1
         AND collection_date >= $2::date
         AND collection_date < $3::date
       ORDER BY collection_date, fraction_code, id`,
      [resolution.serviceArea.id, query.from, until],
    );

    const provenanceResult = await this.database.pool.query<ProvenanceRow>(
      `SELECT
         s.source_url,
         s.source_format,
         ce.verification_status,
         ce.confidence,
         art.retrieved_at
       FROM collection_events ce
       JOIN source_artifacts art ON art.id = ce.source_artifact_id
       JOIN sources s ON s.id = art.source_id
       WHERE ce.service_area_id = $1
       ORDER BY art.retrieved_at DESC, ce.collection_date DESC, ce.id
       LIMIT 1`,
      [resolution.serviceArea.id],
    );
    const provenance = provenanceResult.rows[0];
    if (!provenance) {
      throw new NotFoundException({
        code: 'SCHEDULE_NOT_PUBLISHED',
        message: 'Service area exists but no published collection schedule is available',
      });
    }

    const warnings: string[] = [];
    if (eventResult.rows.length === 0) warnings.push('NO_EVENTS_IN_REQUESTED_WINDOW');

    return {
      address,
      municipality: address.municipality,
      serviceArea: {
        id: resolution.serviceArea.id,
        name: resolution.serviceArea.name,
      },
      events: eventResult.rows.map((row) => ({
        date: row.collection_date,
        fraction: row.fraction_code,
        status: row.status,
      })),
      source: {
        url: provenance.source_url,
        format: provenance.source_format,
      },
      quality: {
        verificationStatus: provenance.verification_status,
        confidence: Number(provenance.confidence),
        retrievedAt: provenance.retrieved_at.toISOString(),
        warnings,
      },
    };
  }
}
