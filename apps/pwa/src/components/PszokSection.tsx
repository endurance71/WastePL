import React, { useState } from 'react';
import { MapPin, Navigation, Clock, ShieldAlert, CheckCircle, Copy, Check } from 'lucide-react';
import type { FacilityItem } from '../types/api.js';
import { getPolishDayName } from '../utils/formatters.js';

interface PszokSectionProps {
  facilities: FacilityItem[];
  municipalityName: string;
}

export const PszokSection: React.FC<PszokSectionProps> = ({ facilities, municipalityName }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyAddress = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (facilities.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>
          Punkty PSZOK – {municipalityName}
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Brak zarejestrowanego oficjalnego punktu PSZOK w tej gminie w bieżącym etapie pilotażu.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
          Punkty PSZOK ({facilities.length})
        </h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {municipalityName}
        </span>
      </div>

      {facilities.map((facility) => {
        const hasTrustedLocation = facility.location !== null;
        const navUrl = hasTrustedLocation
          ? `https://www.google.com/maps/dir/?api=1&destination=${facility.location!.lat},${facility.location!.lon}`
          : null;

        const activeDays = facility.openingHours?.weekly.filter((w) => w.intervals.length > 0) || [];

        return (
          <div key={facility.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '4px' }}>
                  {facility.name}
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  <MapPin size={16} color="#38bdf8" />
                  <span>{facility.address}</span>
                </div>
              </div>

              {hasTrustedLocation && navUrl ? (
                <a
                  href={navUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <Navigation size={14} />
                  <span>Nawiguj</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => copyAddress(facility.id, facility.address)}
                  className="btn-secondary"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {copiedId === facility.id ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                  <span>{copiedId === facility.id ? 'Skopiowano' : 'Kopiuj'}</span>
                </button>
              )}
            </div>

            {/* Operator */}
            {facility.operatorName && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                Operator: {facility.operatorName}
              </div>
            )}

            {/* Opening Hours */}
            {activeDays.length > 0 && (
              <div
                style={{
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#38bdf8' }}>
                  <Clock size={14} />
                  <span>Godziny otwarcia:</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '4px' }}>
                  {activeDays.map((day) => (
                    <div key={day.day} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{getPolishDayName(day.day)}:</span>
                      <span style={{ fontWeight: 600 }}>
                        {day.intervals.map((i) => `${i.opens}–${i.closes}`).join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Access rules & proof of fee */}
            {facility.access && (
              <div style={{ fontSize: '0.82rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldAlert size={14} />
                <span>
                  {facility.access.requiresProof
                    ? 'Wymagane okazanie dowodu wniesienia opłaty śmieciowej.'
                    : 'Dostępne wyłącznie dla mieszkańców gminy.'}
                </span>
              </div>
            )}

            {/* Accepted materials */}
            {facility.acceptedMaterials.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                  PRZYJMOWANE ODPADY:
                </span>
                <div className="tag-list">
                  {facility.acceptedMaterials.map((material) => (
                    <span key={material} className="tag-item">
                      {material}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
