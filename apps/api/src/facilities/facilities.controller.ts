import { BadRequestException, Controller, Get, Inject, Query } from '@nestjs/common';
import {
  DEPOSIT_CONTAINER_CLASSES,
  FACILITY_KINDS,
  FACILITY_MATERIALS,
  type DepositContainerClass,
  type FacilityKind,
  type FacilityMaterial,
} from '@wastepl/domain';
import {
  FacilitiesService,
  type FacilitiesResponse,
  type FacilityBbox,
  type FacilityNear,
} from './facilities.service.js';

function parseEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  name: string,
): T | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  if (!allowed.includes(normalized as T)) {
    throw new BadRequestException({
      code: `INVALID_${name.toUpperCase()}`,
      message: `${name} must be one of: ${allowed.join(', ')}`,
    });
  }
  return normalized as T;
}

function parseInteger(
  raw: string | undefined,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new BadRequestException({
      code: `INVALID_${name.toUpperCase()}`,
      message: `${name} must be an integer between ${min} and ${max}`,
    });
  }
  return value;
}

function parseNumber(raw: string, name: string, min: number, max: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new BadRequestException({
      code: `INVALID_${name.toUpperCase()}`,
      message: `${name} must be a number between ${min} and ${max}`,
    });
  }
  return value;
}

function parseBbox(raw: string | undefined): FacilityBbox | null {
  if (!raw?.trim()) return null;
  const parts = raw.split(',').map((part) => part.trim());
  if (parts.length !== 4) {
    throw new BadRequestException({
      code: 'INVALID_BBOX',
      message: 'bbox must use minLon,minLat,maxLon,maxLat',
    });
  }

  const minLon = parseNumber(parts[0]!, 'bboxMinLon', -180, 180);
  const minLat = parseNumber(parts[1]!, 'bboxMinLat', -90, 90);
  const maxLon = parseNumber(parts[2]!, 'bboxMaxLon', -180, 180);
  const maxLat = parseNumber(parts[3]!, 'bboxMaxLat', -90, 90);
  if (minLon >= maxLon || minLat >= maxLat) {
    throw new BadRequestException({
      code: 'INVALID_BBOX_ORDER',
      message: 'bbox minimums must be smaller than maximums',
    });
  }
  return { minLon, minLat, maxLon, maxLat };
}

function parseNear(
  latRaw: string | undefined,
  lonRaw: string | undefined,
  radiusRaw: string | undefined,
): FacilityNear | null {
  const present = [latRaw, lonRaw, radiusRaw].filter((value) => value !== undefined && value.trim() !== '');
  if (present.length === 0) return null;
  if (present.length !== 3) {
    throw new BadRequestException({
      code: 'INCOMPLETE_NEAR_FILTER',
      message: 'lat, lon and radiusMeters must be provided together',
    });
  }

  return {
    lat: parseNumber(latRaw!, 'lat', -90, 90),
    lon: parseNumber(lonRaw!, 'lon', -180, 180),
    radiusMeters: parseNumber(radiusRaw!, 'radiusMeters', 1, 100000),
  };
}

@Controller('v1/facilities')
export class FacilitiesController {
  constructor(@Inject(FacilitiesService) private readonly facilities: FacilitiesService) {}

  @Get()
  async list(
    @Query('kind') kindRaw?: string,
    @Query('terc') tercRaw?: string,
    @Query('material') materialRaw?: string,
    @Query('container') containerRaw?: string,
    @Query('bbox') bboxRaw?: string,
    @Query('lat') latRaw?: string,
    @Query('lon') lonRaw?: string,
    @Query('radiusMeters') radiusRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ): Promise<FacilitiesResponse> {
    const bbox = parseBbox(bboxRaw);
    const near = parseNear(latRaw, lonRaw, radiusRaw);
    if (bbox && near) {
      throw new BadRequestException({
        code: 'SPATIAL_FILTER_CONFLICT',
        message: 'Use bbox or lat/lon/radiusMeters, not both',
      });
    }

    const terc = tercRaw?.trim() || null;
    if (terc && !/^\d{4,10}$/.test(terc)) {
      throw new BadRequestException({
        code: 'INVALID_TERC',
        message: 'terc must contain 4-10 digits',
      });
    }

    return this.facilities.list({
      kind: parseEnum<FacilityKind>(kindRaw, FACILITY_KINDS, 'kind'),
      terc,
      material: parseEnum<FacilityMaterial>(materialRaw, FACILITY_MATERIALS, 'material'),
      container: parseEnum<DepositContainerClass>(containerRaw, DEPOSIT_CONTAINER_CLASSES, 'container'),
      bbox,
      near,
      limit: parseInteger(limitRaw, 'limit', 50, 1, 200),
      offset: parseInteger(offsetRaw, 'offset', 0, 0, 100000),
    });
  }
}
