import { DateTime } from 'luxon';

export function todayISOInTZ(tz: string): string {
  return DateTime.now().setZone(tz).toISODate()!; // 'YYYY-MM-DD'
}

export function msUntilNextMidnight(tz: string): number {
  const now = DateTime.now().setZone(tz);
  const next = now.plus({ days: 1 }).startOf('day');
  return next.diff(now).as('milliseconds');
}

/**
 * Get today's calendar parts (year, month, day) in the specified timezone.
 * Uses Intl.DateTimeFormat to avoid UTC conversion issues.
 * This is the ONLY safe way to get "today" for calendar math.
 */
export function getTodayPartsInTZ(tz: string): { year: number; month: number; day: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);

  const get = (type: string) =>
    Number(parts.find(p => p.type === type)?.value);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

/**
 * Get the Monday (week start) for the current week in the specified timezone.
 * CRITICAL: This avoids UTC/ISO conversion that causes "one day off" bugs.
 * 
 * The algorithm:
 * 1. Get today's calendar date in the target timezone (no UTC)
 * 2. Create a LOCAL Date object from those parts
 * 3. Compute Monday using local calendar math
 * 4. Only convert to ISO string at the very end
 */
export function getWeekStartISOInTZ(tz: string): string {
  const { year, month, day } = getTodayPartsInTZ(tz);

  // Create a LOCAL date (not UTC, not ISO) using calendar parts
  const localDate = new Date(year, month - 1, day);

  // Get day of week: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const dayOfWeek = localDate.getDay();
  
  // Calculate days to subtract to get to Monday
  // Sunday (0) → go back 6 days
  // Monday (1) → go back 0 days
  // Tuesday (2) → go back 1 day
  // etc.
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  // Move to Monday
  localDate.setDate(localDate.getDate() - daysToMonday);

  // Format as YYYY-MM-DD (safe now because we did all math locally)
  const yyyy = localDate.getFullYear();
  const mm = String(localDate.getMonth() + 1).padStart(2, '0');
  const dd = String(localDate.getDate()).padStart(2, '0');
  
  return `${yyyy}-${mm}-${dd}`;
}