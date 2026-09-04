import React, { useEffect, useState } from 'react';
import { Header } from './components/Header.js';
import { AddressSearch } from './components/AddressSearch.js';
import { NextCollectionCard } from './components/NextCollectionCard.js';
import { CollectionTimeline } from './components/CollectionTimeline.js';
import { PszokSection } from './components/PszokSection.js';
import {
  clearAddress,
  getCollection,
  getFacilities,
  getSavedAddress,
  saveAddress,
  ApiError,
} from './services/api.js';
import type {
  ApiAddress,
  CollectionScheduleResponse,
  FacilityItem,
} from './types/api.js';
import { Calendar, MapPin, Loader2, AlertTriangle, Info } from 'lucide-react';
import { NotificationModal } from './components/NotificationModal.js';
import {
  getNotificationPermission,
  getSavedNotificationPreferences,
} from './services/notifications.js';

export const App: React.FC = () => {
  const [selectedAddress, setSelectedAddress] = useState<ApiAddress | null>(null);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [activeTab, setActiveTab] = useState<'SCHEDULE' | 'PSZOK'>('SCHEDULE');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(false);

  const [schedule, setSchedule] = useState<CollectionScheduleResponse | null>(null);
  const [facilities, setFacilities] = useState<FacilityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<{
    code: string;
    message: string;
  } | null>(null);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncNotificationStatus = () => {
    const isGranted = getNotificationPermission() === 'granted';
    const isPrefEnabled = getSavedNotificationPreferences().enabled;
    setIsNotificationsEnabled(isGranted && isPrefEnabled);
  };

  // Restore saved address on initial mount
  useEffect(() => {
    const saved = getSavedAddress();
    if (saved) {
      setSelectedAddress(saved);
    }
    syncNotificationStatus();
  }, []);

  // Load schedule and facilities when address changes
  useEffect(() => {
    if (!selectedAddress) {
      setSchedule(null);
      setFacilities([]);
      setScheduleError(null);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      setScheduleError(null);

      // Fetch collection schedule
      try {
        const scheduleData = await getCollection(selectedAddress.id, 90);
        setSchedule(scheduleData);
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 404) {
            setScheduleError({
              code: 'NOT_COVERED',
              message:
                'Dla tego adresu harmonogram nie jest jeszcze opublikowany w pilotażu. Obecnie pokrywamy 4 z 8 gmin w regionie koszalińskim.',
            });
          } else if (err.status === 409) {
            setScheduleError({
              code: 'AMBIGUOUS',
              message:
                'Wykryto nakładające się rejony odbioru dla tego adresu. Wymagana jest weryfikacja przez operatora.',
            });
          } else {
            setScheduleError({
              code: err.code,
              message: err.message,
            });
          }
        } else {
          setScheduleError({
            code: 'UNKNOWN',
            message: 'Wystąpił problem z połączeniem. Sprawdź internet.',
          });
        }
      }

      // Fetch facilities for this municipality
      try {
        const facilitiesData = await getFacilities(selectedAddress.municipality.terc);
        setFacilities(facilitiesData);
      } catch (err) {
        console.warn('Błąd pobierania punktów PSZOK:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedAddress]);

  const handleSelectAddress = (address: ApiAddress) => {
    saveAddress(address);
    setSelectedAddress(address);
    setIsSearchingAddress(false);
  };

  const handleChangeAddress = () => {
    setIsSearchingAddress(true);
  };

  const handleCancelSearch = () => {
    if (selectedAddress) {
      setIsSearchingAddress(false);
    }
  };

  return (
    <div className="app-container">
      <Header
        selectedAddress={selectedAddress}
        onChangeAddress={handleChangeAddress}
        isOnline={isOnline}
        onOpenNotifications={() => setIsNotificationModalOpen(true)}
        isNotificationsEnabled={isNotificationsEnabled}
      />

      {/* Address selection prompt or search modal */}
      {(!selectedAddress || isSearchingAddress) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <AddressSearch onSelectAddress={handleSelectAddress} />
          {selectedAddress && (
            <button
              type="button"
              onClick={handleCancelSearch}
              className="btn-secondary"
              style={{ alignSelf: 'center' }}
            >
              Anuluj i wróć do wybranego adresu
            </button>
          )}
        </div>
      )}

      {/* Main Content when address is active */}
      {selectedAddress && !isSearchingAddress && (
        <>
          {/* Navigation Tabs */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-card)',
              padding: '4px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('SCHEDULE')}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                background: activeTab === 'SCHEDULE' ? '#0284c7' : 'transparent',
                color: activeTab === 'SCHEDULE' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              <Calendar size={16} />
              <span>Harmonogram</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PSZOK')}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                background: activeTab === 'PSZOK' ? '#0284c7' : 'transparent',
                color: activeTab === 'PSZOK' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              <MapPin size={16} />
              <span>Punkty PSZOK ({facilities.length})</span>
            </button>
          </div>

          {isLoading ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                gap: '12px',
                color: 'var(--text-muted)',
              }}
            >
              <Loader2 size={32} className="animate-spin" color="#38bdf8" />
              <span>Pobieranie oficjalnych danych...</span>
            </div>
          ) : (
            <>
              {activeTab === 'SCHEDULE' && (
                <>
                  {scheduleError ? (
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b' }}>
                        <AlertTriangle size={20} />
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                          Brak harmonogramu dla tej lokalizacji
                        </h3>
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                        {scheduleError.message}
                      </p>
                      <div className="notice-box notice-info">
                        <Info size={18} style={{ flexShrink: 0 }} />
                        <p style={{ fontSize: '0.82rem' }}>
                          Sprawdź zakładkę <strong>Punkty PSZOK</strong> powyżej, aby zobaczyć gdzie możesz oddać odpady w swojej gminie.
                        </p>
                      </div>
                    </div>
                  ) : schedule && schedule.events.length > 0 ? (
                    <>
                      <NextCollectionCard
                        event={schedule.events[0]!}
                        serviceAreaName={schedule.serviceArea.name}
                        onOpenNotifications={() => setIsNotificationModalOpen(true)}
                      />
                      <CollectionTimeline
                        events={schedule.events}
                        source={schedule.source}
                        quality={schedule.quality}
                        addressText={schedule.address.canonicalText}
                      />
                    </>
                  ) : (
                    <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
                      <p style={{ color: 'var(--text-muted)' }}>
                        Brak zaplanowanych zbiórek w najbliższych 90 dniach.
                      </p>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'PSZOK' && (
                <PszokSection
                  facilities={facilities}
                  municipalityName={selectedAddress.municipality.name}
                />
              )}
            </>
          )}
        </>
      )}

      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => {
          setIsNotificationModalOpen(false);
          syncNotificationStatus();
        }}
        addressText={selectedAddress?.canonicalText}
        events={schedule?.events}
      />
    </div>
  );
};
