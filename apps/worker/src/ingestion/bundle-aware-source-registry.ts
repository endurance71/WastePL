import type { Pool } from 'pg';
import { PgSourceRegistry } from './source-registry.js';
import type {
  SourceCheckUpdate,
  SourceProcessingStateUpdate,
} from './types.js';

export class PgBundleAwareSourceRegistry extends PgSourceRegistry {
  constructor(private readonly databasePool: Pool) {
    super(databasePool);
  }

  override async markSourceChecked(sourceId: string, update: SourceCheckUpdate): Promise<void> {
    const previous = await this.databasePool.query<{ health_status: string }>(
      'SELECT health_status FROM sources WHERE id = $1',
      [sourceId],
    );
    const previousHealth = previous.rows[0]?.health_status ?? null;
    const incomingHealth = update.healthStatus ?? (update.sha256 ? 'FETCHED' : 'UNCHANGED');

    await super.markSourceChecked(sourceId, update);

    if (previousHealth === 'WAITING_FOR_COMPANION' && incomingHealth === 'UNCHANGED') {
      await this.databasePool.query(
        `UPDATE sources
         SET health_status = 'WAITING_FOR_COMPANION'
         WHERE id = $1`,
        [sourceId],
      );
    }
  }

  override async markSourceProcessingState(update: SourceProcessingStateUpdate): Promise<void> {
    if (update.outcome !== 'WAITING_FOR_COMPANION') {
      await super.markSourceProcessingState(update);
      return;
    }

    const metadata = update.metadata ?? {};
    await this.recordProcessingAttempt({
      sourceId: update.sourceId,
      artifactId: update.artifactId,
      startedAt: update.startedAt,
      completedAt: update.completedAt,
      outcome: update.outcome,
      parserKey: update.parserKey,
      errorCode: update.errorCode,
      errorMessage: update.errorMessage,
      metadata,
    });

    await this.databasePool.query(
      `UPDATE sources
       SET health_status = 'WAITING_FOR_COMPANION',
           last_error_code = NULL,
           last_error_message = NULL
       WHERE id = $1`,
      [update.sourceId],
    );
  }
}
