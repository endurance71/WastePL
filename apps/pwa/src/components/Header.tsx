import React from 'react';
import { MapPin, RefreshCw, WifiOff, Trash2, Bell } from 'lucide-react';
import type { ApiAddress } from '../types/api.js';

interface HeaderProps {
  selectedAddress: ApiAddress | null;
  onChangeAddress: () => void;
  isOnline: boolean;
  onOpenNotifications?: () => void;
  isNotificationsEnabled?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  selectedAddress,
  onChangeAddress,
  isOnline,
  onOpenNotifications,
  isNotificationsEnabled = false,
}) => {
  return (
    <header>
      <div className="brand-badge">
        <Trash2 size={22} color="#38bdf8" />
        <span>Waste</span>PL
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {!isOnline && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#ef4444',
              padding: '4px 10px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <WifiOff size={13} />
            <span>Offline</span>
          </div>
        )}

        {onOpenNotifications && (
          <button
            type="button"
            onClick={onOpenNotifications}
            className="btn-secondary"
            style={{
              padding: '6px 10px',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Ustawienia powiadomień i przypomnień o wywozie"
            aria-label="Powiadomienia"
          >
            <Bell size={16} color={isNotificationsEnabled ? '#38bdf8' : 'var(--text-muted)'} />
            {isNotificationsEnabled && (
              <span
                style={{
                  position: 'absolute',
                  top: '5px',
                  right: '5px',
                  width: '7px',
                  height: '7px',
                  backgroundColor: '#22c55e',
                  borderRadius: '50%',
                  boxShadow: '0 0 4px #22c55e',
                }}
              />
            )}
          </button>
        )}

        {selectedAddress && (
          <button
            type="button"
            onClick={onChangeAddress}
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            <MapPin size={13} color="#38bdf8" />
            <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedAddress.canonicalText.split(',')[0]}
            </span>
            <span style={{ color: '#38bdf8', fontWeight: 600, marginLeft: '2px' }}>Zmień</span>
          </button>
        )}
      </div>
    </header>
  );
};
