import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { InternalReviewService, type ReviewDecision, type ReviewKind } from './internal-review.service.js';

function requireAdmin(key: string | undefined, actor: string | undefined): string {
  const expected = process.env.WASTEPL_ADMIN_API_KEY;
  if (!expected || !key || key !== expected) {
    throw new UnauthorizedException({ code: 'ADMIN_AUTH_REQUIRED', message: 'Valid internal admin key required' });
  }
  const normalized = actor?.trim();
  if (!normalized) {
    throw new BadRequestException({ code: 'ACTOR_REQUIRED', message: 'x-wastepl-actor is required for auditable admin operations' });
  }
  return normalized;
}

function parseKind(raw: string): ReviewKind {
  if (raw !== 'RECONCILIATION' && raw !== 'DATA_QUALITY') {
    throw new BadRequestException({ code: 'INVALID_REVIEW_KIND', message: 'kind must be RECONCILIATION or DATA_QUALITY' });
  }
  return raw;
}

function uuid(raw: string, name = 'id'): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
    throw new BadRequestException({ code: `INVALID_${name.toUpperCase()}`, message: `${name} must be a UUID` });
  }
  return raw;
}

function integer(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new BadRequestException({ code: 'INVALID_PAGINATION', message: `value must be an integer between ${min} and ${max}` });
  }
  return value;
}

@Controller('internal/v1/reviews')
export class InternalReviewController {
  constructor(@Inject(InternalReviewService) private readonly reviews: InternalReviewService) {}

  @Get()
  async list(
    @Headers('x-wastepl-admin-key') key: string | undefined,
    @Headers('x-wastepl-actor') actor: string | undefined,
    @Query('state') stateRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    requireAdmin(key, actor);
    const state = stateRaw ?? 'PENDING';
    if (!['PENDING', 'APPROVED', 'REJECTED', 'ALL'].includes(state)) {
      throw new BadRequestException({ code: 'INVALID_REVIEW_STATE', message: 'state must be PENDING, APPROVED, REJECTED or ALL' });
    }
    return this.reviews.list(
      state as 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL',
      integer(limitRaw, 50, 1, 200),
      integer(offsetRaw, 0, 0, 100000),
    );
  }

  @Get('audit')
  async audit(
    @Headers('x-wastepl-admin-key') key: string | undefined,
    @Headers('x-wastepl-actor') actor: string | undefined,
    @Query('kind') kindRaw?: string,
    @Query('reviewId') reviewIdRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    requireAdmin(key, actor);
    return this.reviews.auditTrail(
      kindRaw ? parseKind(kindRaw) : null,
      reviewIdRaw ? uuid(reviewIdRaw, 'reviewId') : null,
      integer(limitRaw, 100, 1, 500),
    );
  }

  @Get(':kind/:id')
  async get(
    @Headers('x-wastepl-admin-key') key: string | undefined,
    @Headers('x-wastepl-actor') actor: string | undefined,
    @Param('kind') kindRaw: string,
    @Param('id') idRaw: string,
  ) {
    requireAdmin(key, actor);
    return this.reviews.get(parseKind(kindRaw), uuid(idRaw));
  }

  @Post(':kind/:id/decision')
  async decide(
    @Headers('x-wastepl-admin-key') key: string | undefined,
    @Headers('x-wastepl-actor') actorRaw: string | undefined,
    @Param('kind') kindRaw: string,
    @Param('id') idRaw: string,
    @Body() body: {
      decision?: ReviewDecision;
      note?: string | null;
      geometry?: { lat?: number; lon?: number; sourceArtifactId?: string } | null;
    },
  ) {
    const actor = requireAdmin(key, actorRaw);
    if (body.decision !== 'APPROVE' && body.decision !== 'REJECT') {
      throw new BadRequestException({ code: 'INVALID_REVIEW_DECISION', message: 'decision must be APPROVE or REJECT' });
    }

    let geometry: { lat: number; lon: number; sourceArtifactId: string } | null = null;
    if (body.geometry) {
      const { lat, lon, sourceArtifactId } = body.geometry;
      if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90 ||
          typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180 ||
          typeof sourceArtifactId !== 'string') {
        throw new BadRequestException({ code: 'INVALID_GEOMETRY_EVIDENCE', message: 'geometry requires valid lat, lon and sourceArtifactId' });
      }
      geometry = { lat, lon, sourceArtifactId: uuid(sourceArtifactId, 'sourceArtifactId') };
    }

    const note = body.note == null ? null : body.note.trim().slice(0, 2000) || null;
    return this.reviews.decide(parseKind(kindRaw), uuid(idRaw), {
      decision: body.decision,
      actor,
      note,
      geometry,
    });
  }
}
