import { Controller, Get } from '@nestjs/common';
import { APP_NAME } from '@wastepl/domain';

export interface HealthResponse {
  status: 'ok';
  service: typeof APP_NAME;
  time: string;
}

@Controller('v1/health')
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: APP_NAME,
      time: new Date().toISOString(),
    };
  }
}
