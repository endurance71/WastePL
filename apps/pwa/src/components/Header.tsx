import React from 'react';
import { MapPin, RefreshCw, WifiOff, Trash2 } from 'lucide-react';
import type { ApiAddress } from '../types/api.js';

interface HeaderProps {
  selectedAddress: ApiAddress | null;
  onChangeAddress: () => void;
  isOnline: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  selectedAddress,
  onChangeAddress,
  isOnline,
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
