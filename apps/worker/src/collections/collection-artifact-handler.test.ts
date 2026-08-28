import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type {
  NormalizedDataset,
  PdfTextAdapter,
} from '../adapters/pdf-text/types.js';
import { PermanentArtifactParseError } from '../ingestion/artifact-processing.js';
import type { ArtifactHandlerInput } from '../ingestion/dispatching-artifact-processor.js';
import { PgkKoszalinCollectionArtifactHandler } from './collection-artifact-handler.js';

function dataset(): NormalizedDataset {
  return {
    schemaVersion: '0.1.0',
    municipality: { terc: '3209042', name: 'Manowo', municipalityType: 'RURAL' },
    serviceAreas: [
      {
        key: 'handler-test-area',
        name: 'Handler test area',
        buildingType: null,
        coverage: [{ type: 'LOCALITY', priority: 50, simc: '0308040' }],
      },
    ],
    collectionEvents: [
      {
        serviceAreaKey: 'handler-test-area',
        fraction: 'MIXED',
        date: '2026-09-01',
        status: 'SCHEDULED',
        note: null,
        sourceKey: 'handler-test-source',
        quality: {
          verificationStatus: 'OFFICIAL_SOURCE',
          confidence: 0.99,
          retrievedAt: '2026-08-28T08:00:00.000Z',
          warnings: [],
        },
      },
    ],
    facilities: [],
    alerts: [],
    sources: [
      {
        sourceKey: 'handler-test-source',
        url: 'https://example.invalid/handler-test.pdf',
        ownerType: 'MUNICIPAL_COMPANY',
        format: 'PDF_TEXT',
        reuseBasis: null,
        artifact: {
          sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          retrievedAt: '2026-08-28T08:00:00.000Z',
          parserKey: 'pgk-koszalin-pdf-text',
          parserVersion: 'test-1',
          extractionConfidence: 0.99,
          storageUri: 's3://test/handler',
        },
      },
    ],
  };
}

function input(): ArtifactHandlerInput {
  return {
    artifact: {
      id: '00000000-0000-4000-8000-000000000001',
      sourceId: '00000000-0000-4000-8000-000000000002',
      sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      storageUri: 's3://test/handler',
      retrievedAt: new Date('2026-08-28T08:00:00Z'),
      parserKey: 'pgk-koszalin-pdf-text',
      status: 'FETCHED',
    },
    body: Buffer.from('deterministic PDF text'),
  };
}

describe('PgkKoszalinCollectionArtifactHandler', () => {
  it('validates normalized output and delegates canonical publication', async () => {
    const normalized = dataset();
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          source_key: 'handler-test-source',
          source_url: 'https://example.invalid/handler-test.pdf',
        },
      ],
    });
    const pool = { query } as unknown as Pool;
    const adapter: PdfTextAdapter = {
      parserKey: 'pgk-koszalin-pdf-text',
      parserVersion: 'test-1',
      supports: vi.fn().mockReturnValue(true),
      parse: vi.fn().mockReturnValue(normalized),
    };
    const publish = vi.fn().mockResolvedValue({
      serviceAreasAdded: 1,
      serviceAreasRemoved: 0,
      serviceAreasUnchanged: 0,
      eventsAdded: 1,
      eventsRemoved: 0,
      eventsUnchanged: 0,
      replayed: false,
    });

    const handler = new PgkKoszalinCollectionArtifactHandler(pool, adapter, { publish });
    const result = await handler.process(input());

    expect(publish).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000001',
      normalized,
    );
    expect(result).toEqual({
      outcome: 'PUBLISHED',
      metadata: {
        municipalityTerc: '3209042',
        serviceAreasAdded: 1,
        serviceAreasRemoved: 0,
        serviceAreasUnchanged: 0,
        eventsAdded: 1,
        eventsRemoved: 0,
        eventsUnchanged: 0,
        replayed: false,
      },
    });
  });

  it('fails permanently when a source has no stable source key', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{ source_key: null, source_url: 'https://example.invalid/test.pdf' }],
      }),
    } as unknown as Pool;
    const adapter: PdfTextAdapter = {
      parserKey: 'pgk-koszalin-pdf-text',
      parserVersion: 'test-1',
      supports: vi.fn().mockReturnValue(true),
      parse: vi.fn().mockReturnValue(dataset()),
    };
    const handler = new PgkKoszalinCollectionArtifactHandler(pool, adapter, {
      publish: vi.fn(),
    });

    await expect(handler.process(input())).rejects.toMatchObject<Partial<PermanentArtifactParseError>>({
      code: 'SOURCE_KEY_MISSING',
    });
  });
});
