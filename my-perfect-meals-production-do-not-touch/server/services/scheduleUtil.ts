import { DateTime } from "luxon";

/**
 * Convert a date + time + timezone to UTC timestamp string
 */
export function toUTC(dateISO: string, hhmm: string, timezone: string): string {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const dt = DateTime.fromISO(dateISO, { zone: timezone })
    .set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
  return dt.toUTC().toISO()!;
}

/**
 * Generate next 7 dates starting from today in the given timezone
 */
export function next7Dates(startDateISO: string, timezone: string): string[] {
  const dates: string[] = [];
  let current = DateTime.fromISO(startDateISO, { zone: timezone });
  
  for (let i = 0; i < 7; i++) {
    dates.push(current.toISODate()!);
    current = current.plus({ days: 1 });
  }
  
  return dates;
}

/**
 * Check if a datetime is in the future (for scheduling validation)
 */
export function isFuture(utcTimestamp: string): boolean {
  return new Date(utcTimestamp) > new Date();
}

/**
 * Format UTC timestamp for display in a timezone
 */
export function formatInTimezone(utcTimestamp: string, timezone: string): string {
  return DateTime.fromISO(utcTimestamp).setZone(timezone).toFormat('MMM dd, h:mm a');
}