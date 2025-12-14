import { DateTime } from 'luxon';

// Always compute Monday (ISO week start) in America/Chicago
export function getWeekStartISO(dateISO?: string, tz = 'America/Chicago'): string {
  const dt = dateISO
    ? DateTime.fromISO(dateISO, { zone: tz })
    : DateTime.now().setZone(tz);
  const monday = dt.startOf('week'); // ISO week starts Monday in Luxon
  return monday.toISODate()!; // 'YYYY-MM-DD'
}

export function isValidISODate(s: string): boolean {
  const dt = DateTime.fromISO(s, { zone: 'utc' });
  return dt.isValid && /^\d{4}-\d{2}-\d{2}$/.test(s);
}