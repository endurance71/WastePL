import { describe, expect, it } from 'vitest';
import {
  getAllTrustedPilotPszokLocations,
  isTrustedPilotFacilityKey,
  resolveTrustedFacilityLocation,
  TRUSTED_PILOT_PSZOK_LOCATIONS,
} from './facility-geocoding.js';

describe('Trusted Facility Geocoding Registry', () => {
  it('contains exactly 8 pilot PSZOK locations covering all 8 municipalities', () => {
    const keys = Object.keys(TRUSTED_PILOT_PSZOK_LOCATIONS);
    expect(keys).toHaveLength(8);
    expect(keys).toContain('pl-3261011-pszok-komunalna-5');
    expect(keys).toContain('pl-3209042-pszok-manowo-komunalna-5');
    expect(keys).toContain('pl-3209012-pszok-bedzino-17');
    expect(keys).toContain('pl-3209063-pszok-polanow-stawna-2');
    expect(keys).toContain('pl-3201043-pszok-tychowo-dolna-8');
    expect(keys).toContain('pl-3209073-pszok-sianow-lubuszan-80');
    expect(keys).toContain('pl-3209082-pszok-chalupy-13b');
    expect(keys).toContain('pl-3209033-pszok-boboliczki');
  });

  it('all coordinates lie strictly within the geographic bounds of Koszalin county region', () => {
    for (const [key, loc] of Object.entries(TRUSTED_PILOT_PSZOK_LOCATIONS)) {
      expect(loc.lat, `${key} latitude within West Pomerania bounds`).toBeGreaterThanOrEqual(53.8);
      expect(loc.lat, `${key} latitude within West Pomerania bounds`).toBeLessThanOrEqual(54.4);
      expect(loc.lon, `${key} longitude within West Pomerania bounds`).toBeGreaterThanOrEqual(15.8);
      expect(loc.lon, `${key} longitude within West Pomerania bounds`).toBeLessThanOrEqual(16.9);
      expect(loc.referenceId.length, `${key} referenceId`).toBeGreaterThan(5);
      expect(loc.confidence, `${key} confidence`).toBeGreaterThanOrEqual(0.9);
      expect(['GUGiK_PRG', 'OPERATOR_PUBLISHED']).toContain(loc.provider);
    }
  });

  it('resolves trusted facility locations correctly and safely returns null for unknown keys', () => {
    const bedzino = resolveTrustedFacilityLocation('pl-3209012-pszok-bedzino-17');
    expect(bedzino).not.toBeNull();
    expect(bedzino?.lat).toBe(54.210061);
    expect(bedzino?.lon).toBe(15.99209);
    expect(bedzino?.referenceId).toBe('320901_2.0002.17');

    expect(resolveTrustedFacilityLocation('unknown-key')).toBeNull();
    expect(resolveTrustedFacilityLocation(null)).toBeNull();
    expect(resolveTrustedFacilityLocation(undefined)).toBeNull();
  });

  it('identifies valid pilot facility keys with isTrustedPilotFacilityKey', () => {
    expect(isTrustedPilotFacilityKey('pl-3209012-pszok-bedzino-17')).toBe(true);
    expect(isTrustedPilotFacilityKey('unknown-facility')).toBe(false);
  });

  it('returns all 8 locations via getAllTrustedPilotPszokLocations', () => {
    const all = getAllTrustedPilotPszokLocations();
    expect(all).toHaveLength(8);
    expect(all.every((item) => item.canonicalKey && item.lat && item.lon)).toBe(true);
  });
});
