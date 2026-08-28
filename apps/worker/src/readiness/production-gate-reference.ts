import type { PrgAddressRow, SimcRow, TercRow, UlicRow } from '../reference/types.js';

const STATE_DATE = '2026-08-28';
const SOURCE_UPDATED_AT = '2026-08-28T00:00:00Z';

/**
 * Deterministic, official-shaped reference input for the fixture-independent
 * production gate. IDs prefixed by `wastepl-gate-`, ULIC codes 99001–99007 and
 * Tychowo SIMC codes 8800001–8800030 are TEST-ONLY identities and must never be
 * presented as official PRG/TERYT identifiers.
 *
 * Production municipal collection parsing resolves names against the imported
 * TERYT backbone at runtime; these test-only SIMC values deliberately verify
 * that no municipality-specific SIMC list is hardcoded in the parser.
 *
 * The gate exercises PgOfficialReferenceImporter rather than SQL address seeds.
 * XML/GML syntax parsing is covered independently by parser tests.
 */
export function productionGateTercRows(): TercRow[] {
  return [
    { woj: '32', pow: '61', gmi: '01', rodz: '1', name: 'Koszalin', nameAdditional: 'gmina miejska', stateDate: STATE_DATE },
    { woj: '32', pow: '09', gmi: '03', rodz: '3', name: 'Bobolice', nameAdditional: 'gmina miejsko-wiejska', stateDate: STATE_DATE },
    { woj: '32', pow: '09', gmi: '07', rodz: '3', name: 'Sianów', nameAdditional: 'gmina miejsko-wiejska', stateDate: STATE_DATE },
    { woj: '32', pow: '09', gmi: '04', rodz: '2', name: 'Manowo', nameAdditional: 'gmina wiejska', stateDate: STATE_DATE },
    { woj: '32', pow: '09', gmi: '08', rodz: '2', name: 'Świeszyno', nameAdditional: 'gmina wiejska', stateDate: STATE_DATE },
    { woj: '32', pow: '09', gmi: '01', rodz: '2', name: 'Będzino', nameAdditional: 'gmina wiejska', stateDate: STATE_DATE },
    { woj: '32', pow: '09', gmi: '06', rodz: '3', name: 'Polanów', nameAdditional: 'gmina miejsko-wiejska', stateDate: STATE_DATE },
    { woj: '32', pow: '01', gmi: '04', rodz: '3', name: 'Tychowo', nameAdditional: 'gmina miejsko-wiejska', stateDate: STATE_DATE },
  ];
}

const TYCHOWO_SAFE_LOCALITIES = [
  'Buczki',
  'Czarnkowo',
  'Dzięciołowo',
  'Giżałki',
  'Pobądź',
  'Smęcino',
  'Solno',
  'Tyczewo',
  'Wełdkowo',
  'Wełdkówko',
  'Bukowo',
  'Bukówko',
  'Dobrowo',
  'Dobrówko',
  'Modrolas',
  'Podborsko',
  'Retowo',
  'Skarszewice',
  'Słonino',
  'Zaspy Wielkie',
  'Doble',
  'Kikowo',
  'Krosinko',
  'Liśnica',
  'Nowe Dębno',
  'Rudno',
  'Sławomierz',
  'Trzebiszyn',
  'Trzebiec',
  'Żukówek',
] as const;

export function productionGateSimcRows(): SimcRow[] {
  const base: SimcRow[] = [
    { woj: '32', pow: '61', gmi: '01', rodzGmi: '1', localityTypeCode: '01', basic: '1', name: 'Koszalin', simc: '0949448', parentSimc: null, stateDate: STATE_DATE },
    { woj: '32', pow: '09', gmi: '04', rodzGmi: '2', localityTypeCode: '01', basic: '1', name: 'Bonin', simc: '0308040', parentSimc: null, stateDate: STATE_DATE },
    { woj: '32', pow: '09', gmi: '04', rodzGmi: '2', localityTypeCode: '01', basic: '1', name: 'Dęborogi', simc: '0308212', parentSimc: null, stateDate: STATE_DATE },
    { woj: '32', pow: '09', gmi: '04', rodzGmi: '2', localityTypeCode: '01', basic: '1', name: 'Policko', simc: '0308229', parentSimc: null, stateDate: STATE_DATE },
    { woj: '32', pow: '09', gmi: '04', rodzGmi: '2', localityTypeCode: '01', basic: '1', name: 'Wyszebórz', simc: '0308206', parentSimc: null, stateDate: STATE_DATE },
  ];
  const tychowo = TYCHOWO_SAFE_LOCALITIES.map((name, index): SimcRow => ({
    woj: '32',
    pow: '01',
    gmi: '04',
    rodzGmi: '3',
    localityTypeCode: '01',
    basic: '1',
    name,
    simc: `88${String(index + 1).padStart(5, '0')}`,
    parentSimc: null,
    stateDate: STATE_DATE,
  }));
  return [...base, ...tychowo];
}

