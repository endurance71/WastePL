export type ReminderTiming =
  | 'EVENING_BEFORE_18'
  | 'EVENING_BEFORE_20'
  | 'MORNING_OF_06'
  | 'BOTH';

export interface NotificationPreferences {
  enabled: boolean;
  reminderTiming: ReminderTiming;
  selectedFractions: string[];
}

const STORAGE_KEY = 'wastepl_notification_preferences';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: false,
  reminderTiming: 'EVENING_BEFORE_20',
  selectedFractions: ['ALL'],
};

function getStorage(): Storage | null {
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  if (typeof window !== 'undefined' && 'localStorage' in window) {
    return window.localStorage;
  }
  return null;
}

export function formatReminderTimingLabel(timing: ReminderTiming): string {
  switch (timing) {
    case 'EVENING_BEFORE_18':
      return 'Dzień wcześniej o 18:00';
    case 'EVENING_BEFORE_20':
      return 'Dzień wcześniej o 20:00';
    case 'MORNING_OF_06':
      return 'W dniu wywozu o 06:00 rano';
    case 'BOTH':
      return 'Dzień wcześniej o 20:00 oraz rano o 06:00';
    default:
      return 'Dzień wcześniej o 20:00';
  }
}

export function getNotificationPermission():
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const prefs = getSavedNotificationPreferences();
      saveNotificationPreferences({ ...prefs, enabled: true });
    }
    return permission;
  } catch (err) {
    console.warn('Błąd podczas żądania uprawnień do powiadomień:', err);
    return 'unsupported';
  }
}

export function getSavedNotificationPreferences(): NotificationPreferences {
  const storage = getStorage();
  if (!storage) return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...parsed,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export function saveNotificationPreferences(
  prefs: NotificationPreferences,
): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.warn('Nie udało się zapisać preferencji powiadomień:', err);
  }
}

export async function sendLocalNotification(
  title: string,
  options?: NotificationOptions,
): Promise<boolean> {
  const perm = getNotificationPermission();
  if (perm !== 'granted') return false;

  try {
    // Prefer service worker registration for richer PWA notifications if available
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          ...options,
        });
        return true;
      }
    }

    // Fallback to standard Notification constructor
    if (typeof Notification !== 'undefined') {
      new Notification(title, {
        icon: '/favicon.svg',
        ...options,
      });
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Błąd podczas wysyłania powiadomienia:', err);
    return false;
  }
}

export async function sendTestNotification(
  addressText?: string,
): Promise<boolean> {
  const addressLabel = addressText ? ` (${addressText})` : '';
  return sendLocalNotification('WastePL: Wywóz odpadów', {
    body: `Jutro odbiór frakcji: Metale i tworzywa sztuczne${addressLabel}. Wystaw pojemnik przed posesję!`,
    tag: 'wastepl-test-reminder',
    data: { url: '/' },
  });
}
