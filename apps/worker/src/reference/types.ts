export type ReferenceDataset = 'TERYT_TERC' | 'TERYT_SIMC' | 'TERYT_ULIC' | 'PRG_ADDRESS';

export interface ReferenceImportMetadata {
  dataset: ReferenceDataset;
  sourceVersion: string;
  sourceUri?: string | null;
  sourceSha256?: string | null;
  scopeKey?: string | null;
  fullSnapshot?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ReferenceRejectedRow {
  rowKey: string;
  reason: string;
  details?: Record<string, unknown>;
}

export interface ReferenceImportStats {
  runId: string;
  inserted: number;
  updated: number;
  unchanged: number;
  deactivated: number;
  rejected: number;
  rejectedRows: ReferenceRejectedRow[];
}

export interface TercRow {
  woj: string;
  pow: string;
  gmi: string;
  rodz: string;
  name: string;
  nameAdditional: string;
  stateDate: string;
}

export interface SimcRow {
  woj: string;
  pow: string;
  gmi: string;
  rodzGmi: string;
  localityTypeCode: string;
  basic: string;
  name: string;
  simc: string;
  parentSimc: string | null;
  stateDate: string;
}

export interface UlicRow {
  woj: string;
  pow: string;
  gmi: string;
  rodzGmi: string;
  simc: string;
  ulic: string;
  streetType: string;
  name1: string;
  name2: string;
  stateDate: string;
}

export type PrgCrs = 'EPSG:4326' | 'EPSG:2180';

export interface PrgAddressRow {
  prgId: string;
  municipalityTerc: string;
  simc: string;
  ulic: string | null;
  buildingNumber: string;
  postalCode: string | null;
  status: string | null;
  validFrom: string | null;
  validTo: string | null;
  sourceUpdatedAt: string | null;
  x: number;
  y: number;
  crs: PrgCrs;
}

export function municipalityTercCode(row: Pick<TercRow, 'woj' | 'pow' | 'gmi' | 'rodz'>): string {
  return `${row.woj}${row.pow}${row.gmi}${row.rodz}`;
}

export function simcMunicipalityTerc(row: Pick<SimcRow, 'woj' | 'pow' | 'gmi' | 'rodzGmi'>): string {
  return `${row.woj}${row.pow}${row.gmi}${row.rodzGmi}`;
}

export function ulicMunicipalityTerc(row: Pick<UlicRow, 'woj' | 'pow' | 'gmi' | 'rodzGmi'>): string {
  return `${row.woj}${row.pow}${row.gmi}${row.rodzGmi}`;
}
