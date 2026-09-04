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
const INSTALLATION_KEY = 'wastepl_installation_id';

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

export function getOrCreateInstallationId(): string {
  const storage = getStorage();
  if (!storage) return 'anonymous-pwa-client';
  let id = storage.getItem(INSTALLATION_KEY);
  if (!id) {
    id = 'pwa_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    try {
      storage.setItem(INSTALLATION_KEY, id);
    } catch {
      // ignore
    }
  }
  return id;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerWebPushSubscription(
  addressId: string,
  timing: ReminderTiming = 'EVENING_BEFORE_20',
): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg) return false;

    // Fetch VAPID public key
    const keyRes = await fetch('/v1/notifications/vapid-public-key');
    if (!keyRes.ok) return false;
    const { publicKey } = await keyRes.json();
    if (!publicKey) return false;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as unknown as BufferSource,
      });
    }

    const subJson = sub.toJSON();
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      return false;
    }

    const installationId = getOrCreateInstallationId();
    const res = await fetch('/v1/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        installationId,
        addressId,
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
        },
        reminderTiming: timing,
      }),
    });

    return res.ok;
  } catch (err) {
    console.warn('Web Push subscription registration failed:', err);
    return false;
  }
}

export async function unregisterWebPushSubscription(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;

    await fetch('/v1/notifications/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => null);

    await sub.unsubscribe().catch(() => null);
    return true;
  } catch (err) {
    console.warn('Web Push unsubscription failed:', err);
    return false;
  }
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
