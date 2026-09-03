export interface TrustedFacilityLocation {
  lat: number;
  lon: number;
  provider: 'GUGiK_PRG' | 'OPERATOR_PUBLISHED';
  referenceId: string;
  sourceDescription: string;
  confidence: number;
}

export const TRUSTED_PILOT_PSZOK_LOCATIONS: Record<string, TrustedFacilityLocation> = {
  'pl-3261011-pszok-komunalna-5': {
    lat: 54.181975,
    lon: 16.196550,
    provider: 'GUGiK_PRG',
    referenceId: '326101_1.0016.5',
    sourceDescription: 'GUGiK PRG / PGK Koszalin ul. Komunalna 5',
    confidence: 1.0,
  },
  'pl-3209042-pszok-manowo-komunalna-5': {
    lat: 54.181975,
    lon: 16.196550,
    provider: 'GUGiK_PRG',
    referenceId: '326101_1.0016.5',
    sourceDescription: 'GUGiK PRG / Porozumienie PGK Koszalin ul. Komunalna 5',
    confidence: 1.0,
  },
  'pl-3209012-pszok-bedzino-17': {
    lat: 54.210061,
    lon: 15.992090,
    provider: 'GUGiK_PRG',
    referenceId: '320901_2.0002.17',
    sourceDescription: 'GUGiK PRG punkt adresowy Będzino 17',
    confidence: 1.0,
  },
  'pl-3209063-pszok-polanow-stawna-2': {
    lat: 54.116111,
    lon: 16.682412,
    provider: 'GUGiK_PRG',
    referenceId: '320906_4.0001.2',
    sourceDescription: 'GUGiK PRG punkt adresowy ul. Stawna 2, Polanów',
    confidence: 1.0,
  },
  'pl-3201043-pszok-tychowo-dolna-8': {
    lat: 53.915871,
    lon: 16.247403,
    provider: 'GUGiK_PRG',
    referenceId: '320104_4.0001.8',
    sourceDescription: 'GUGiK PRG punkt adresowy ul. Dolna 8, Tychowo',
    confidence: 1.0,
  },
  'pl-3209073-pszok-sianow-lubuszan-80': {
    lat: 54.224536,
    lon: 16.322462,
    provider: 'GUGiK_PRG',
    referenceId: '320907_4.0001.80',
    sourceDescription: 'GUGiK PRG punkt adresowy ul. Łubuszan 80, Sianów',
    confidence: 1.0,
  },
  'pl-3209082-pszok-chalupy-13b': {
    lat: 54.133252,
    lon: 16.187536,
    provider: 'GUGiK_PRG',
    referenceId: '320908_2.0004.13B',
    sourceDescription: 'GUGiK PRG punkt adresowy Chałupy 13B',
    confidence: 1.0,
  },
  'pl-3209033-pszok-boboliczki': {
    lat: 53.991194,
    lon: 16.563781,
    provider: 'GUGiK_PRG',
    referenceId: '320903_5.0003',
    sourceDescription: 'GUGiK PRG obręb Boboliczki działka PSZOK',
    confidence: 0.95,
  },
};

export function resolveTrustedFacilityLocation(
  canonicalKey: string | null | undefined,
): TrustedFacilityLocation | null {
  if (!canonicalKey) return null;
  return TRUSTED_PILOT_PSZOK_LOCATIONS[canonicalKey] ?? null;
}

export function isTrustedPilotFacilityKey(key: string): boolean {
  return key in TRUSTED_PILOT_PSZOK_LOCATIONS;
}

export function getAllTrustedPilotPszokLocations(): Array<{ canonicalKey: string } & TrustedFacilityLocation> {
  return Object.entries(TRUSTED_PILOT_PSZOK_LOCATIONS).map(([canonicalKey, loc]) => ({
    canonicalKey,
    ...loc,
  }));
}
