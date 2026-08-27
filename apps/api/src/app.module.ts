import { Module } from '@nestjs/common';
import { AddressController } from './address/address.controller.js';
import { AddressService } from './address/address.service.js';
import { CollectionController } from './collection/collection.controller.js';
import { CollectionService } from './collection/collection.service.js';
import { DatabaseService } from './database/database.service.js';
import { FacilitiesController } from './facilities/facilities.controller.js';
import { FacilitiesService } from './facilities/facilities.service.js';
import { HealthController } from './health/health.controller.js';

@Module({
  controllers: [HealthController, AddressController, CollectionController, FacilitiesController],
  providers: [DatabaseService, AddressService, CollectionService, FacilitiesService],
})
export class AppModule {}
