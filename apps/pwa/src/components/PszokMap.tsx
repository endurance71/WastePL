import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { FacilityItem } from '../types/api.js';

export interface EnrichedFacility extends FacilityItem {
  resolvedLocation?: {
    lat: number;
    lon: number;
    provider: string;
    sourceDescription?: string;
  } | null;
}

interface PszokMapProps {
  facilities: EnrichedFacility[];
  selectedId: string | null;
  onSelectFacility: (id: string) => void;
}

export const PszokMap: React.FC<PszokMapProps> = ({
  facilities,
  selectedId,
  onSelectFacility,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  // Initialize Leaflet map instance once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Default center on Koszalin region
    const map = L.map(mapContainerRef.current, {
      center: [54.18, 16.20],
      zoom: 10,
      zoomControl: true,
      scrollWheelZoom: false, // gentle for mobile touch scrolling
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers and bounds when facilities or selection changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old markers
    for (const marker of markersRef.current.values()) {
      marker.remove();
    }
    markersRef.current.clear();

    const bounds = L.latLngBounds([]);

    facilities.forEach((facility) => {
      const loc = facility.location || facility.resolvedLocation;
      if (!loc) return;

      const isSelected = facility.id === selectedId;
      const markerLatLng = L.latLng(loc.lat, loc.lon);
      bounds.extend(markerLatLng);

      const markerColor = isSelected ? '#38bdf8' : '#10b981';
      const markerShadow = isSelected
        ? '0 0 16px rgba(56, 189, 248, 0.7), 0 4px 10px rgba(0,0,0,0.5)'
        : '0 4px 12px rgba(0,0,0,0.4)';

      const customIcon = L.divIcon({
        className: 'custom-pszok-pin-icon',
        html: `
          <div style="
            position: relative;
            width: 34px;
            height: 34px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: ${markerColor};
            border: 2.5px solid #ffffff;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: ${markerShadow};
            cursor: pointer;
            transition: all 0.2s ease;
          ">
            <svg style="transform: rotate(45deg); width: 18px; height: 18px; color: #ffffff;" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -34],
      });

      const navGoogleUrl = `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lon}`;
      const navOsmUrl = `https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lon}#map=16/${loc.lat}/${loc.lon}`;
      const providerLabel = facility.resolvedLocation?.provider === 'GUGiK_PRG'
        ? 'Zweryfikowany punkt PRG (GUGiK)'
        : 'Oficjalne źródło operatora';

      const popupContent = `
        <div style="font-family: inherit; font-size: 13px; line-height: 1.4; color: #0f172a; min-width: 200px;">
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #0f172a;">${facility.name}</div>
          <div style="color: #475569; font-size: 12px; margin-bottom: 6px;">${facility.address}</div>
          <div style="font-size: 10px; font-weight: 600; color: #059669; margin-bottom: 8px; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; display: inline-block;">
            ${providerLabel}
          </div>
          <div style="display: flex; gap: 6px; margin-top: 6px;">
            <a href="${navGoogleUrl}" target="_blank" rel="noopener noreferrer" style="
              display: inline-flex;
              align-items: center;
              gap: 4px;
              background: #0284c7;
              color: white;
              padding: 5px 9px;
              border-radius: 6px;
              text-decoration: none;
              font-size: 11px;
              font-weight: 600;
            ">
              Google Maps
            </a>
            <a href="${navOsmUrl}" target="_blank" rel="noopener noreferrer" style="
              display: inline-flex;
              align-items: center;
              gap: 4px;
              background: #f1f5f9;
              color: #334155;
              border: 1px solid #cbd5e1;
              padding: 5px 9px;
              border-radius: 6px;
              text-decoration: none;
              font-size: 11px;
              font-weight: 600;
            ">
              OSM
            </a>
          </div>
        </div>
      `;

      const marker = L.marker(markerLatLng, { icon: customIcon })
        .addTo(map)
        .bindPopup(popupContent);

      marker.on('click', () => {
        onSelectFacility(facility.id);
      });

      markersRef.current.set(facility.id, marker);

      if (isSelected) {
        marker.openPopup();
      }
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [35, 35],
        maxZoom: 14,
      });
    }
  }, [facilities, selectedId, onSelectFacility]);

  return (
    <div className="pszok-map-card">
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '280px',
          borderRadius: 'var(--radius-md)',
          zIndex: 1,
        }}
      />
    </div>
  );
};
