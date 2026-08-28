import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { ArtifactReader } from '../ingestion/artifact-reader.js';
import type { ArtifactHandlerInput } from '../ingestion/dispatching-artifact-processor.js';
import type { SourceProcessingStateUpdate } from '../ingestion/types.js';
import { PgkKoszalinPszokBundleArtifactHandler } from './pgk-koszalin-pszok-bundle-artifact-handler.js';

const parserKey = 'pgk-koszalin-pszok-html';
const bundleKey = 'koszalin-pszok';
const municipalityId = 'municipality-koszalin';
const mainRetrievedAt = new Date('2026-08-28T08:00:00.000Z');
const faqRetrievedAt = new Date('2026-08-28T08:05:00.000Z');

const mainSource = {
  id: 'source-main',
  municipality_id: municipalityId,
  source_key: 'koszalin-pszok-main',
  source_url: 'https://www.pgkkoszalin.pl/punkty-zbiorki-odpadow/punkt-zbiorki-odpadow-koszalin/',
  parser_key: parserKey,
  bundle_key: bundleKey,
  bundle_role: 'main',
  bundle_required_roles: ['main', 'faq'],
  bundle_freshness_minutes: 2880,
};

const faqSource = {
  id: 'source-faq',
  municipality_id: municipalityId,
  source_key: 'koszalin-pszok-faq',
  source_url: 'https://www.pgkkoszalin.pl/najczesciej-zadawane-pytania-f-a-q/',
  parser_key: parserKey,
  bundle_key: bundleKey,
  bundle_role: 'faq',
  bundle_required_roles: ['main', 'faq'],
  bundle_freshness_minutes: 2880,
};

const mainArtifact = {
  id: 'artifact-main-v1',
  source_id: mainSource.id,
  sha256: 'a'.repeat(64),
  storage_uri: 'memory://main-v1',
  retrieved_at: mainRetrievedAt,
  status: 'FETCHED',
};

const faqArtifact = {
  id: 'artifact-faq-v1',
  source_id: faqSource.id,
  sha256: 'b'.repeat(64),
  storage_uri: 'memory://faq-v1',
  retrieved_at: faqRetrievedAt,
  status: 'FETCHED',
};

function handlerInput(
  sourceId: string,
  artifact: typeof mainArtifact,
  body: string,
): ArtifactHandlerInput {
  return {
    artifact: {
      id: artifact.id,
      sourceId,
      sha256: artifact.sha256,
      storageUri: artifact.storage_uri,
      retrievedAt: artifact.retrieved_at,
      parserKey,
      status: artifact.status,
    },
    body: Buffer.from(body),
  };
}

interface FakePoolOptions {
  compatible?: Record<string, typeof mainArtifact | undefined>;
  latest?: Record<string, typeof mainArtifact | undefined>;
}

function fakePool(options: FakePoolOptions = {}): Pool {
  return {
    query: vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM sources') && sql.includes('WHERE id = $1')) {
        const sourceId = params[0];
        const source = sourceId === mainSource.id ? mainSource : sourceId === faqSource.id ? faqSource : undefined;
        return { rows: source ? [source] : [], rowCount: source ? 1 : 0 };
      }
      if (sql.includes('FROM sources') && sql.includes('WHERE municipality_id = $1')) {
        expect(params[0]).toBe(municipalityId);
        expect(params[1]).toBe(bundleKey);
        return { rows: [faqSource, mainSource], rowCount: 2 };
      }
      if (sql.includes('FROM source_artifacts') && sql.includes('abs(extract(epoch')) {
        const artifact = options.compatible?.[String(params[0])];
        return { rows: artifact ? [artifact] : [], rowCount: artifact ? 1 : 0 };
      }
      if (sql.includes('FROM source_artifacts')) {
        const artifact = options.latest?.[String(params[0])];
        return { rows: artifact ? [artifact] : [], rowCount: artifact ? 1 : 0 };
      }
      throw new Error(`Unexpected SQL in fake bundle pool: ${sql}`);
    }),
  } as unknown as Pool;
}

function fakeReader(bodies: Record<string, string>): ArtifactReader {
  return {
    async readVerified(input) {
      const body = bodies[input.storageUri];
      if (body === undefined) throw new Error(`Missing fake body for ${input.storageUri}`);
      return Buffer.from(body);
    },
  };
}

function dependencies() {
  const ingestions: unknown[] = [];
  const stateUpdates: SourceProcessingStateUpdate[] = [];
  const orchestrator = {
    async ingest(input: unknown) {
      ingestions.push(input);
      return [
        {
          facilityKey: 'pl-3261011-pszok-komunalna-5',
          state: 'UNCHANGED' as const,
          facilityId: 'facility-komunalna',
          assertionIds: [],
          reviewCandidateIds: [],
        },
      ];
    },
  };
  const registry = {
    async markSourceProcessingState(update: SourceProcessingStateUpdate) {
      stateUpdates.push(update);
    },
  };
  return { orchestrator, registry, ingestions, stateUpdates };
}