export function productionGateUlicRows(): UlicRow[] {
  const base = { woj: '32', pow: '61', gmi: '01', rodzGmi: '1', simc: '0949448', streetType: 'ul.', stateDate: STATE_DATE } as const;
  return [
    { ...base, ulic: '11926', name1: 'Maja', name2: '1' },
    { ...base, ulic: '99001', name1: 'Marca', name2: '4' },
    { ...base, ulic: '99002', name1: 'Asnyka', name2: 'Adama' },
    { ...base, ulic: '99003', name1: 'Krajowej', name2: 'Aleja Armii' },
    { ...base, ulic: '99004', name1: 'Cassino', name2: 'Aleja Monte' },
    { ...base, ulic: '99005', name1: 'Bałtycka', name2: '' },
    { ...base, ulic: '99006', name1: 'II', name2: 'Bogusława' },
    { ...base, ulic: '99007', name1: 'Frezji', name2: '' },
  ];
}

interface KoszalinAddressFixture {
  street: string;
  ulic: string;
  number: string;
  postalCode: string | null;
}

const KOSZALIN_ADDRESSES: KoszalinAddressFixture[] = [
  { street: '1 Maja', ulic: '11926', number: '3', postalCode: null },
  { street: '1 Maja', ulic: '11926', number: '8', postalCode: '75-800' },
  { street: '4 Marca', ulic: '99001', number: '10', postalCode: null },
  { street: 'Adama Asnyka', ulic: '99002', number: '11', postalCode: null },
  { street: 'Adama Asnyka', ulic: '99002', number: '14', postalCode: null },
  { street: 'Aleja Armii Krajowej', ulic: '99003', number: '9', postalCode: null },
  { street: 'Aleja Monte Cassino', ulic: '99004', number: '14', postalCode: null },
  { street: 'Bałtycka', ulic: '99005', number: '1', postalCode: null },
  { street: 'Bogusława II', ulic: '99006', number: '1-3', postalCode: null },
  { street: 'Frezji', ulic: '99007', number: '11', postalCode: null },
];

const BONIN_BUILDINGS = [
  '2', '3A', '4', '5', '6', '7A', '7B', '7C', '8', '9', '10A', '11',
  '11C', '11D', '11E', '14', '16', '24A', '29', '44C', '48',
] as const;

export function productionGatePrgRows(): PrgAddressRow[] {
  const koszalin = KOSZALIN_ADDRESSES.map((address, index): PrgAddressRow => ({
    prgId: `wastepl-gate-koszalin-${index + 1}`,
    municipalityTerc: '3261011',
    simc: '0949448',
    ulic: address.ulic,
    buildingNumber: address.number,
    postalCode: address.postalCode,
    status: 'EXISTING',
    validFrom: '2026-01-01',
    validTo: null,
    sourceUpdatedAt: SOURCE_UPDATED_AT,
    x: 16.17 + index * 0.001,
    y: 54.18 + index * 0.001,
    crs: 'EPSG:4326',
  }));

  const bonin = BONIN_BUILDINGS.map((number, index): PrgAddressRow => ({
    prgId: `wastepl-gate-bonin-${index + 1}`,
    municipalityTerc: '3209042',
    simc: '0308040',
    ulic: null,
    buildingNumber: number,
    postalCode: '76-009',
    status: 'EXISTING',
    validFrom: '2026-01-01',
    validTo: null,
    sourceUpdatedAt: SOURCE_UPDATED_AT,
    x: 16.24 + index * 0.0002,
    y: 54.15 + index * 0.0002,
    crs: 'EPSG:4326',
  }));

  return [...koszalin, ...bonin];
}

export const PRODUCTION_GATE_REFERENCE_COUNTS = {
  municipalities: 8,
  localities: 35,
  streets: 8,
  addresses: 31,
  goldenAddresses: 30,
} as const;
