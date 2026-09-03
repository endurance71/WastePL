export interface ApiMunicipality {
  id: string;
  terc: string;
  name: string;
}

export interface ApiAddress {
  id: string;
  prgId: string | null;
  canonicalText: string;
  municipality: ApiMunicipality;
}

export interface AddressCandidate {
  address: ApiAddress;
  score: number;
}

export interface AddressResolveResponse {
  query: string;
  items: AddressCandidate[];
}

export interface CollectionEvent {
  date: string;
  fraction: string;
  status: 'SCHEDULED' | 'CHANGED' | 'CANCELLED' | 'COMPLETED';
}

export interface CollectionSourceProvenance {
  url: string;
  format: string;
  artifactId: string;
  sha256: string;
  parserKey: string | null;
  parserVersion: string | null;
}

export interface CollectionQuality {
  verificationStatus: 'VERIFIED' | 'OFFICIAL_SOURCE' | 'UNVERIFIED' | 'REVIEW_REQUIRED';
  confidence: number;
  retrievedAt: string;
}

export interface CollectionScheduleResponse {
  address: ApiAddress;
  municipality: ApiMunicipality;
  serviceArea: {
    id: string;
    name: string;
  };
  events: CollectionEvent[];
  source: CollectionSourceProvenance;
  quality: CollectionQuality;
}

export interface FacilityOpeningHourInterval {
  opens: string;
  closes: string;
}

export interface FacilityOpeningHours {
  timezone: string;
  weekly: Array<{
    day: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
    intervals: FacilityOpeningHourInterval[];
  }>;
  exceptions: Array<{
    date: string;
    closed: boolean;
    intervals: FacilityOpeningHourInterval[];
    note?: string;
  }>;
}

export interface FacilityItem {
  id: string;
  canonicalKey?: string | null;
  kind: 'PSZOK' | 'APTEKA' | 'RECYCLING_POINT';
  name: string;
  address: string;
  location: {
    lat: number;
    lon: number;
  } | null;
  openingHours: FacilityOpeningHours | null;
  access: {
    scope?: string;
    requiresProof?: boolean;
    notes?: string[];
  } | null;
  acceptedMaterials: string[];
  operatorName: string | null;
  rulesUrl: string | null;
  quality: {
    verificationStatus: string;
    confidence: number;
    warnings: string[];
  };
}

export interface FacilitiesResponse {
  items: FacilityItem[];
}
