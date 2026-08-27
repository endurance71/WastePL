import {
  facilityFingerprint,
  normalizeFacilityText,
  type FacilityIdentityAssertion,
  type VerificationStatus,
} from '@wastepl/domain';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type { NormalizedFacilityV02 } from '../adapters/html/pgk-koszalin-pszok-adapter.js';
import { FacilityReconciliationService } from './facility-reconciliation-service.js';
import { PgFacilityReconciliationRepository } from './pg-facility-reconciliation-repository.js';

export type FacilityClaim =
  | 'identity'
  | 'address'
  | 'location'
  | 'openingHours'
  | 'access'
  | 'acceptedMaterials'
  | 'acceptedContainers'
  | 'operationalStatus';

export interface FacilityBundleArtifact {
  artifactId: string;
  sourceKey: string;
  retrievedAt: string;
}

export interface FacilityBundleAssertionSpec {
  sourceKey: string;
  claims: FacilityClaim[];
  sourceAuthority?: number;
  verificationStatus?: VerificationStatus;
  confidence?: number;
}

export interface FacilityBundleEntity {
  facility: NormalizedFacilityV02;
  assertions: FacilityBundleAssertionSpec[];
}

export interface FacilityBundlePublishInput {
  municipalityTerc: string;
  artifacts: FacilityBundleArtifact[];
  entities: FacilityBundleEntity[];
}

export interface FacilityBundlePublishOutcome {
  facilityKey: string;
  state: 'CREATED' | 'ATTACHED' | 'UNCHANGED' | 'REVIEW_REQUIRED';
  facilityId: string | null;
  assertionIds: string[];
  reviewCandidateIds: string[];
}

interface AssertionPersistenceRow extends QueryResultRow {
  id: string;
  facility_id: string | null;
  reconciliation_state: 'UNMATCHED' | 'CANONICAL' | 'REVIEW_REQUIRED';
}

interface ExistingCanonicalRow extends QueryResultRow {
  id: string;
  canonical_key: string | null;
}

function externalIdentities(
  facility: NormalizedFacilityV02,
  claims: FacilityClaim[],
): FacilityIdentityAssertion['externalIdentities'] {
  if (!claims.includes('identity')) return [];
  return facility.externalIds.map((externalId) => ({
    namespace: externalId.provider,
    id: externalId.id,
    role: 'POINT' as const,
  }));
}

function buildIdentityAssertion(
  municipalityTerc: string,
  facility: NormalizedFacilityV02,
  artifact: FacilityBundleArtifact,
  spec: FacilityBundleAssertionSpec,
): FacilityIdentityAssertion {
  const includeLocation = spec.claims.includes('location') && facility.location !== null;
  const includeOperational = spec.claims.includes('operationalStatus');
  return {
    sourceKey: spec.sourceKey,
    sourceArtifactId: artifact.artifactId,
    sourceAuthority: spec.sourceAuthority ?? 200,
    retrievedAt: artifact.retrievedAt,
    staticFreshnessSeconds: 7 * 24 * 60 * 60,
    statusFreshnessSeconds: 60 * 60,
    kind: facility.kind,
    municipalityTerc,
    name: facility.name,
    address: facility.address,
    location: includeLocation ? facility.location : null,
    externalIdentities: externalIdentities(facility, spec.claims),
    operationalStatus: includeOperational
      ? {
          state: facility.operationalStatus.state,
          observedAt: facility.operationalStatus.observedAt,
          sourceKey: facility.operationalStatus.sourceKey,
        }
      : { state: 'UNKNOWN', observedAt: null, sourceKey: null },
  };
}

function publicOpeningHours(facility: NormalizedFacilityV02): Record<string, unknown> {
  return {
    timezone: facility.openingHours.timezone,
    weekly: facility.openingHours.weekly,
    exceptions: facility.openingHours.exceptions,
  };
}

export class PgFacilityBundlePublisher {
  constructor(private readonly pool: Pool) {}

