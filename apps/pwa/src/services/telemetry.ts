/**
 * Resident Funnel Telemetry Service for WastePL PWA.
 *
 * Implements privacy-preserving event tracking specified in Roadmap P2.2:
 * `app open -> address search -> address selected -> schedule shown -> reminder/calendar enabled -> return visit`
 *
 * Design Principles:
 * 1. Data minimization: no exact address text, address UUID or user-agent fingerprinting in telemetry payloads.
 * 2. Pseudonymous analytics: a local installation ID is sent only to WastePL API and is SHA-256 hashed before persistence.
 * 3. Offline-resilient: buffers events locally in localStorage (FIFO capped at 100 entries).
 * 4. Non-blocking: uses fetch with keepalive, never blocking UI or user interactions.
 */

export type TelemetryEventType =
  | 'APP_OPEN'
  | 'RETURN_VISIT'
  | 'ADDRESS_SEARCH'
  | 'ADDRESS_SELECTED'
  | 'SCHEDULE_SHOWN'
  | 'REMINDER_ICS_EXPORT'
  | 'REMINDER_PUSH_OPT_IN'
  | 'FEEDBACK_MODAL_OPEN'
  | 'FEEDBACK_SUBMITTED';

export interface TelemetryEvent {
  id: string;
  installationId: string;
  eventType: TelemetryEventType;
  timestamp: string;
  payload?: Record<string, string | number | boolean | null>;
}

const STORAGE_KEY_TELEMETRY_QUEUE = 'wastepl_telemetry_queue';
const STORAGE_KEY_LAST_VISIT = 'wastepl_last_visit_timestamp';
const STORAGE_KEY_INSTALLATION_ID = 'wastepl_installation_id';
const MAX_QUEUE_SIZE = 100;

function getStorage(): Storage | null {
  if (typeof localStorage !== 'undefined') return localStorage;
  if (typeof window !== 'undefined' && 'localStorage' in window) return window.localStorage;
  return null;
}

function boundedString(value: unknown, maxLength: number): string | undefined {
  return typeof value === 'string' && value.length <= maxLength ? value : undefined;
}

function boundedInteger(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : undefined;
}

function telemetryPayload(
  eventType: TelemetryEventType,
  raw?: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> | undefined {
  if (!raw) return undefined;
  const output: Record<string, string | number | boolean | null> = {};

  switch (eventType) {
    case 'ADDRESS_SEARCH': {
      const queryLength = boundedInteger(raw.queryLength, 0, 512);
      const resultCount = boundedInteger(raw.resultCount, 0, 250);
      if (queryLength !== undefined) output.queryLength = queryLength;
      if (resultCount !== undefined) output.resultCount = resultCount;
      break;
    }
    case 'ADDRESS_SELECTED': {
      const terc = boundedString(raw.terc, 7);
      if (terc && /^\d{7}$/.test(terc)) output.terc = terc;
      break;
    }
    case 'SCHEDULE_SHOWN': {
      const terc = boundedString(raw.terc, 7);
      const eventCount = boundedInteger(raw.eventCount, 0, 500);
      const sourceParser = boundedString(raw.sourceParser, 64);
      if (terc && /^\d{7}$/.test(terc)) output.terc = terc;
      if (eventCount !== undefined) output.eventCount = eventCount;
      if (typeof raw.isCached === 'boolean') output.isCached = raw.isCached;
      if (sourceParser !== undefined) output.sourceParser = sourceParser;
      break;
    }
    case 'REMINDER_ICS_EXPORT': {
      const eventCount = boundedInteger(raw.eventCount, 0, 500);
      const fractionFilter = boundedString(raw.fractionFilter, 48);
      const sourceParser = boundedString(raw.sourceParser, 64);
      if (eventCount !== undefined) output.eventCount = eventCount;
      if (fractionFilter !== undefined) output.fractionFilter = fractionFilter;
      if (sourceParser !== undefined) output.sourceParser = sourceParser;
      break;
    }
    case 'REMINDER_PUSH_OPT_IN': {
      const timing = boundedString(raw.timing, 32);
      if (timing !== undefined) output.timing = timing;
      break;
    }
    case 'FEEDBACK_SUBMITTED': {
      const feedbackType = boundedString(raw.feedbackType, 32);
      if (feedbackType !== undefined) output.feedbackType = feedbackType;
      if (typeof raw.isCorrect === 'boolean') output.isCorrect = raw.isCorrect;
      break;
    }
    case 'APP_OPEN':
    case 'RETURN_VISIT':
    case 'FEEDBACK_MODAL_OPEN':
      break;
  }

  return Object.keys(output).length > 0 ? output : undefined;
}

export function getAnonymousInstallationId(): string {
  const storage = getStorage();
  if (!storage) return 'anonymous-client';
  let id = storage.getItem(STORAGE_KEY_INSTALLATION_ID);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'pwa_' + Math.random().toString(36).substring(2, 15);
    try {
      storage.setItem(STORAGE_KEY_INSTALLATION_ID, id);
    } catch {
      // ignore
    }
  }
  return id;
}

export function getQueuedEvents(): TelemetryEvent[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY_TELEMETRY_QUEUE);
    if (!raw) return [];
    return JSON.parse(raw) as TelemetryEvent[];
  } catch {
    return [];
  }
}

export function saveQueuedEvents(events: TelemetryEvent[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY_TELEMETRY_QUEUE, JSON.stringify(events.slice(-MAX_QUEUE_SIZE)));
  } catch {
    // ignore storage write errors
  }
}

export function clearQueuedEvents(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY_TELEMETRY_QUEUE);
  } catch {
    // ignore
  }
}

export function trackEvent(
  eventType: TelemetryEventType,
  payload?: Record<string, string | number | boolean | null>,
): TelemetryEvent {
  const event: TelemetryEvent = {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    installationId: getAnonymousInstallationId(),
    eventType,
    timestamp: new Date().toISOString(),
    payload: telemetryPayload(eventType, payload),
  };

  const queue = getQueuedEvents();
  queue.push(event);
  saveQueuedEvents(queue);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    flushTelemetryQueue().catch(() => {
      // Fire-and-forget: silently retains queue on error
    });
  }

  return event;
}

export async function flushTelemetryQueue(): Promise<boolean> {
  const batch = getQueuedEvents();
  if (batch.length === 0) return true;
  const sentIds = new Set(batch.map((event) => event.id));

  try {
    const response = await fetch('/v1/telemetry/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });

    if (response.ok) {
      const remaining = getQueuedEvents().filter((event) => !sentIds.has(event.id));
      if (remaining.length > 0) {
        saveQueuedEvents(remaining);
      } else {
        clearQueuedEvents();
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Analyzes session start and determines whether to emit APP_OPEN or RETURN_VISIT.
 * Return visit threshold: >= 2 hours since last active session.
 */
export function recordSessionStart(): TelemetryEvent {
  const storage = getStorage();
  const now = Date.now();
  let isReturnVisit = false;

  if (storage) {
    const lastVisitStr = storage.getItem(STORAGE_KEY_LAST_VISIT);
    if (lastVisitStr) {
      const lastVisitTime = parseInt(lastVisitStr, 10);
      const diffHours = (now - lastVisitTime) / (1000 * 60 * 60);
      if (diffHours >= 2) isReturnVisit = true;
    }
    try {
      storage.setItem(STORAGE_KEY_LAST_VISIT, now.toString());
    } catch {
      // ignore
    }
  }

  return trackEvent(isReturnVisit ? 'RETURN_VISIT' : 'APP_OPEN');
}
