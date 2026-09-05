import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Loader2, MessageSquare, X } from 'lucide-react';
import { submitDiscrepancyFeedback } from '../services/api.js';
import { trackEvent } from '../services/telemetry.js';

interface ScheduleFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  addressId?: string;
  addressText?: string;
}

export const ScheduleFeedbackModal: React.FC<ScheduleFeedbackModalProps> = ({
  isOpen,
  onClose,
  addressId,
  addressText,
}) => {
  const [feedbackType, setFeedbackType] = useState<'CORRECT' | 'WRONG_DATE' | 'MISSING_FRACTION' | 'OTHER'>('CORRECT');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      trackEvent('FEEDBACK_MODAL_OPEN', { addressId: addressId ?? null });
    }
  }, [isOpen, addressId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (feedbackType === 'CORRECT') {
        await submitDiscrepancyFeedback({
          addressId,
          reportedIssueType: 'OTHER',
          details: `Harmonogram potwierdzony przez mieszkańca jako poprawny (Tak). ${details}`.trim(),
        });
      } else {
        await submitDiscrepancyFeedback({
          addressId,
          reportedIssueType: feedbackType,
          details: details.trim() || undefined,
        });
      }
      trackEvent('FEEDBACK_SUBMITTED', {
        addressId: addressId ?? null,
        feedbackType,
        isCorrect: feedbackType === 'CORRECT',
      });
      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        setDetails('');
        onClose();
      }, 2000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Nie udało się przesłać zgłoszenia.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-card)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
            <MessageSquare size={20} />
            <h3 id="feedback-modal-title" style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              Opinia o harmonogramie
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {addressText && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Dla adresu: <strong>{addressText}</strong>
          </p>
        )}

        {isSubmitted ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              color: '#22c55e',
            }}
          >
            <CheckCircle size={36} />
            <span style={{ fontWeight: 600, fontSize: '1rem' }}>Dziękujemy za opinię!</span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Twoje zgłoszenie pomaga utrzymać najwyższą jakość danych w regionie.
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                Czy harmonogram dla tego adresu jest poprawny?
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setFeedbackType('CORRECT')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: feedbackType === 'CORRECT' ? '#22c55e' : 'var(--bg-subtle)',
                    color: feedbackType === 'CORRECT' ? '#ffffff' : 'var(--text-main)',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  ✓ Tak, zgadza się
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackType('WRONG_DATE')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: feedbackType !== 'CORRECT' ? '#f59e0b' : 'var(--bg-subtle)',
                    color: feedbackType !== 'CORRECT' ? '#ffffff' : 'var(--text-main)',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  ✗ Nie, jest błąd
                </button>
              </div>
            </div>

            {feedbackType !== 'CORRECT' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Rodzaj niezgodności:
                </label>
                <select
                  value={feedbackType}
                  onChange={(e) => setFeedbackType(e.target.value as any)}
                  style={{
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 10px',
                    fontSize: '0.88rem',
                  }}
                >
                  <option value="WRONG_DATE">Niewłaściwa data wywozu</option>
                  <option value="MISSING_FRACTION">Brakująca frakcja (np. bio, papier)</option>
                  <option value="OTHER">Inna niezgodność</option>
                </select>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Dodatkowy komentarz (opcjonalnie):
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Np. wywóz plastiku odbywa się we wtorki zamiast śród..."
                rows={3}
                style={{
                  background: 'var(--bg-subtle)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 10px',
                  fontSize: '0.85rem',
                  resize: 'none',
                }}
              />
            </div>

            {errorMessage && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontSize: '0.82rem' }}>
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={isSubmitting}
                style={{ padding: '8px 14px', fontSize: '0.85rem' }}
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting}
                style={{
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Wysyłanie...</span>
                  </>
                ) : (
                  <span>Prześlij opinię</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
