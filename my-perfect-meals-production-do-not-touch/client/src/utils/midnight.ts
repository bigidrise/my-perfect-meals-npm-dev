import { DateTime } from 'luxon';

export function todayISOInTZ(tz: string): string {
  return DateTime.now().setZone(tz).toISODate()!; // 'YYYY-MM-DD'
}

export function msUntilNextMidnight(tz: string): number {
  const now = DateTime.now().setZone(tz);
  const next = now.plus({ days: 1 }).startOf('day');
  return next.diff(now).as('milliseconds');
}