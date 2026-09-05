import React, { useEffect, useState } from 'react';
import { MapPin, Search, Loader2 } from 'lucide-react';
import { searchAddress } from '../services/api.js';
import { trackEvent } from '../services/telemetry.js';
import type { AddressCandidate, ApiAddress } from '../types/api.js';

interface AddressSearchProps {
  onSelectAddress: (address: ApiAddress) => void;
}

export const AddressSearch: React.FC<AddressSearchProps> = ({ onSelectAddress }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AddressCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setIsLoading(false);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const items = await searchAddress(query);
        setResults(items);
        setHasSearched(true);
        trackEvent('ADDRESS_SEARCH', {
          queryLength: query.trim().length,
          resultCount: items.length,
        });
      } catch (err) {
        setError('Nie udało się wyszukać adresu. Sprawdź połączenie.');
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '6px' }}>
          Podaj swój adres
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Sprawdź dokładny harmonogram wywozu i pobliski PSZOK w Twojej gminie.
        </p>
      </div>

      <div style={{ position: 'relative', width: '100%' }}>
        <div
          style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
        </div>
        <input
          type="text"
          className="search-input"
          placeholder="Wpisz np. Tychowo 1, Garbno, Bonin, 1 Maja..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Wyszukaj adres"
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Przykłady:</span>
        {[
          'Tychowo 1',
          'Garbno 1',
          'Bonin 2',
          '1 Maja 3, Koszalin',
          'Dobrowo 1',
          'Chałupy 101A',
        ].map((example) => (
          <button
            key={example}
            type="button"
            className="suggested-btn"
            onClick={() => setQuery(example)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-pill)',
              padding: '4px 10px',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)';
              e.currentTarget.style.color = '#38bdf8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            {example}
          </button>
        ))}
      </div>

      {error && (
        <div className="notice-box notice-error">
          <p>{error}</p>
        </div>
      )}

      {results.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginTop: '4px',
          }}
        >
          {results.map(({ address }) => (
            <li key={address.id}>
              <button
                type="button"
                onClick={() => {
                  trackEvent('ADDRESS_SELECTED', {
                    addressId: address.id,
                    municipality: address.municipality.name,
                    terc: address.municipality.terc,
                  });
                  onSelectAddress(address);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-card-hover)';
                  e.currentTarget.style.borderColor = 'var(--border-focus)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-subtle)';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <MapPin size={16} color="#38bdf8" />
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    {address.canonicalText}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {address.municipality.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasSearched && results.length === 0 && !isLoading && (
        <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
          Nie znaleziono pasującego adresu. Wpisz pełną nazwę ulicy lub miejscowości.
        </div>
      )}
    </div>
  );
};
