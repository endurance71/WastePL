import { BadRequestException, Controller, Get, Headers, Inject, Query } from '@nestjs/common';
import { internalInteger, requireInternalAdmin } from '../internal-auth.js';
import {
  InternalSourceOpsService,
  type SourceDataType,
  type SourceHealthStatus,
  type SourceManifestStatus,
} from './internal-source-ops.service.js';

const DATA_TYPES = new Set<SourceDataType>(['COLLECTION_SCHEDULE', 'PSZOK', 'ALERTS', 'OTHER']);
const MANIFEST_STATUSES = new Set<SourceManifestStatus>(['ACTIVE', 'PLANNED']);
const HEALTH_STATUSES = new Set<SourceHealthStatus>([
  'UNKNOWN',
  'FETCHED',
  'HEALTHY',
  'UNCHANGED',
  'FETCH_FAILED',
  'PARSE_FAILED',
  'REVIEW_REQUIRED',
  'WAITING_FOR_COMPANION',
]);

function optionalEnum<T extends string>(
  raw: string | undefined,
  allowed: Set<T>,
  code: string,
  name: string,
): T | null {
  if (raw === undefined) return null;
  if (!allowed.has(raw as T)) {
    throw new BadRequestException({
      code,
      message: `${name} has an unsupported value`,
    });
  }
  return raw as T;
}

function optionalTerc(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  if (!/^\d{7}$/.test(raw)) {
    throw new BadRequestException({ code: 'INVALID_TERC', message: 'terc must contain exactly 7 digits' });
  }
  return raw;
}

function optionalSourceKey(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const value = raw.trim();
  if (!/^[a-z0-9][a-z0-9-]{1,127}$/.test(value)) {
    throw new BadRequestException({
      code: 'INVALID_SOURCE_KEY',
      message: 'sourceKey must be a stable lowercase manifest source key',
    });
  }
  return value;
}

function optionalBoolean(raw: string | undefined, name: string): boolean | null {
  if (raw === undefined) return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new BadRequestException({ code: 'INVALID_BOOLEAN', message: `${name} must be true or false` });
}

function optionalManifestVersion(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const value = raw.trim();
  if (!/^[a-z0-9-]+@[0-9]{4}(?:\.[0-9]+)+$/i.test(value)) {
    throw new BadRequestException({
      code: 'INVALID_MANIFEST_VERSION',
      message: 'manifestVersion must look like pilot-koszalin-region@2026.2',
    });
  }
  return value;
}

@Controller('internal/v1/source-ops')
export class InternalSourceOpsController {
  constructor(@Inject(InternalSourceOpsService) private readonly sourceOps: InternalSourceOpsService) {}

  @Get('sources')
  async sources(
    @Headers('x-wastepl-admin-key') key: string | undefined,
    @Headers('x-wastepl-actor') actor: string | undefined,
    @Query('terc') tercRaw?: string,
    @Query('dataType') dataTypeRaw?: string,
    @Query('manifestStatus') manifestStatusRaw?: string,
    @Query('healthStatus') healthStatusRaw?: string,
    @Query('sourceKey') sourceKeyRaw?: string,
    @Query('stale') staleRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    requireInternalAdmin(key, actor);
    return this.sourceOps.listSources({
      terc: optionalTerc(tercRaw),
      dataType: optionalEnum(dataTypeRaw, DATA_TYPES, 'INVALID_DATA_TYPE', 'dataType'),
      manifestStatus: optionalEnum(
        manifestStatusRaw,
        MANIFEST_STATUSES,
        'INVALID_MANIFEST_STATUS',
        'manifestStatus',
      ),
      healthStatus: optionalEnum(
        healthStatusRaw,
        HEALTH_STATUSES,
        'INVALID_HEALTH_STATUS',
        'healthStatus',
      ),
      sourceKey: optionalSourceKey(sourceKeyRaw),
      stale: optionalBoolean(staleRaw, 'stale'),
      limit: internalInteger(limitRaw, 50, 1, 200),
      offset: internalInteger(offsetRaw, 0, 0, 100000),
    });
  }

  @Get('coverage')
  async coverage(
    @Headers('x-wastepl-admin-key') key: string | undefined,
    @Headers('x-wastepl-actor') actor: string | undefined,
    @Query('manifestVersion') manifestVersionRaw?: string,
  ) {
    requireInternalAdmin(key, actor);
    return this.sourceOps.coverage(optionalManifestVersion(manifestVersionRaw));
  }

  @Get('summary')
  async summary(
    @Headers('x-wastepl-admin-key') key: string | undefined,
    @Headers('x-wastepl-actor') actor: string | undefined,
  ) {
    requireInternalAdmin(key, actor);
    return this.sourceOps.summary();
  }
}
