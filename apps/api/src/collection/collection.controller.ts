import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
  CollectionService,
  type CollectionScheduleQuery,
  type CollectionScheduleResponse,
} from './collection.service.js';

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match?.[1] || !match[2] || !match[3]) return false;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseDays(value: string | undefined): number {
  if (value === undefined) return 90;
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new BadRequestException({
      code: 'INVALID_DAYS',
      message: 'days must be an integer between 1 and 365',
    });
  }
  return days;
}

@Controller('v1/collection')
export class CollectionController {
  constructor(private readonly collection: CollectionService) {}

  @Get()
  async getCollection(
    @Query('addressId') addressId?: string,
    @Query('address') address?: string,
    @Query('from') from?: string,
    @Query('days') daysRaw?: string,
  ): Promise<CollectionScheduleResponse> {
    const normalizedAddressId = addressId?.trim() || null;
    const normalizedAddress = address?.trim() || null;

    if (!normalizedAddressId && !normalizedAddress) {
      throw new BadRequestException({
        code: 'ADDRESS_REQUIRED',
        message: 'Provide addressId or address',
      });
    }
    if (normalizedAddressId && normalizedAddress) {
      throw new BadRequestException({
        code: 'ADDRESS_INPUT_CONFLICT',
        message: 'Provide only one of addressId or address',
      });
    }

    const normalizedFrom = from?.trim() || new Date().toISOString().slice(0, 10);
    if (!isIsoDate(normalizedFrom)) {
      throw new BadRequestException({
        code: 'INVALID_FROM_DATE',
        message: 'from must use YYYY-MM-DD and be a valid calendar date',
      });
    }

    const query: CollectionScheduleQuery = {
      addressId: normalizedAddressId,
      address: normalizedAddress,
      from: normalizedFrom,
      days: parseDays(daysRaw),
    };
    return this.collection.getSchedule(query);
  }
}