  async publish(input: FacilityBundlePublishInput): Promise<FacilityBundlePublishOutcome[]> {
    const artifactMap = new Map(input.artifacts.map((artifact) => [artifact.sourceKey, artifact]));
    if (artifactMap.size !== input.artifacts.length) {
      throw new Error('Facility bundle contains duplicate sourceKey artifacts');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const municipality = await client.query<{ id: string }>(
        'SELECT id FROM municipalities WHERE terc = $1 LIMIT 1',
        [input.municipalityTerc],
      );
      const municipalityId = municipality.rows[0]?.id;
      if (!municipalityId) throw new Error(`Municipality TERC ${input.municipalityTerc} not found`);

      const repository = new PgFacilityReconciliationRepository(client);
      const reconciliation = new FacilityReconciliationService(repository);
      const outcomes: FacilityBundlePublishOutcome[] = [];

      for (const entity of input.entities) {
        const outcome = await this.publishEntity(
          client,
          repository,
          reconciliation,
          municipalityId,
          input.municipalityTerc,
          artifactMap,
          entity,
        );
        outcomes.push(outcome);
      }

      const publishedIds = input.artifacts.map((artifact) => artifact.artifactId);
      await client.query(
        `UPDATE source_artifacts
         SET status = 'PUBLISHED',
             parse_report = COALESCE(parse_report, '{}'::jsonb) || $2::jsonb
         WHERE id = ANY($1::uuid[])`,
        [
          publishedIds,
          JSON.stringify({
            facilityIngestion: {
              outcomes: outcomes.map((outcome) => ({
                facilityKey: outcome.facilityKey,
                state: outcome.state,
                facilityId: outcome.facilityId,
              })),
            },
          }),
        ],
      );

      await client.query('COMMIT');
      return outcomes;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async publishEntity(
    client: PoolClient,
    repository: PgFacilityReconciliationRepository,
    reconciliation: FacilityReconciliationService,
    municipalityId: string,
    municipalityTerc: string,
    artifactMap: Map<string, FacilityBundleArtifact>,
    entity: FacilityBundleEntity,
  ): Promise<FacilityBundlePublishOutcome> {
    if (entity.assertions.length === 0) {
      throw new Error(`Facility ${entity.facility.key} has no source assertions`);
    }

    const assertionRows: Array<{
      spec: FacilityBundleAssertionSpec;
      assertion: FacilityIdentityAssertion;
      row: AssertionPersistenceRow;
    }> = [];

    for (const spec of entity.assertions) {
      const artifact = artifactMap.get(spec.sourceKey);
      if (!artifact) {
        throw new Error(`Facility ${entity.facility.key} references missing artifact sourceKey ${spec.sourceKey}`);
      }
      const assertion = buildIdentityAssertion(
        municipalityTerc,
        entity.facility,
        artifact,
        spec,
      );
      const row = await this.upsertAssertion(
        client,
        municipalityId,
        entity.facility,
        assertion,
        spec,
      );
      assertionRows.push({ spec, assertion, row });
    }

    const primarySourceKey = entity.facility.sourceKey;
    const primary = assertionRows.find((item) => item.spec.sourceKey === primarySourceKey);
    if (!primary) {
      throw new Error(`Facility ${entity.facility.key} has no primary assertion for ${primarySourceKey}`);
    }

    if (entity.facility.quality.verificationStatus === 'REVIEW_REQUIRED') {
      await client.query(
        `UPDATE facility_source_assertions
         SET facility_id = NULL, reconciliation_state = 'REVIEW_REQUIRED'
         WHERE id = ANY($1::uuid[])`,
        [assertionRows.map((item) => item.row.id)],
      );
      return {
        facilityKey: entity.facility.key,
        state: 'REVIEW_REQUIRED',
        facilityId: null,
        assertionIds: assertionRows.map((item) => item.row.id),
        reviewCandidateIds: [],
      };
    }

    const existingBoundIds = new Set(
      assertionRows
        .map((item) => item.row.facility_id)
        .filter((value): value is string => Boolean(value)),
    );
    if (existingBoundIds.size === 1 && assertionRows.every((item) => item.row.reconciliation_state === 'CANONICAL')) {
      const facilityId = [...existingBoundIds][0]!;
      await this.finalizeCanonical(client, facilityId, artifactMap, entity.facility);
      return {
        facilityKey: entity.facility.key,
        state: 'UNCHANGED',
        facilityId,
        assertionIds: assertionRows.map((item) => item.row.id),
        reviewCandidateIds: [],
      };
    }

    const stableCanonical = await client.query<ExistingCanonicalRow>(
      'SELECT id, canonical_key FROM facilities WHERE canonical_key = $1 LIMIT 1',
      [entity.facility.key],
    );
    if (stableCanonical.rows[0]) {
      const facilityId = stableCanonical.rows[0].id;
      for (const item of assertionRows) await repository.attachAssertion(item.row.id, facilityId);
      await this.finalizeCanonical(client, facilityId, artifactMap, entity.facility);
      return {
        facilityKey: entity.facility.key,
        state: 'ATTACHED',
        facilityId,
        assertionIds: assertionRows.map((item) => item.row.id),
        reviewCandidateIds: [],
      };
    }

    const reconciliationOutcome = await reconciliation.reconcile(primary.row.id, primary.assertion);
    if (reconciliationOutcome.state === 'REVIEW_REQUIRED') {
      const secondaryIds = assertionRows
        .filter((item) => item.row.id !== primary.row.id)
        .map((item) => item.row.id);
      if (secondaryIds.length > 0) {
        await client.query(
          `UPDATE facility_source_assertions
           SET facility_id = NULL, reconciliation_state = 'REVIEW_REQUIRED'
           WHERE id = ANY($1::uuid[])`,
          [secondaryIds],
        );
      }
      return {
        facilityKey: entity.facility.key,
        state: 'REVIEW_REQUIRED',
        facilityId: null,
        assertionIds: assertionRows.map((item) => item.row.id),
        reviewCandidateIds: reconciliationOutcome.reviewCandidateIds,
      };
    }

    const facilityId = reconciliationOutcome.facilityId;
    if (!facilityId) throw new Error(`Reconciliation produced no facility for ${entity.facility.key}`);
    for (const item of assertionRows) {
      if (item.row.id !== primary.row.id) await repository.attachAssertion(item.row.id, facilityId);
    }

    const canonical = await client.query<ExistingCanonicalRow>(
      'SELECT id, canonical_key FROM facilities WHERE id = $1 LIMIT 1',
      [facilityId],
    );
    if (reconciliationOutcome.state === 'CREATED' || canonical.rows[0]?.canonical_key === entity.facility.key) {
      await this.finalizeCanonical(client, facilityId, artifactMap, entity.facility);
    }

    return {
      facilityKey: entity.facility.key,
      state: reconciliationOutcome.state === 'CREATED' ? 'CREATED' : 'ATTACHED',
      facilityId,
      assertionIds: assertionRows.map((item) => item.row.id),
      reviewCandidateIds: [],
    };
  }

  private async upsertAssertion(
    client: PoolClient,
    municipalityId: string,
    facility: NormalizedFacilityV02,
    assertion: FacilityIdentityAssertion,
    spec: FacilityBundleAssertionSpec,
  ): Promise<AssertionPersistenceRow> {
    const claims = new Set(spec.claims);
    const acceptedMaterials = claims.has('acceptedMaterials') ? facility.acceptedMaterials : [];
    const acceptedContainers = claims.has('acceptedContainers') ? facility.acceptedContainers : [];
    const verificationStatus = spec.verificationStatus ?? facility.quality.verificationStatus;
    const confidence = spec.confidence ?? facility.quality.confidence;
    const fingerprint = facilityFingerprint(assertion);

    const result = await client.query<AssertionPersistenceRow>(
      `INSERT INTO facility_source_assertions (
         source_artifact_id, source_key, source_authority, verification_status,
         confidence, retrieved_at, static_freshness_seconds, status_freshness_seconds,
         kind, municipality_id, name, normalized_name, address_text, normalized_address,
         geom, external_ids, accepted_materials, accepted_containers,
         operational_status, operational_status_observed_at,
         operational_status_source_key, fingerprint, reconciliation_state
       ) VALUES (
         $1, $2, $3, $4, $5, $6::timestamptz, $7, $8,
         $9, $10, $11, $12, $13, $14,
         CASE WHEN $15::double precision IS NULL OR $16::double precision IS NULL
           THEN NULL ELSE ST_SetSRID(ST_MakePoint($16, $15), 4326) END,
         $17::jsonb, $18::text[], $19::text[],
         $20, $21::timestamptz, $22, $23, 'UNMATCHED'
       )
       ON CONFLICT (source_artifact_id, fingerprint) DO UPDATE SET
         source_key = EXCLUDED.source_key,
         source_authority = EXCLUDED.source_authority,
         verification_status = EXCLUDED.verification_status,
         confidence = EXCLUDED.confidence,
         retrieved_at = EXCLUDED.retrieved_at,
         static_freshness_seconds = EXCLUDED.static_freshness_seconds,
         status_freshness_seconds = EXCLUDED.status_freshness_seconds,
         kind = EXCLUDED.kind,
         municipality_id = EXCLUDED.municipality_id,
         name = EXCLUDED.name,
         normalized_name = EXCLUDED.normalized_name,
         address_text = EXCLUDED.address_text,
         normalized_address = EXCLUDED.normalized_address,
         geom = EXCLUDED.geom,
         external_ids = EXCLUDED.external_ids,
         accepted_materials = EXCLUDED.accepted_materials,
         accepted_containers = EXCLUDED.accepted_containers,
         operational_status = EXCLUDED.operational_status,
         operational_status_observed_at = EXCLUDED.operational_status_observed_at,
         operational_status_source_key = EXCLUDED.operational_status_source_key
       RETURNING id, facility_id, reconciliation_state`,
      [
        assertion.sourceArtifactId,
        assertion.sourceKey,
        assertion.sourceAuthority,
        verificationStatus,
        confidence,
        assertion.retrievedAt,
        assertion.staticFreshnessSeconds,
        assertion.statusFreshnessSeconds,
        assertion.kind,
        municipalityId,
        assertion.name,
        normalizeFacilityText(assertion.name),
        assertion.address,
        normalizeFacilityText(assertion.address),
        assertion.location?.lat ?? null,
        assertion.location?.lon ?? null,
        JSON.stringify(assertion.externalIdentities),
        acceptedMaterials,
        acceptedContainers,
        assertion.operationalStatus.state,
        assertion.operationalStatus.observedAt,
        assertion.operationalStatus.sourceKey,
        fingerprint,
      ],
    );
    return result.rows[0]!;
  }

  private async finalizeCanonical(
    client: PoolClient,
    facilityId: string,
    artifactMap: Map<string, FacilityBundleArtifact>,
    facility: NormalizedFacilityV02,
  ): Promise<void> {
    const artifactId = (sourceKey: string | null, claim: string): string | null => {
      if (!sourceKey) return null;
      const artifact = artifactMap.get(sourceKey);
      if (!artifact) throw new Error(`Facility ${facility.key} ${claim} references missing sourceKey ${sourceKey}`);
      return artifact.artifactId;
    };

    const primaryArtifactId = artifactId(facility.sourceKey, 'primary');
    const locationArtifactId = artifactId(facility.locationSourceKey, 'location');
    const hoursArtifactId = artifactId(facility.openingHours.sourceKey, 'openingHours');
    const accessArtifactId = artifactId(facility.access.sourceKey, 'access');
    const operationalArtifactId = artifactId(facility.operationalStatus.sourceKey, 'operationalStatus');

    const openingHours = publicOpeningHours(facility);
    const accessRules = {
      quantityLimits: facility.access.quantityLimits,
      notes: facility.access.notes,
    };

    const result = await client.query(
      `UPDATE facilities
       SET canonical_key = $2,
           kind = $3,
           name = $4,
           address_text = $5,
           geom = CASE WHEN $6::double precision IS NULL OR $7::double precision IS NULL
             THEN NULL ELSE ST_SetSRID(ST_MakePoint($7, $6), 4326) END,
           external_ids = $8::jsonb,
           accepted_materials = $9::text[],
           accepted_containers = $10::text[],
           opening_hours = $11::jsonb,
           opening_hours_timezone = $12,
           hours_source_artifact_id = $13,
           access_scope = $14,
           access_requires_proof = $15,
           access_rules = $16::jsonb,
           access_source_artifact_id = $17,
           operational_status = $18,
           operational_status_observed_at = $19::timestamptz,
           operational_status_source_artifact_id = $20,
           location_source_artifact_id = $21,
           operator_name = $22,
           rules_url = $23,
           verification_status = $24,
           confidence = $25,
           source_artifact_id = $26,
           active = true
       WHERE id = $1`,
      [
        facilityId,
        facility.key,
        facility.kind,
        facility.name,
        facility.address,
        facility.location?.lat ?? null,
        facility.location?.lon ?? null,
        JSON.stringify(facility.externalIds),
        facility.acceptedMaterials,
        facility.acceptedContainers,
        JSON.stringify(openingHours),
        facility.openingHours.timezone,
        hoursArtifactId,
        facility.access.scope,
        facility.access.requiresProof,
        JSON.stringify(accessRules),
        accessArtifactId,
        facility.operationalStatus.state,
        facility.operationalStatus.observedAt,
        operationalArtifactId,
        locationArtifactId,
        facility.operatorName,
        facility.rulesUrl,
        facility.quality.verificationStatus,
        facility.quality.confidence,
        primaryArtifactId,
      ],
    );
    if (result.rowCount !== 1) throw new Error(`Canonical facility ${facilityId} not found`);
  }
}
