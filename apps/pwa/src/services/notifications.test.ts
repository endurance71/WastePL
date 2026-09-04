import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  formatReminderTimingLabel,
  getNotificationPermission,
  getSavedNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences,
} from './notifications.js';

describe('Notifications Service', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const storageMock = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
    };

    vi.stubGlobal('localStorage', storageMock);
  });

  it('provides sensible default preferences', () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES).toEqual({
      enabled: false,
      reminderTiming: 'EVENING_BEFORE_20',
      selectedFractions: ['ALL'],
    });
  });

  it('formats reminder timing labels accurately in Polish', () => {
    expect(formatReminderTimingLabel('EVENING_BEFORE_18')).toBe('Dzień wcześniej o 18:00');
    expect(formatReminderTimingLabel('EVENING_BEFORE_20')).toBe('Dzień wcześniej o 20:00');
    expect(formatReminderTimingLabel('MORNING_OF_06')).toBe('W dniu wywozu o 06:00 rano');
    expect(formatReminderTimingLabel('BOTH')).toBe('Dzień wcześniej o 20:00 oraz rano o 06:00');
  });

  it('saves and restores notification preferences from localStorage', () => {
    const prefs: NotificationPreferences = {
      enabled: true,
      reminderTiming: 'EVENING_BEFORE_18',
      selectedFractions: ['BIO', 'PAPER'],
    };

    saveNotificationPreferences(prefs);
    const restored = getSavedNotificationPreferences();
    expect(restored).toEqual(prefs);
  });

  it('falls back to defaults if stored preferences are corrupt or empty', () => {
    mockStorage['wastepl_notification_preferences'] = 'invalid-json';
    expect(getSavedNotificationPreferences()).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  it('returns valid permission status without throwing', () => {
    const perm = getNotificationPermission();
    expect(['granted', 'denied', 'default', 'unsupported']).toContain(perm);
  });
});
