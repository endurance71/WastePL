import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import pg from 'pg';

const { Pool } = pg;

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  readonly pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? 'postgresql://wastepl:wastepl@localhost:5432/wastepl',
  });

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
