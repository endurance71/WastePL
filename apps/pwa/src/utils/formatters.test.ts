import { describe, it, expect } from 'vitest';
import {
  formatDayCountdown,
  formatPolishDate,
  getFractionClass,
  getFractionLabel,
  getPolishDayName,
} from './formatters.js';

describe('formatters', () => {
  it('maps standard fraction codes to friendly Polish labels', () => {
    expect(getFractionLabel('BIO')).toBe('Bioodpady');
    expect(getFractionLabel('METALS_PLASTICS')).toBe('Metale i tworzywa sztuczne');
    expect(getFractionLabel('PAPER')).toBe('Papier');
    expect(getFractionLabel('GLASS')).toBe('Szkło');
    expect(getFractionLabel('RESIDUAL')).toBe('Zmieszane (resztkowe)');
    expect(getFractionLabel('BULKY')).toBe('Wielkogabarytowe');
    expect(getFractionLabel('UNKNOWN_TEST')).toBe('UNKNOWN_TEST');
  });

  it('maps fraction codes to CSS style classes', () => {
    expect(getFractionClass('BIO')).toBe('bio');
    expect(getFractionClass('METALS_PLASTICS')).toBe('metals_plastics');
    expect(getFractionClass('PAPER')).toBe('paper');
    expect(getFractionClass('GLASS')).toBe('glass');
    expect(getFractionClass('RESIDUAL')).toBe('residual');
    expect(getFractionClass('BULKY')).toBe('bulky');
    expect(getFractionClass('OTHER')).toBe('other');
  });

  it('formats Polish weekdays accurately', () => {
    expect(getPolishDayName('MONDAY')).toBe('Poniedziałek');
    expect(getPolishDayName('FRIDAY')).toBe('Piątek');
    expect(getPolishDayName('SATURDAY')).toBe('Sobota');
  });

  it('calculates relative countdowns accurately', () => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(formatDayCountdown(todayStr)).toEqual({ relativeText: 'Dziś', isUrgent: true });

    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    expect(formatDayCountdown(tomorrowStr)).toEqual({ relativeText: 'Jutro', isUrgent: true });
  });

  it('formats dates in Polish locale', () => {
    const formatted = formatPolishDate('2026-09-04');
    expect(formatted.toLowerCase()).toContain('września');
  });
});
