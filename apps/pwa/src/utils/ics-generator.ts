import type { CollectionEvent } from '../types/api.js';
import { getFractionLabel } from './formatters.js';

export interface IcsGenerationOptions {
  addressText: string;
  events: CollectionEvent[];
  alarmEveningBefore?: boolean;
}

function formatDateToIcs(dateStr: string): string {
  // dateStr is 'YYYY-MM-DD'
  return dateStr.replace(/-/g, '');
}

function getNextDay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + 1);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function formatUtcTimestamp(date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Generates an RFC 5545 compliant iCalendar (.ics) string for collection events.
 */
export function generateIcsCalendar(options: IcsGenerationOptions): string {
  const { addressText, events, alarmEveningBefore = true } = options;
  const nowStamp = formatUtcTimestamp();
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WastePL//Harmonogram Wywozu Odpadow//PL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(`Wywóz odpadów — ${addressText}`)}`,
    'X-WR-TIMEZONE:Europe/Warsaw',
  ];

  for (const [i, event] of events.entries()) {
    const fractionLabel = getFractionLabel(event.fraction);
    const startDate = formatDateToIcs(event.date);
    const endDate = getNextDay(event.date);
    const uid = `wastepl-${startDate}-${event.fraction.toLowerCase()}-${i}@wastepl.local`;

    const summary = `Odpady: ${fractionLabel}`;
    const description = [
      `Frakcja: ${fractionLabel}`,
      `Adres: ${addressText}`,
      'Wskazówka: Wystaw pojemnik lub worek przed posesję do godz. 06:00 rano.',
      'Harmonogram zweryfikowany oficjalnie przez WastePL.',
    ].join('\n');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${startDate}`);
    lines.push(`DTEND;VALUE=DATE:${endDate}`);
    lines.push(`SUMMARY:${escapeIcsText(summary)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    lines.push(`LOCATION:${escapeIcsText(addressText)}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:TRANSPARENT');

    if (alarmEveningBefore) {
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:${escapeIcsText(`Przypomnienie: jutro wywóz odpadów (${fractionLabel})`)}`);
      // Trigger at 20:00 the evening before (-4 hours before midnight)
      lines.push('TRIGGER:-PT4H');
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

/**
 * Initiates browser download of an .ics calendar file.
 */
export function downloadIcsFile(filename: string, icsContent: string): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.ics') ? filename : `${filename}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
