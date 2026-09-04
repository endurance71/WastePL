import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  Download,
  Send,
  Calendar,
  Smartphone,
  Info,
} from 'lucide-react';
import {
  getNotificationPermission,
  getSavedNotificationPreferences,
  requestNotificationPermission,
  saveNotificationPreferences,
  sendTestNotification,
  registerWebPushSubscription,
  unregisterWebPushSubscription,
  type NotificationPreferences,
  type ReminderTiming,
} from '../services/notifications.js';
import type { CollectionEvent } from '../types/api.js';
import { downloadIcsFile, generateIcsCalendar } from '../utils/ics-generator.js';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  addressId?: string;
  addressText?: string;
  events?: CollectionEvent[];
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  addressId,
  addressText,
  events = [],
}) => {
  const [permission, setPermission] = useState<
    'granted' | 'denied' | 'default' | 'unsupported'
  >('default');
  const [prefs, setPrefs] = useState<NotificationPreferences>(
    getSavedNotificationPreferences(),
  );
  const [testStatus, setTestStatus] = useState<
    'IDLE' | 'SENDING' | 'SUCCESS' | 'FAILED' | 'DENIED'
  >('IDLE');
  const modalRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPermission(getNotificationPermission());
      setPrefs(getSavedNotificationPreferences());
      setTestStatus('IDLE');

      // Focus first interactive element in modal
      const timer = setTimeout(() => {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable && focusable.length > 0) {
          focusable[0]?.focus();
        }
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
          return;
        }

        if (e.key === 'Tab' && modalRef.current) {
          const focusables = Array.from(
            modalRef.current.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            ),
          );
          if (focusables.length === 0) return;

          const firstEl = focusables[0];
          const lastEl = focusables[focusables.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === firstEl && lastEl) {
              e.preventDefault();
              lastEl.focus();
            }
          } else {
            if (document.activeElement === lastEl && firstEl) {
              e.preventDefault();
              firstEl.focus();
            }
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    setPermission(getNotificationPermission());
    if (result === 'granted') {
      const updated: NotificationPreferences = { ...prefs, enabled: true };
      setPrefs(updated);
      saveNotificationPreferences(updated);
      if (addressId) {
        registerWebPushSubscription(addressId, updated.reminderTiming).catch(() => null);
      }
    }
  };

  const handleTimingChange = (timing: ReminderTiming) => {
    const updated: NotificationPreferences = { ...prefs, reminderTiming: timing };
    setPrefs(updated);
    saveNotificationPreferences(updated);
    if (prefs.enabled && addressId) {
      registerWebPushSubscription(addressId, timing).catch(() => null);
    }
  };

  const handleToggleEnabled = (enabled: boolean) => {
    const updated: NotificationPreferences = { ...prefs, enabled };
    setPrefs(updated);
    saveNotificationPreferences(updated);
    if (enabled && addressId) {
      registerWebPushSubscription(addressId, prefs.reminderTiming).catch(() => null);
    } else if (!enabled) {
      unregisterWebPushSubscription().catch(() => null);
    }
  };

  const handleSendTest = async () => {
    setTestStatus('SENDING');
    if (permission !== 'granted') {
      const result = await requestNotificationPermission();
      setPermission(getNotificationPermission());
      if (result !== 'granted') {
        setTestStatus('DENIED');
        return;
      }
    }

    const ok = await sendTestNotification(addressText);
    setTestStatus(ok ? 'SUCCESS' : 'FAILED');
    setTimeout(() => {
      setTestStatus('IDLE');
    }, 4000);
  };

  const handleExportIcsWithTiming = () => {
    if (!events.length) return;
    const targetAddress = addressText ?? 'Mój adres';
    const icsContent = generateIcsCalendar({
      addressText: targetAddress,
      events,
      alarmTiming: prefs.reminderTiming,
    });
    const safeFilename = `odpady-${targetAddress.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.ics`;
    downloadIcsFile(safeFilename, icsContent);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-modal-title"
        className="modal-content card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '480px',
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={20} color="#38bdf8" />
            <h3 id="notification-modal-title" style={{ fontSize: '1.15rem', fontWeight: 700 }}>
              Powiadomienia o wywozie
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-close"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
            aria-label="Zamknij"
          >
            <X size={20} />
          </button>
        </div>

        {/* Browser Permission Status Banner */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            background:
              permission === 'granted'
                ? 'rgba(34, 197, 94, 0.12)'
                : permission === 'denied'
                ? 'rgba(239, 68, 68, 0.12)'
                : 'rgba(56, 189, 248, 0.12)',
            border: `1px solid ${
              permission === 'granted'
                ? 'rgba(34, 197, 94, 0.3)'
                : permission === 'denied'
                ? 'rgba(239, 68, 68, 0.3)'
                : 'rgba(56, 189, 248, 0.3)'
            }`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            fontSize: '0.85rem',
          }}
        >
          {permission === 'granted' ? (
            <CheckCircle2 size={18} color="#22c55e" style={{ flexShrink: 0, marginTop: '2px' }} />
          ) : permission === 'denied' ? (
            <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
          ) : (
            <Info size={18} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            <span style={{ fontWeight: 600 }}>
              {permission === 'granted'
                ? 'Powiadomienia przeglądarkowe są aktywne'
                : permission === 'denied'
                ? 'Powiadomienia są zablokowane w przeglądarce'
                : 'Włącz powiadomienia, aby nie przegapić wywozu'}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.4 }}>
              {permission === 'granted'
                ? 'Aplikacja może wyświetlać przypomnienia o zbliżających się zbiórkach odpadów.'
                : permission === 'denied'
                ? 'Aby włączyć powiadomienia, odblokuj uprawnienia w ustawieniach witryny (ikona kłódki przy adresie URL).'
                : 'Otrzymuj przypomnienia wieczorem przed odbiorem lub rano w dniu zbiórki.'}
            </span>

            {permission === 'default' && (
              <button
                type="button"
                onClick={handleRequestPermission}
                className="btn-primary"
                style={{
                  marginTop: '8px',
                  alignSelf: 'flex-start',
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                }}
              >
                Zezwól na powiadomienia
              </button>
            )}
          </div>
        </div>

        {/* Reminder Timing Preference */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={16} color="#38bdf8" />
            <span>Kiedy chcesz otrzymywać przypomnienie?</span>
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { id: 'EVENING_BEFORE_20', title: 'Dzień wcześniej o 20:00', badge: 'Zalecane' },
              { id: 'EVENING_BEFORE_18', title: 'Dzień wcześniej o 18:00' },
              { id: 'MORNING_OF_06', title: 'W dniu wywozu o 06:00 rano' },
              { id: 'BOTH', title: 'Dwa razy: wieczór (20:00) oraz rano (06:00)' },
            ].map((opt) => (
              <label
                key={opt.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: prefs.reminderTiming === opt.id ? 'rgba(56, 189, 248, 0.1)' : 'var(--bg-subtle)',
                  border: prefs.reminderTiming === opt.id ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="radio"
                    name="reminderTiming"
                    value={opt.id}
                    checked={prefs.reminderTiming === opt.id}
                    onChange={() => handleTimingChange(opt.id as ReminderTiming)}
                    style={{ accentColor: '#38bdf8' }}
                  />
                  <span style={{ fontWeight: prefs.reminderTiming === opt.id ? 600 : 400 }}>
                    {opt.title}
                  </span>
                </div>
                {opt.badge && (
                  <span style={{ fontSize: '0.72rem', background: '#0284c7', color: 'white', padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 600 }}>
                    {opt.badge}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Test Notification Action */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Przetestuj powiadomienia:</span>
            <button
              type="button"
              onClick={handleSendTest}
              disabled={testStatus === 'SENDING'}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '0.8rem',
              }}
            >
              <Send size={13} />
              <span>{testStatus === 'SENDING' ? 'Wysyłanie...' : 'Wyślij test'}</span>
            </button>
          </div>

          {testStatus === 'SUCCESS' && (
            <div style={{ color: '#22c55e', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} />
              <span>Powiadomienie testowe wysłane pomyślnie!</span>
            </div>
          )}
          {testStatus === 'DENIED' && (
            <div style={{ color: '#ef4444', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={14} />
              <span>Brak zgody na powiadomienia w przeglądarce.</span>
            </div>
          )}
          {testStatus === 'FAILED' && (
            <div style={{ color: '#f59e0b', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={14} />
              <span>Nie udało się wysłać powiadomienia. Sprawdź ustawienia systemowe.</span>
            </div>
          )}
        </div>

        {/* Native Calendar (.ics) Export with Chosen Timing */}
        {events.length > 0 && (
          <div
            style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
              <Calendar size={16} color="#38bdf8" />
              <span>Alternatywa: Kalendarz w telefonie (.ics)</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.4 }}>
              Pobierz plik kalendarza z ustawionym alarmem ({prefs.reminderTiming === 'EVENING_BEFORE_18' ? '18:00' : prefs.reminderTiming === 'EVENING_BEFORE_20' ? '20:00' : prefs.reminderTiming === 'MORNING_OF_06' ? '06:00' : '20:00 i 06:00'}) bezpośrednio do Apple Calendar, Google Calendar lub Outlook.
            </p>
            <button
              type="button"
              onClick={handleExportIcsWithTiming}
              className="btn-secondary"
              style={{
                alignSelf: 'flex-start',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '0.82rem',
                color: '#38bdf8',
                borderColor: 'rgba(56, 189, 248, 0.3)',
              }}
            >
              <Download size={14} />
              <span>Pobierz kalendarz z przypomnieniem (.ics)</span>
            </button>
          </div>
        )}

        {/* Footer Close */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-primary"
            style={{ padding: '8px 18px', fontSize: '0.85rem' }}
          >
            Gotowe
          </button>
        </div>
      </div>
    </div>
  );
};
