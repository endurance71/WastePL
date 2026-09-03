import React, { useMemo, useState } from 'react';
import {
  MapPin,
  Navigation,
  Clock,
  ShieldAlert,
  Copy,
  Check,
  Map as MapIcon,
  List,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { resolveTrustedFacilityLocation } from '@wastepl/domain';
import type { FacilityItem } from '../types/api.js';
import { getPolishDayName } from '../utils/formatters.js';
import { PszokMap, type EnrichedFacility } from './PszokMap.js';

interface PszokSectionProps {
  facilities: FacilityItem[];
  municipalityName: string;
}

type ViewMode = 'SPLIT' | 'LIST' | 'MAP';

export const PszokSection: React.FC<PszokSectionProps> = ({ facilities, municipalityName }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('SPLIT');

  // Enrich facilities with trusted PRG geocoding if location is not published in HTML source
  const enrichedFacilities: EnrichedFacility[] = useMemo(() => {
    return facilities.map((facility) => {
      if (facility.location) {
        return {
          ...facility,
          resolvedLocation: {
            lat: facility.location.lat,
            lon: facility.location.lon,
            provider: 'OPERATOR_PUBLISHED',
            sourceDescription: 'Oficjalne źródło operatora',
          },
        };
      }

      const trusted = resolveTrustedFacilityLocation(facility.canonicalKey);
      if (trusted) {
        return {
          ...facility,
          resolvedLocation: {
            lat: trusted.lat,
            lon: trusted.lon,
            provider: trusted.provider,
            sourceDescription: trusted.sourceDescription,
          },
        };
      }

      return facility;
    });
  }, [facilities]);

  const copyAddress = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const hasAnyGeocodedFacility = enrichedFacilities.some(
    (f) => Boolean(f.location || f.resolvedLocation),
  );

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
      {/* Header with Title & View Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
            Punkty PSZOK ({facilities.length})
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Gmina {municipalityName}
          </span>
        </div>

        {hasAnyGeocodedFacility && (
          <div className="view-mode-toggle" style={{ display: 'inline-flex', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-pill)', padding: '3px' }}>
            <button
              type="button"
              onClick={() => setViewMode('SPLIT')}
              style={{
                background: viewMode === 'SPLIT' ? '#38bdf8' : 'transparent',
                color: viewMode === 'SPLIT' ? '#090d16' : 'var(--text-muted)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Wszystko
            </button>
            <button
              type="button"
              onClick={() => setViewMode('MAP')}
              style={{
                background: viewMode === 'MAP' ? '#38bdf8' : 'transparent',
                color: viewMode === 'MAP' ? '#090d16' : 'var(--text-muted)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease',
              }}
            >
              <MapIcon size={12} />
              <span>Mapa</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('LIST')}
              style={{
                background: viewMode === 'LIST' ? '#38bdf8' : 'transparent',
                color: viewMode === 'LIST' ? '#090d16' : 'var(--text-muted)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease',
              }}
            >
              <List size={12} />
              <span>Lista</span>
            </button>
          </div>
        )}
      </div>

      {/* Interactive Map Component */}
      {hasAnyGeocodedFacility && (viewMode === 'SPLIT' || viewMode === 'MAP') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <PszokMap
            facilities={enrichedFacilities}
            selectedId={selectedFacilityId}
            onSelectFacility={(id) => setSelectedFacilityId(id)}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-dim)', padding: '0 4px' }}>
            <span>Dotknij pinu, aby zobaczyć szczegóły punktu</span>
            <span style={{ color: '#10b981', fontWeight: 600 }}>• OpenStreetMap & PRG GUGiK</span>
          </div>
        </div>
      )}

      {/* Facility Cards List */}
      {(viewMode === 'SPLIT' || viewMode === 'LIST') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {enrichedFacilities.map((facility) => {
            const loc = facility.location || facility.resolvedLocation;
            const hasLocation = Boolean(loc);
            const isPrgVerified = facility.resolvedLocation?.provider === 'GUGiK_PRG';
            const isSelected = facility.id === selectedFacilityId;

            const navGoogleUrl = hasLocation
              ? `https://www.google.com/maps/dir/?api=1&destination=${loc!.lat},${loc!.lon}`
              : null;
            const navOsmUrl = hasLocation
              ? `https://www.openstreetmap.org/?mlat=${loc!.lat}&mlon=${loc!.lon}#map=16/${loc!.lat}/${loc!.lon}`
              : null;

            const activeDays = facility.openingHours?.weekly.filter((w) => w.intervals.length > 0) || [];

            return (
              <div
                key={facility.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  border: isSelected ? '1px solid #38bdf8' : undefined,
                  boxShadow: isSelected ? '0 0 16px rgba(56, 189, 248, 0.2)' : undefined,
                  transition: 'border 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                      {facility.name}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      <MapPin size={16} color={isSelected ? '#38bdf8' : '#10b981'} />
                      <span>{facility.address}</span>
                    </div>

                    {/* Geocoding Provenance Badge */}
                    {hasLocation && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', marginTop: '2px' }}>
                        <CheckCircle2 size={12} color="#10b981" />
                        <span style={{ color: '#10b981', fontWeight: 600 }}>
                          {isPrgVerified
                            ? 'Zweryfikowany punkt PRG (GUGiK)'
                            : 'Współrzędne oficjalne operatora'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions: Navigation & Copy */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap' }}>
                    {hasLocation && navGoogleUrl && (
                      <a
                        href={navGoogleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary"
                        style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 10px', fontSize: '0.82rem' }}
                      >
                        <Navigation size={13} />
                        <span>Nawiguj</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => copyAddress(facility.id, facility.address)}
                      className="btn-secondary"
                      style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 10px', fontSize: '0.82rem' }}
                      title="Skopiuj adres do schowka"
                    >
                      {copiedId === facility.id ? <Check size={13} color="#22c55e" /> : <Copy size={13} />}
                      <span>{copiedId === facility.id ? 'Skopiowano' : 'Kopiuj'}</span>
                    </button>
                  </div>
                </div>

                {/* Operator Info */}
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

                {/* Direct map link if available */}
                {hasLocation && (
                  <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFacilityId(facility.id);
                        if (viewMode === 'LIST') setViewMode('SPLIT');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#38bdf8',
                        padding: 0,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 600,
                      }}
                    >
                      <MapIcon size={12} />
                      <span>Pokaż na mapie</span>
                    </button>
                    {navOsmUrl && (
                      <a
                        href={navOsmUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: 'var(--text-muted)',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <ExternalLink size={12} />
                        <span>OpenStreetMap</span>
                      </a>
                    )}
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
      )}
    </div>
  );
};