describe('PgkKoszalinPszokBundleArtifactHandler', () => {
  it('returns WAITING_FOR_COMPANION when main arrives before any FAQ artifact', async () => {
    const deps = dependencies();
    const handler = new PgkKoszalinPszokBundleArtifactHandler(
      fakePool(),
      fakeReader({}),
      deps.orchestrator,
      deps.registry,
    );

    const result = await handler.process(handlerInput(mainSource.id, mainArtifact, '<main />'));

    expect(result.outcome).toBe('WAITING_FOR_COMPANION');
    expect(result.metadata).toMatchObject({
      bundleKey,
      currentRole: 'main',
      missingArtifactRoles: ['faq'],
      staleArtifactRoles: [],
      retainedLastKnownGood: true,
    });
    expect(deps.ingestions).toHaveLength(0);
    expect(deps.stateUpdates).toHaveLength(0);
  });

  it('distinguishes a stale companion from a never-seen companion', async () => {
    const deps = dependencies();
    const handler = new PgkKoszalinPszokBundleArtifactHandler(
      fakePool({ latest: { [faqSource.id]: faqArtifact } }),
      fakeReader({}),
      deps.orchestrator,
      deps.registry,
    );

    const result = await handler.process(handlerInput(mainSource.id, mainArtifact, '<main />'));

    expect(result.outcome).toBe('WAITING_FOR_COMPANION');
    expect(result.metadata).toMatchObject({
      missingArtifactRoles: [],
      staleArtifactRoles: ['faq'],
    });
  });

  it('builds the same main+faq bundle regardless of which member triggers processing', async () => {
    const mainTriggered = dependencies();
    const mainHandler = new PgkKoszalinPszokBundleArtifactHandler(
      fakePool({ compatible: { [faqSource.id]: faqArtifact } }),
      fakeReader({ [faqArtifact.storage_uri]: '<faq />' }),
      mainTriggered.orchestrator,
      mainTriggered.registry,
    );
    const mainResult = await mainHandler.process(
      handlerInput(mainSource.id, mainArtifact, '<main />'),
    );

    const faqTriggered = dependencies();
    const faqHandler = new PgkKoszalinPszokBundleArtifactHandler(
      fakePool({ compatible: { [mainSource.id]: mainArtifact } }),
      fakeReader({ [mainArtifact.storage_uri]: '<main />' }),
      faqTriggered.orchestrator,
      faqTriggered.registry,
    );
    const faqResult = await faqHandler.process(
      handlerInput(faqSource.id, faqArtifact, '<faq />'),
    );

    expect(mainResult.outcome).toBe('PUBLISHED');
    expect(faqResult.outcome).toBe('PUBLISHED');
    expect(mainTriggered.ingestions).toEqual(faqTriggered.ingestions);
    expect(mainTriggered.stateUpdates).toHaveLength(1);
    expect(mainTriggered.stateUpdates[0]).toMatchObject({
      sourceId: faqSource.id,
      artifactId: faqArtifact.id,
      outcome: 'PUBLISHED',
    });
    expect(faqTriggered.stateUpdates[0]).toMatchObject({
      sourceId: mainSource.id,
      artifactId: mainArtifact.id,
      outcome: 'PUBLISHED',
    });
  });

  it('retains the unchanged main artifact when only FAQ changes', async () => {
    const changedFaq = {
      ...faqArtifact,
      id: 'artifact-faq-v2',
      sha256: 'c'.repeat(64),
      storage_uri: 'memory://faq-v2',
      retrieved_at: new Date('2026-08-28T09:00:00.000Z'),
    };
    const deps = dependencies();
    const handler = new PgkKoszalinPszokBundleArtifactHandler(
      fakePool({ compatible: { [mainSource.id]: mainArtifact } }),
      fakeReader({ [mainArtifact.storage_uri]: '<main />' }),
      deps.orchestrator,
      deps.registry,
    );

    const result = await handler.process(
      handlerInput(faqSource.id, changedFaq, '<faq changed="true" />'),
    );

    expect(result.outcome).toBe('PUBLISHED');
    expect(deps.ingestions).toHaveLength(1);
    expect(deps.ingestions[0]).toMatchObject({
      main: { artifactId: mainArtifact.id, sha256: mainArtifact.sha256 },
      faq: { artifactId: changedFaq.id, sha256: changedFaq.sha256 },
    });
    expect(result.metadata).toMatchObject({
      members: expect.arrayContaining([
        expect.objectContaining({ role: 'main', artifactId: mainArtifact.id }),
        expect.objectContaining({ role: 'faq', artifactId: changedFaq.id }),
      ]),
    });
  });
});
