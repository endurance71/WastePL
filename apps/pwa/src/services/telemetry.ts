/**
 * Resident Funnel Telemetry Service for WastePL PWA.
 *
 * Implements privacy-friendly event tracking specified in Roadmap P2.2:
 * `app open -> address search -> address selected -> schedule shown -> reminder/calendar enabled -> return visit`
 *
 * Design Principles:
 * 1. Zero PII: No exact personal details, IP addresses or persistent cross-site identifiers.
 * 2. Privacy-first: Uses existing anonymous installation ID generated for Web Push notifications.
 * 3. Offline-resilient: Buffers events locally in localStorage (FIFO capped at 100 entries).
 * 4. Non-blocking: Uses beacon/fetch with keepalive, never blocking UI or user interactions.
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
  timestamp: string; // ISO 8601
  payload?: Record<string, string | number | boolean | null>;
}

const STORAGE_KEY_TELEMETRY_QUEUE = 'wastepl_telemetry_queue';
const STORAGE_KEY_LAST_VISIT = 'wastepl_last_visit_timestamp';
const STORAGE_KEY_INSTALLATION_ID = 'wastepl_installation_id';
const MAX_QUEUE_SIZE = 100;

function getStorage(): Storage | null {
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  if (typeof window !== 'undefined' && 'localStorage' in window) {
    return window.localStorage;
  }
  return null;
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
    // Keep max queue entries to prevent storage bloat
    const trimmed = events.slice(-MAX_QUEUE_SIZE);
    storage.setItem(STORAGE_KEY_TELEMETRY_QUEUE, JSON.stringify(trimmed));
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

/**
 * Track a resident funnel event.
 */
export function trackEvent(
  eventType: TelemetryEventType,
  payload?: Record<string, string | number | boolean | null>,
): TelemetryEvent {
  const installationId = getAnonymousInstallationId();
  const event: TelemetryEvent = {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    installationId,
    eventType,
    timestamp: new Date().toISOString(),
    payload,
  };

  const queue = getQueuedEvents();
  queue.push(event);
  saveQueuedEvents(queue);

  // Attempt non-blocking flush if online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    flushTelemetryQueue().catch(() => {
      // Fire-and-forget: silently retains queue on error
    });
  }

  return event;
}

/**
 * Flushes the telemetry buffer to the backend when available.
 */
export async function flushTelemetryQueue(): Promise<boolean> {
  const queue = getQueuedEvents();
  if (queue.length === 0) return true;

  try {
    const response = await fetch('/v1/telemetry/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ events: queue }),
      keepalive: true,
    });

    if (response.ok) {
      clearQueuedEvents();
      return true;
    }
    return false;
  } catch {
    // Network failure or offline: keep buffered events
    return false;
  }
}

/**
 * Analyzes session start and determines whether to emit APP_OPEN or RETURN_VISIT.
 * Return visit threshold: > 2 hours since last active session.
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
      if (diffHours >= 2) {
        isReturnVisit = true;
      }
    }
    try {
      storage.setItem(STORAGE_KEY_LAST_VISIT, now.toString());
    } catch {
      // ignore
    }
  }

  return trackEvent(isReturnVisit ? 'RETURN_VISIT' : 'APP_OPEN', {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 80) : 'unknown',
  });
}
