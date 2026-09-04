import { Controller, Get, Inject } from '@nestjs/common';
import { APP_NAME } from '@wastepl/domain';
import { DatabaseService } from '../database/database.service.js';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: typeof APP_NAME;
  time: string;
  database: 'connected' | 'disconnected';
}

@Controller('v1/health')
export class HealthController {
  constructor(@Inject(DatabaseService) private readonly db?: DatabaseService) {}

  @Get()
  async getHealth(): Promise<HealthResponse> {
    let dbStatus: 'connected' | 'disconnected' = 'connected';
    if (this.db?.pool) {
      try {
        await this.db.pool.query('SELECT 1');
      } catch {
        dbStatus = 'disconnected';
      }
    }

    return {
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      service: APP_NAME,
      time: new Date().toISOString(),
      database: dbStatus,
    };
  }
}

