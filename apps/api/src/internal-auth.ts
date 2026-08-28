import { BadRequestException, UnauthorizedException } from '@nestjs/common';

export function requireInternalAdmin(
  key: string | undefined,
  actor: string | undefined,
): string {
  const expected = process.env.WASTEPL_ADMIN_API_KEY;
  if (!expected || !key || key !== expected) {
    throw new UnauthorizedException({
      code: 'ADMIN_AUTH_REQUIRED',
      message: 'Valid internal admin key required',
    });
  }
  const normalized = actor?.trim();
  if (!normalized) {
    throw new BadRequestException({
      code: 'ACTOR_REQUIRED',
      message: 'x-wastepl-actor is required for auditable admin operations',
    });
  }
  return normalized;
}

export function internalInteger(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new BadRequestException({
      code: 'INVALID_PAGINATION',
      message: `value must be an integer between ${min} and ${max}`,
    });
  }
  return value;
}
