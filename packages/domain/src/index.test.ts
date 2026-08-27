import { describe, expect, it } from 'vitest';
import {
  APP_NAME,
  INGESTION_QUEUE,
  PIPELINE_STAGES,
  SERVICE_AREA_SPECIFICITY,
} from './index.js';

describe('WastePL domain contracts', () => {
  it('exposes stable platform identifiers', () => {
    expect(APP_NAME).toBe('wastepl');
    expect(INGESTION_QUEUE).toBe('source-ingestion');
  });

  it('keeps the ingestion pipeline and service-area priority deterministic', () => {
    expect(PIPELINE_STAGES).toEqual([
      'fetch',
      'hash',
      'store',
      'parse',
      'normalize',
      'validate',
      'diff',
      'publish-or-review',
    ]);
    expect(SERVICE_AREA_SPECIFICITY[0]).toBe('EXPLICIT_ADDRESS');
    expect(SERVICE_AREA_SPECIFICITY.at(-1)).toBe('MUNICIPALITY');
  });
});
