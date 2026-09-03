import React, { useState } from 'react';
import { Calendar, ShieldCheck, ExternalLink, Filter } from 'lucide-react';
import type { CollectionEvent, CollectionQuality, CollectionSourceProvenance } from '../types/api.js';
import {
  formatDayCountdown,
  formatPolishDate,
  getFractionClass,
  getFractionLabel,
} from '../utils/formatters.js';

interface CollectionTimelineProps {
  events: CollectionEvent[];
  source: CollectionSourceProvenance;
  quality: CollectionQuality;
}

export const CollectionTimeline: React.FC<CollectionTimelineProps> = ({
  events,
  source,
  quality,
}) => {
  const [selectedFraction, setSelectedFraction] = useState<string>('ALL');

  const availableFractions = Array.from(new Set(events.map((e) => e.fraction)));

  const filteredEvents =
    selectedFraction === 'ALL'
      ? events
      : events.filter((e) => e.fraction === selectedFraction);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Kolejne odbiory</h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {filteredEvents.length} terminów
        </span>
      </div>

      {/* Fraction Filter Chips */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          type="button"
          onClick={() => setSelectedFraction('ALL')}
          style={{
            background: selectedFraction === 'ALL' ? '#0284c7' : 'var(--bg-subtle)',
            color: selectedFraction === 'ALL' ? '#ffffff' : 'var(--text-muted)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-pill)',
            padding: '5px 12px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Wszystkie
        </button>
        {availableFractions.map((fraction) => {
          const isSelected = selectedFraction === fraction;
          return (
            <button
              key={fraction}
              type="button"
              onClick={() => setSelectedFraction(fraction)}
              style={{
                background: isSelected ? '#0284c7' : 'var(--bg-subtle)',
                color: isSelected ? '#ffffff' : 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-pill)',
                padding: '5px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {getFractionLabel(fraction)}
            </button>
          );
        })}
      </div>

      {/* Events List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredEvents.map((event, idx) => {
          const countdown = formatDayCountdown(event.date);
          const fractionClass = getFractionClass(event.fraction);
          const fractionLabel = getFractionLabel(event.fraction);
          const dateFormatted = formatPolishDate(event.date);

          return (
            <div
              key={`${event.date}-${event.fraction}-${idx}`}
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{dateFormatted}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`fraction-badge ${fractionClass}`}>{fractionLabel}</span>
                  {event.status === 'CHANGED' && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: '#f59e0b',
                        fontWeight: 600,
                      }}
                    >
                      (Termin zmieniony)
                    </span>
                  )}
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: countdown.isUrgent ? '#ef4444' : 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {countdown.relativeText}
              </span>
            </div>
          );
        })}
      </div>

      {/* Provenance & Source Evidence Footer */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          fontSize: '0.78rem',
          color: 'var(--text-dim)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#22c55e' }}>
            <ShieldCheck size={16} />
            <span style={{ fontWeight: 600 }}>
              {quality.verificationStatus === 'OFFICIAL_SOURCE' ||
              quality.verificationStatus === 'VERIFIED'
                ? 'Oficjalne źródło gminne'
                : 'Status weryfikacji: Oczekuje na audyt'}
            </span>
          </div>
          <span style={{ fontFamily: 'monospace' }}>
            SHA-256: {source.sha256.substring(0, 10)}...
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#38bdf8',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>Otwórz źródłowy dokument ({source.format})</span>
            <ExternalLink size={12} />
          </a>
          <span>Pobrano: {new Date(quality.retrievedAt).toLocaleDateString('pl-PL')}</span>
        </div>
      </div>
    </div>
  );
};
