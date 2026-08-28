import { describe, expect, it } from 'vitest';
import { assertLiveGateIsolation, classifyLiveSourceOutcome } from './live-source-staging-gate.js';

describe('live-source staging gate policy', () => {
  it('classifies parseable byte drift separately from parser failure', () => {
    expect(classifyLiveSourceOutcome({
      fetchFailed: false,
      processingOutcome: 'PUBLISHED',
      sha256: 'new',
      baselineSha256: 'old',
    })).toBe('CHANGED_BUT_PARSEABLE');

    expect(classifyLiveSourceOutcome({
      fetchFailed: false,
      processingOutcome: 'PUBLISHED',
      sha256: 'same',
      baselineSha256: 'same',
    })).toBe('HEALTHY');

    expect(classifyLiveSourceOutcome({
      fetchFailed: true,
      processingOutcome: null,
      sha256: null,
      baselineSha256: null,
    })).toBe('FETCH_FAILED');

    expect(classifyLiveSourceOutcome({
      fetchFailed: false,
      processingOutcome: 'WAITING_FOR_COMPANION',
      sha256: 'x',
      baselineSha256: null,
    })).toBe('WAITING_FOR_COMPANION');
  });

  it('rejects production-like database and bucket targets', () => {
    expect(() => assertLiveGateIsolation({
      liveDatabaseUrl: 'postgresql://wastepl:wastepl@localhost:5432/wastepl_live_source_gate',
      ordinaryDatabaseUrl: 'postgresql://wastepl:wastepl@localhost:5432/wastepl',
      bucket: 'wastepl-live-source-123',
    })).not.toThrow();

    expect(() => assertLiveGateIsolation({
      liveDatabaseUrl: 'postgresql://wastepl:wastepl@localhost:5432/wastepl',
      ordinaryDatabaseUrl: 'postgresql://wastepl:wastepl@localhost:5432/wastepl',
      bucket: 'wastepl-live-source-123',
    })).toThrow(/LIVE_GATE_UNSAFE_DATABASE/);

    expect(() => assertLiveGateIsolation({
      liveDatabaseUrl: 'postgresql://wastepl:wastepl@localhost:5432/wastepl_live_source_gate',
      ordinaryDatabaseUrl: 'postgresql://wastepl:wastepl@localhost:5432/wastepl',
      bucket: 'wastepl-artifacts',
    })).toThrow(/LIVE_GATE_UNSAFE_BUCKET/);
  });
});
