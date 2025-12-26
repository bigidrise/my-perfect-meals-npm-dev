import { DateTime } from 'luxon';

export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'America/Chicago';
  }
}

export function todayISOInTZ(tz?: string): string {
  const timezone = tz || getUserTimezone();
  return DateTime.now().setZone(timezone).toISODate()!;
}

export function msUntilNextMidnight(tz?: string): number {
  const timezone = tz || getUserTimezone();
  const now = DateTime.now().setZone(timezone);
  const next = now.plus({ days: 1 }).startOf('day');
  return next.diff(now).as('milliseconds');
}

export function parseISODateLocal(dateISO: string): Date {
  const [year, month, day] = dateISO.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateLocal(dateISO: string, options?: Intl.DateTimeFormatOptions): string {
  const date = parseISODateLocal(dateISO);
  return date.toLocaleDateString(undefined, options);
}
