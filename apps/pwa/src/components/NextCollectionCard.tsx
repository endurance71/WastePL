import React from 'react';
import { Calendar, Clock, AlertCircle, Bell } from 'lucide-react';
import type { CollectionEvent } from '../types/api.js';
import {
  formatDayCountdown,
  formatPolishDate,
  getFractionClass,
  getFractionLabel,
} from '../utils/formatters.js';

interface NextCollectionCardProps {
  event: CollectionEvent;
  serviceAreaName: string;
  onOpenNotifications?: () => void;
}

export const NextCollectionCard: React.FC<NextCollectionCardProps> = ({
  event,
  serviceAreaName,
  onOpenNotifications,
}) => {
  const countdown = formatDayCountdown(event.date);
  const fractionLabel = getFractionLabel(event.fraction);
  const fractionClass = getFractionClass(event.fraction);
  const dateFormatted = formatPolishDate(event.date);

  return (
    <div
      className="card"
      style={{
        background: 'linear-gradient(145deg, #111827 0%, #172554 100%)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
        }}
      >
        <span
          style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#38bdf8',
          }}
        >
          Najbliższy wywóz
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.8rem',
              fontWeight: 700,
              background: countdown.isUrgent ? '#ef4444' : 'rgba(56, 189, 248, 0.2)',
              color: '#ffffff',
            }}
          >
            {countdown.relativeText}
          </span>
          {onOpenNotifications && (
            <button
              type="button"
              onClick={onOpenNotifications}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 'var(--radius-pill)',
                padding: '4px 8px',
                color: '#38bdf8',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
              title="Ustaw przypomnienie o wywozie"
            >
              <Bell size={12} />
              <span>Przypomnij</span>
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '8px' }}>
          <span className={`fraction-badge ${fractionClass}`} style={{ fontSize: '0.9rem', padding: '6px 12px' }}>
            {fractionLabel}
          </span>
        </div>
        <div
          style={{
            fontSize: '1.4rem',
            fontWeight: 700,
            color: 'var(--text-main)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Calendar size={22} color="#38bdf8" />
          {dateFormatted}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: '12px',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={14} />
          <span>Wystaw pojemnik do godz. 06:00</span>
        </div>
        <span style={{ color: 'var(--text-dim)' }}>{serviceAreaName}</span>
      </div>
    </div>
  );
};
