import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { AddressService, type AddressResolveResponse } from './address.service.js';

@Controller('v1/addresses')
export class AddressController {
  constructor(private readonly addresses: AddressService) {}

  @Get('resolve')
  async resolve(@Query('query') query?: string): Promise<AddressResolveResponse> {
    const normalized = query?.trim() ?? '';
    if (normalized.length < 3) {
      throw new BadRequestException({
        code: 'INVALID_ADDRESS_QUERY',
        message: 'query must contain at least 3 characters',
      });
    }
    return this.addresses.search(normalized);
  }
}
