import { describe, expect, it } from 'vitest';
import type { CollectionEvent } from '../types/api.js';
import { generateIcsCalendar } from './ics-generator.js';

describe('generateIcsCalendar', () => {
  it('generates valid RFC 5545 iCalendar content with CRLF line endings', () => {
    const events: CollectionEvent[] = [
      { date: '2026-09-15', fraction: 'MIXED', status: 'SCHEDULED' },
      { date: '2026-09-22', fraction: 'BIO', status: 'SCHEDULED' },
    ];
    const ics = generateIcsCalendar({
      addressText: 'Dworek 1, 76-037 Dworek',
      events,
      alarmEveningBefore: true,
    });

    expect(ics).toContain('BEGIN:VCALENDAR\r\n');
    expect(ics).toContain('VERSION:2.0\r\n');
    expect(ics).toContain('PRODID:-//WastePL//Harmonogram Wywozu Odpadow//PL\r\n');
    expect(ics).toContain('X-WR-CALNAME:Wywóz odpadów — Dworek 1\\, 76-037 Dworek\r\n');

    // Check VEVENT 1
    expect(ics).toContain('BEGIN:VEVENT\r\n');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260915\r\n');
    expect(ics).toContain('DTEND;VALUE=DATE:20260916\r\n');
    expect(ics).toContain('SUMMARY:Odpady: Zmieszane (resztkowe)\r\n');
    expect(ics).toContain('LOCATION:Dworek 1\\, 76-037 Dworek\r\n');

    // Check VALARM
    expect(ics).toContain('BEGIN:VALARM\r\n');
    expect(ics).toContain('TRIGGER:-PT4H\r\n');
    expect(ics).toContain('END:VALARM\r\n');

    // Check VEVENT 2
    expect(ics).toContain('DTSTART;VALUE=DATE:20260922\r\n');
    expect(ics).toContain('DTEND;VALUE=DATE:20260923\r\n');
    expect(ics).toContain('SUMMARY:Odpady: Bioodpady\r\n');

    expect(ics).toContain('END:VCALENDAR\r\n');
  });

  it('can omit alarm if requested', () => {
    const events: CollectionEvent[] = [
      { date: '2026-09-15', fraction: 'PAPER', status: 'SCHEDULED' },
    ];
    const ics = generateIcsCalendar({
      addressText: 'Koszalin, ul. Młyńska 2',
      events,
      alarmEveningBefore: false,
    });

    expect(ics).not.toContain('BEGIN:VALARM');
    expect(ics).toContain('SUMMARY:Odpady: Papier\r\n');
  });

  it('supports configurable alarm timings (18:00 evening before, 06:00 morning, or both)', () => {
    const events: CollectionEvent[] = [
      { date: '2026-09-15', fraction: 'PAPER', status: 'SCHEDULED' },
    ];

    const ics18 = generateIcsCalendar({
      addressText: 'Koszalin',
      events,
      alarmTiming: 'EVENING_BEFORE_18',
    });
    expect(ics18).toContain('TRIGGER:-PT6H\r\n');
    expect(ics18).not.toContain('TRIGGER:-PT4H\r\n');

    const icsMorning = generateIcsCalendar({
      addressText: 'Koszalin',
      events,
      alarmTiming: 'MORNING_OF_06',
    });
    expect(icsMorning).toContain('TRIGGER;RELATED=START:PT6H\r\n');

    const icsBoth = generateIcsCalendar({
      addressText: 'Koszalin',
      events,
      alarmTiming: 'BOTH',
    });
    expect(icsBoth).toContain('TRIGGER:-PT6H\r\n');
    expect(icsBoth).toContain('TRIGGER:-PT4H\r\n');
  });
});
