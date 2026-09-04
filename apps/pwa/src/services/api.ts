import type {
  AddressCandidate,
  AddressResolveResponse,
  ApiAddress,
  CollectionScheduleResponse,
  FacilitiesResponse,
  FacilityItem,
} from '../types/api.js';

const STORAGE_KEY_SELECTED_ADDRESS = 'wastepl_selected_address';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export async function searchAddress(query: string): Promise<AddressCandidate[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const response = await fetch(`/v1/addresses/resolve?query=${encodeURIComponent(trimmed)}`);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new ApiError(
      errorBody.message || 'Błąd wyszukiwania adresu',
      errorBody.code || 'SEARCH_FAILED',
      response.status,
    );
  }

  const data: AddressResolveResponse = await response.json();
  return data.items || [];
}

export async function getCollection(
  addressId: string,
  days: number = 90,
): Promise<CollectionScheduleResponse> {
  const response = await fetch(
    `/v1/collection?addressId=${encodeURIComponent(addressId)}&days=${days}`,
  );
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new ApiError(
      errorBody.message || 'Błąd pobierania harmonogramu',
      errorBody.code || 'COLLECTION_FETCH_FAILED',
      response.status,
    );
  }

  return response.json();
}

export async function getFacilities(terc?: string): Promise<FacilityItem[]> {
  const url = terc ? `/v1/facilities?terc=${encodeURIComponent(terc)}&kind=PSZOK` : '/v1/facilities?kind=PSZOK';
  const response = await fetch(url);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new ApiError(
      errorBody.message || 'Błąd pobierania punktów PSZOK',
      errorBody.code || 'FACILITIES_FETCH_FAILED',
      response.status,
    );
  }

  const data: FacilitiesResponse = await response.json();
  return data.items || [];
}

export function getSavedAddress(): ApiAddress | null {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY_SELECTED_ADDRESS);
    if (!serialized) return null;
    return JSON.parse(serialized) as ApiAddress;
  } catch {
    return null;
  }
}

export function saveAddress(address: ApiAddress): void {
  try {
    localStorage.setItem(STORAGE_KEY_SELECTED_ADDRESS, JSON.stringify(address));
  } catch (err) {
    console.warn('Nie udało się zapisać adresu w localStorage', err);
  }
}

export function clearAddress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_SELECTED_ADDRESS);
  } catch (err) {
    console.warn('Nie udało się wyczyścić adresu z localStorage', err);
  }
}

export interface DiscrepancyFeedbackInput {
  addressId?: string | null;
  reportedIssueType: 'WRONG_DATE' | 'MISSING_FRACTION' | 'UNSUPPORTED_ADDRESS' | 'EXTRA_COLLECTION' | 'OTHER';
  details?: string | null;
}

const STORAGE_KEY_INSTALLATION_ID = 'wastepl_installation_id';

function getOrCreateInstallationId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEY_INSTALLATION_ID);
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `inst_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem(STORAGE_KEY_INSTALLATION_ID, id);
    }
    return id;
  } catch {
    return `inst_${Date.now()}`;
  }
}

export async function submitDiscrepancyFeedback(
  input: DiscrepancyFeedbackInput,
): Promise<{ status: 'OK'; feedbackId: string }> {
  const installationId = getOrCreateInstallationId();
  const response = await fetch('/v1/feedback/schedule-discrepancy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      installationId,
      addressId: input.addressId ?? null,
      reportedIssueType: input.reportedIssueType,
      details: input.details ?? null,
      clientTimestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new ApiError(
      errorBody.message || 'Nie udało się przesłać zgłoszenia',
      errorBody.code || 'FEEDBACK_SUBMISSION_FAILED',
      response.status,
    );
  }

  return response.json();
}
