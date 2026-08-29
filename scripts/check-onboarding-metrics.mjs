import { access, readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = process.cwd();
const workerRequire = createRequire(new URL('../apps/worker/package.json', import.meta.url));
const ajvModule = workerRequire('ajv/dist/2020');
const Ajv2020 = ajvModule.default ?? ajvModule;

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

function parseVersion(value) {
  const match = /^(\d{4})\.(\d+)$/.exec(value);
  if (!match) throw new Error(`Invalid manifest version ${value}`);
  return [Number(match[1]), Number(match[2])];
}

function compareVersions(left, right) {
  const [ly, ln] = parseVersion(left);
  const [ry, rn] = parseVersion(right);
  return ly - ry || ln - rn;
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function assertSameArray(actual, expected, label) {
  const a = JSON.stringify([...actual].sort());
  const e = JSON.stringify([...expected].sort());
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : Number((numerator / denominator).toFixed(4));
}

const schema = await readJson('schemas/onboarding-metrics-v0.1.schema.json');
const metrics = await readJson('metrics/onboarding/pilot-koszalin-region-v0.1.json');
const checkedSummary = await readJson('metrics/onboarding/pilot-koszalin-region-summary-v0.1.json');

if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
  throw new Error('Onboarding metrics schema must use JSON Schema draft 2020-12');
}
if (schema.properties?.schemaVersion?.const !== '0.1.0') {
  throw new Error('Onboarding metrics schema version must stay 0.1.0');
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
if (!validate(metrics)) {
  const details = (validate.errors ?? [])
    .map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
    .join('; ');
  throw new Error(`Onboarding metrics must validate: ${details}`);
}

const manifestFiles = (await readdir(path.join(root, 'manifests')))
  .map((name) => {
    const match = /^pilot-koszalin-region-(\d{4}\.\d+)\.json$/.exec(name);
    return match ? { name, version: match[1] } : null;
  })
  .filter(Boolean)
  .sort((a, b) => compareVersions(a.version, b.version));

if (manifestFiles.length === 0) throw new Error('No pilot-koszalin-region manifests found');

const manifests = [];
for (const entry of manifestFiles) {
  const manifest = await readJson(`manifests/${entry.name}`);
  if (manifest.manifestId !== metrics.pilotManifestId || manifest.version !== entry.version) continue;
  manifests.push(manifest);
}
if (manifests.length === 0) throw new Error(`No manifests found for ${metrics.pilotManifestId}`);

const latestManifest = manifests.at(-1);
const firstActiveVersion = new Map();
const sourceHistory = new Map();

for (const manifest of manifests) {
  for (const municipality of manifest.municipalities) {
    for (const source of municipality.sources) {
      const prior = sourceHistory.get(source.key);
      if (prior && (prior.terc !== municipality.terc || prior.dataType !== source.dataType)) {
        throw new Error(`Source identity drift for ${source.key}`);
      }
      sourceHistory.set(source.key, {
        terc: municipality.terc,
        municipalityName: municipality.name,
        dataType: source.dataType,
        parserKey: source.parserKey,
      });
      if (source.status === 'ACTIVE' && !firstActiveVersion.has(source.key)) {
        firstActiveVersion.set(source.key, manifest.version);
      }
    }
  }
}

const latestActive = new Map();
for (const municipality of latestManifest.municipalities) {
  for (const source of municipality.sources) {
    if (source.status !== 'ACTIVE') continue;
    latestActive.set(source.key, {
      terc: municipality.terc,
      municipalityName: municipality.name,
      dataType: source.dataType,
      parserKey: source.parserKey,
    });
  }
}

const recordIds = new Set();
const coveredSourceKeys = new Map();
for (const record of metrics.records) {
  if (recordIds.has(record.id)) throw new Error(`Duplicate onboarding metrics record id ${record.id}`);
  recordIds.add(record.id);

  const activationVersions = new Set();
  const expectedParserKeys = [];
  for (const sourceKey of record.sourceKeys) {
    if (coveredSourceKeys.has(sourceKey)) {
      throw new Error(`Source ${sourceKey} is covered by both ${coveredSourceKeys.get(sourceKey)} and ${record.id}`);
    }
    coveredSourceKeys.set(sourceKey, record.id);

    const source = sourceHistory.get(sourceKey);
    if (!source) throw new Error(`Metrics record ${record.id} references unknown source ${sourceKey}`);
    if (source.terc !== record.terc || source.dataType !== record.dataType) {
      throw new Error(`Metrics record ${record.id} source ${sourceKey} does not match TERC/dataType`);
    }
    const activated = firstActiveVersion.get(sourceKey);
    if (!activated) throw new Error(`Metrics record ${record.id} references source ${sourceKey} that was never ACTIVE`);
    activationVersions.add(activated);
    if (source.parserKey) expectedParserKeys.push(source.parserKey);
  }
  if (activationVersions.size !== 1) {
    throw new Error(`Metrics record ${record.id} combines sources activated in different manifest versions`);
  }
  const actualActivation = [...activationVersions][0];
  if (record.activatedInManifestVersion !== actualActivation) {
    throw new Error(
      `Metrics record ${record.id} activatedInManifestVersion=${record.activatedInManifestVersion}, actual=${actualActivation}`,
    );
  }
  assertSameArray(record.parserKeys, sortedUnique(expectedParserKeys), `Metrics record ${record.id} parserKeys`);

  const isFutureActivation =
    compareVersions(record.activatedInManifestVersion, metrics.prospectiveRequiredAfterManifestVersion) > 0;
  if (isFutureActivation && record.measurementMode !== 'PROSPECTIVE') {
    throw new Error(`Future activation ${record.id} must use PROSPECTIVE measurement mode`);
  }

  for (const [phaseName, phase] of Object.entries(record.effort)) {
    if (record.measurementMode === 'PROSPECTIVE' && phase.basis !== 'PROSPECTIVE_TIMER') {
      throw new Error(`Prospective record ${record.id} phase ${phaseName} must be timed prospectively`);
    }
    if (record.measurementMode === 'HISTORICAL_BACKFILL' && phase.basis === 'PROSPECTIVE_TIMER') {
      throw new Error(`Historical record ${record.id} may not claim a prospective timer`);
    }
  }

  for (const evidenceRef of record.evidenceRefs) {
    const resolved = path.resolve(root, evidenceRef);
    if (!resolved.startsWith(`${root}${path.sep}`)) {
      throw new Error(`Metrics record ${record.id} evidence leaves repository: ${evidenceRef}`);
    }
    await access(resolved);
  }
}

for (const [sourceKey, source] of latestActive) {
  const recordId = coveredSourceKeys.get(sourceKey);
  if (!recordId) throw new Error(`Latest ACTIVE source ${sourceKey} has no onboarding metrics record`);
  const record = metrics.records.find((entry) => entry.id === recordId);
  if (record.terc !== source.terc || record.dataType !== source.dataType) {
    throw new Error(`Latest ACTIVE source ${sourceKey} is covered by an incompatible metrics record`);
  }
}

const adapterClasses = ['REUSED_UNCHANGED', 'REUSED_WITH_CONFIGURATION', 'EXTENDED_EXISTING', 'NEW_ADAPTER'];
const adapterCounts = Object.fromEntries(adapterClasses.map((value) => [value, 0]));
for (const record of metrics.records) adapterCounts[record.adapterReuseClass] += 1;

const phases = metrics.records.flatMap((record) => Object.values(record.effort));
const knownPhases = phases.filter((phase) => phase.basis !== 'UNKNOWN');
const fullyMeasuredRecords = metrics.records.filter((record) =>
  Object.values(record.effort).every((phase) => phase.basis !== 'UNKNOWN'),
);

const firstImportMeasured = metrics.records.filter((record) => record.firstImport.status !== 'NOT_MEASURED');
const firstImportAutomatic = firstImportMeasured.filter((record) => record.firstImport.automatic === true);
const firstImportManual = firstImportMeasured.filter((record) => (record.firstImport.manualInterventions ?? 0) > 0);

const repeatMeasured = metrics.records.filter((record) => record.repeatUpdate.status !== 'NOT_MEASURED');
const repeatAutomatic = repeatMeasured.filter((record) => record.repeatUpdate.automatic === true);

const nonNewAdapterRecords = metrics.records.filter((record) => record.adapterReuseClass !== 'NEW_ADAPTER').length;
const allEffortKnown = knownPhases.length === phases.length;

const computedSummary = {
  schemaVersion: '0.1.0',
  pilotManifestId: metrics.pilotManifestId,
  throughManifestVersion: latestManifest.version,
  activationRecords: metrics.records.length,
  historicalBackfillRecords: metrics.records.filter((record) => record.measurementMode === 'HISTORICAL_BACKFILL').length,
  prospectiveRecords: metrics.records.filter((record) => record.measurementMode === 'PROSPECTIVE').length,
  effortMeasurement: {
    phaseObservations: phases.length,
    knownPhaseObservations: knownPhases.length,
    fullyMeasuredRecords: fullyMeasuredRecords.length,
    coverageRate: ratio(knownPhases.length, phases.length),
    totalKnownHumanMinutes: allEffortKnown
      ? knownPhases.reduce((sum, phase) => sum + phase.minutes, 0)
      : null,
    interpretation:
      allEffortKnown
        ? 'All required human-effort phases are measured.'
        : 'Human-time economics are not yet estimable from the full sample because some phases are UNKNOWN; no missing time is imputed.',
  },
  adapterReuse: {
    counts: adapterCounts,
    nonNewAdapterRecords,
    observedReuseRate: ratio(nonNewAdapterRecords, metrics.records.length),
    sampleWarning: 'Small pilot sample; do not extrapolate this rate to national onboarding economics.',
  },
  firstImport: {
    measuredRecords: firstImportMeasured.length,
    automaticRecords: firstImportAutomatic.length,
    automaticSuccessRate: ratio(firstImportAutomatic.length, firstImportMeasured.length),
    recordsWithManualIntervention: firstImportManual.length,
    manualInterventionRate: ratio(firstImportManual.length, firstImportMeasured.length),
    targetManualInterventionRate: '<0.25',
    targetResult:
      firstImportMeasured.length > 0 && firstImportManual.length / firstImportMeasured.length < 0.25 ? 'PASS' : 'FAIL',
  },
  repeatUpdate: {
    measuredRecords: repeatMeasured.length,
    automaticRecords: repeatAutomatic.length,
    automationRate: ratio(repeatAutomatic.length, repeatMeasured.length),
    targetAutomationRate: '>=0.90',
    targetResult:
      repeatMeasured.length > 0 && repeatAutomatic.length / repeatMeasured.length >= 0.9 ? 'PASS' : 'FAIL',
    sampleWarning: 'Only source/data-type records with explicit repeat-update evidence are included in the denominator.',
  },
};

if (JSON.stringify(checkedSummary) !== JSON.stringify(computedSummary)) {
  console.error('Checked onboarding summary is stale.');
  console.error(JSON.stringify(computedSummary, null, 2));
  throw new Error('metrics/onboarding/pilot-koszalin-region-summary-v0.1.json must match computed metrics');
}

console.log(
  `Onboarding metrics OK: ${latestActive.size} ACTIVE sources covered by ${metrics.records.length} activation records; ` +
  `first-import manual intervention ${computedSummary.firstImport.recordsWithManualIntervention}/${computedSummary.firstImport.measuredRecords}; ` +
  `repeat automation ${computedSummary.repeatUpdate.automaticRecords}/${computedSummary.repeatUpdate.measuredRecords}; ` +
  `human effort coverage ${computedSummary.effortMeasurement.knownPhaseObservations}/${computedSummary.effortMeasurement.phaseObservations}.`,
);
