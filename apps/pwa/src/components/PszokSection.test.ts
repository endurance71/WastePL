import { describe, expect, it } from 'vitest';
import { resolveTrustedFacilityLocation } from '@wastepl/domain';
import type { FacilityItem } from '../types/api.js';

describe('PszokSection Geocoding & Navigation Logic', () => {
  const facilityWithoutLocation: FacilityItem = {
    id: 'f-bedzino',
    canonicalKey: 'pl-3209012-pszok-bedzino-17',
    kind: 'PSZOK',
    name: 'PSZOK Będzino, Będzino 17',
    address: 'Będzino 17, 76-037 Będzino',
    location: null,
    openingHours: null,
    access: null,
    acceptedMaterials: ['PAPER', 'GLASS'],
    operatorName: 'GZK Będzino',
    rulesUrl: null,
    quality: {
      verificationStatus: 'OFFICIAL_SOURCE',
      confidence: 0.98,
      warnings: ['TRUSTED_COORDINATES_NOT_PUBLISHED_IN_SOURCE'],
    },
  };

  const facilityWithLocation: FacilityItem = {
    id: 'f-koszalin',
    canonicalKey: 'pl-3261011-pszok-komunalna-5',
    kind: 'PSZOK',
    name: 'PSZOK – ul. Komunalna 5',
    address: 'ul. Komunalna 5, Koszalin',
    location: {
      lat: 54.212266,
      lon: 16.183616,
    },
    openingHours: null,
    access: null,
    acceptedMaterials: ['PAPER', 'GLASS'],
    operatorName: 'PGK Koszalin',
    rulesUrl: null,
    quality: {
      verificationStatus: 'OFFICIAL_SOURCE',
      confidence: 0.98,
      warnings: [],
    },
  };

  it('enriches facility without location using trusted PRG geocoding registry', () => {
    const trusted = resolveTrustedFacilityLocation(facilityWithoutLocation.canonicalKey);
    expect(trusted).not.toBeNull();
    expect(trusted?.lat).toBe(54.210061);
    expect(trusted?.lon).toBe(15.99209);
    expect(trusted?.provider).toBe('GUGiK_PRG');
    expect(trusted?.referenceId).toBe('320901_2.0002.17');
  });

  it('generates valid Google Maps navigation URL from resolved PRG coordinates', () => {
    const trusted = resolveTrustedFacilityLocation(facilityWithoutLocation.canonicalKey);
    const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${trusted!.lat},${trusted!.lon}`;
    expect(navUrl).toBe('https://www.google.com/maps/dir/?api=1&destination=54.210061,15.99209');
  });

  it('generates valid OpenStreetMap URL from resolved PRG coordinates', () => {
    const trusted = resolveTrustedFacilityLocation(facilityWithoutLocation.canonicalKey);
    const osmUrl = `https://www.openstreetmap.org/?mlat=${trusted!.lat}&mlon=${trusted!.lon}#map=16/${trusted!.lat}/${trusted!.lon}`;
    expect(osmUrl).toBe('https://www.openstreetmap.org/?mlat=54.210061&mlon=15.99209#map=16/54.210061/15.99209');
  });

  it('preserves existing location if published directly by operator source', () => {
    expect(facilityWithLocation.location).toEqual({
      lat: 54.212266,
      lon: 16.183616,
    });
  });

  it('safely resolves null for unregistered or null facility keys', () => {
    expect(resolveTrustedFacilityLocation(null)).toBeNull();
    expect(resolveTrustedFacilityLocation('non-existent-pszok')).toBeNull();
  });
});
