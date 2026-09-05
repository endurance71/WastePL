import { Module } from '@nestjs/common';
import { AddressController } from './address/address.controller.js';
import { AddressService } from './address/address.service.js';
import { CollectionController } from './collection/collection.controller.js';
import { CollectionService } from './collection/collection.service.js';
import { DatabaseService } from './database/database.service.js';
import { FacilitiesController } from './facilities/facilities.controller.js';
import { FacilitiesService } from './facilities/facilities.service.js';
import { HealthController } from './health/health.controller.js';
import { FeedbackController } from './feedback/feedback.controller.js';
import { FeedbackService } from './feedback/feedback.service.js';
import { InternalReviewController } from './internal-review/internal-review.controller.js';
import { InternalReviewService } from './internal-review/internal-review.service.js';
import { InternalSourceOpsController } from './internal-source-ops/internal-source-ops.controller.js';
import { InternalSourceOpsService } from './internal-source-ops/internal-source-ops.service.js';
import { NotificationsController } from './notifications/notifications.controller.js';
import { NotificationsService } from './notifications/notifications.service.js';
import { TelemetryController } from './telemetry/telemetry.controller.js';
import { TelemetryService } from './telemetry/telemetry.service.js';

@Module({
  controllers: [
    HealthController,
    AddressController,
    CollectionController,
    FacilitiesController,
    InternalReviewController,
    InternalSourceOpsController,
    NotificationsController,
    FeedbackController,
    TelemetryController,
  ],
  providers: [
    DatabaseService,
    AddressService,
    CollectionService,
    FacilitiesService,
    InternalReviewService,
    InternalSourceOpsService,
    NotificationsService,
    FeedbackService,
    TelemetryService,
  ],
})
export class AppModule {}
