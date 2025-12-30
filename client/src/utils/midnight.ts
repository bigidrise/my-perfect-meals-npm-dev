import { DateTime } from 'luxon';

/**
 * ============================================================================
 * CHICAGO CALENDAR FIX v1.0 - "Noon UTC Anchor" Pattern
 * ============================================================================
 * 
 * This module provides calendar-safe date utilities for the My Perfect Meals app.
 * All functions use the "noon UTC anchor" pattern to avoid day-shift bugs caused
 * by UTC midnight conversions.
 * 
 * THE PROBLEM:
 * - Using `new Date(iso + "T00:00:00Z")` forces UTC midnight interpretation
 * - When Chicago is behind UTC, this shifts the calendar day backward
 * - Result: "today" shows as "yesterday" on iOS and other platforms
 * 
 * THE SOLUTION:
 * - Anchor all date math at UTC noon (12:00:00Z)
 * - DST transitions happen at 2 AM, so noon is 10+ hours from any edge case
 * - Format back to the target timezone using Intl.DateTimeFormat
 * - Never use toISOString().slice(0,10) or "T00:00:00Z" for calendar dates
 * 
 * CANONICAL TIMEZONE: America/Chicago
 * ============================================================================
 */

const MS_DAY = 86400000;
const CANONICAL_TZ = "America/Chicago";

/**
 * Convert YYYY-MM-DD string to a Date anchored at UTC noon (12:00:00Z).
 * This is the core of the "noon UTC anchor" pattern - keeps all date math
 * far from midnight edge cases and DST transitions.
 */
export function isoToUtcNoonDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/**
 * Format a Date object to YYYY-MM-DD string in the specified timezone.
 * Uses "en-CA" locale which reliably outputs ISO format (YYYY-MM-DD).
 */
export function formatISOInTZ(date: Date, timeZone: string = CANONICAL_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Get today's date as YYYY-MM-DD in the specified timezone.
 * This is the ONLY safe way to get "today" for calendar comparisons.
 */
export function getTodayISOSafe(timeZone: string = CANONICAL_TZ): string {
  return formatISOInTZ(new Date(), timeZone);
}

/**
 * Add days to an ISO date string safely.
 * Uses noon UTC anchor to avoid DST/midnight edge cases.
 */
export function addDaysISOSafe(iso: string, days: number, timeZone: string = CANONICAL_TZ): string {
  const base = isoToUtcNoonDate(iso);
  return formatISOInTZ(new Date(base.getTime() + days * MS_DAY), timeZone);
}

/**
 * Get the Monday (week start) for a given date in the specified timezone.
 * Uses noon UTC anchor pattern for reliable week calculations.
 */
export function getWeekStartFromDate(dateISO: string, timeZone: string = CANONICAL_TZ): string {
  const base = isoToUtcNoonDate(dateISO);
  const dayOfWeek = base.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // Calculate days to go back to Monday
  // Sunday (0) → go back 6 days
  // Monday (1) → go back 0 days
  // Tuesday (2) → go back 1 day, etc.
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const mondayDate = new Date(base.getTime() - daysToMonday * MS_DAY);
  return formatISOInTZ(mondayDate, timeZone);
}

/**
 * Get the Monday (week start) for the current week in the specified timezone.
 * This is the main entry point for initializing week views.
 */
export function getWeekStartISOInTZ(timeZone: string = CANONICAL_TZ): string {
  const todayISO = getTodayISOSafe(timeZone);
  return getWeekStartFromDate(todayISO, timeZone);
}

/**
 * Generate 7 consecutive date strings (Mon-Sun) from a week start.
 * Uses noon UTC anchor pattern for consistent results across timezones.
 */
export function weekDatesInTZ(weekStartISO: string, timeZone: string = CANONICAL_TZ): string[] {
  const base = isoToUtcNoonDate(weekStartISO);
  return Array.from({ length: 7 }, (_, i) =>
    formatISOInTZ(new Date(base.getTime() + i * MS_DAY), timeZone)
  );
}

/**
 * Navigate to next week from a given week start.
 */
export function nextWeekISO(weekStartISO: string, timeZone: string = CANONICAL_TZ): string {
  return addDaysISOSafe(weekStartISO, 7, timeZone);
}

/**
 * Navigate to previous week from a given week start.
 */
export function prevWeekISO(weekStartISO: string, timeZone: string = CANONICAL_TZ): string {
  return addDaysISOSafe(weekStartISO, -7, timeZone);
}

/**
 * Format a week label like "Dec 30–Jan 5" for display.
 */
export function formatWeekLabel(weekStartISO: string, timeZone: string = CANONICAL_TZ): string {
  const start = isoToUtcNoonDate(weekStartISO);
  const end = new Date(start.getTime() + 6 * MS_DAY);
  
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      timeZone,
    }).format(d);
  
  return `${fmt(start)}–${fmt(end)}`;
}

/**
 * Format a date ISO string for display (e.g., "Monday", "Monday, Dec 30").
 * Uses noon UTC anchor to avoid day-shift bugs.
 */
export function formatDateDisplay(
  dateISO: string, 
  options: Intl.DateTimeFormatOptions, 
  timeZone: string = CANONICAL_TZ
): string {
  const date = isoToUtcNoonDate(dateISO);
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone }).format(date);
}

// ============================================================================
// LEGACY COMPATIBILITY (for other parts of the app not yet migrated)
// ============================================================================

/**
 * @deprecated Use getTodayISOSafe() instead
 */
export function todayISOInTZ(tz: string): string {
  return DateTime.now().setZone(tz).toISODate()!;
}

/**
 * Get milliseconds until next midnight in the specified timezone.
 * Used for scheduling midnight resets.
 */
export function msUntilNextMidnight(tz: string): number {
  const now = DateTime.now().setZone(tz);
  const next = now.plus({ days: 1 }).startOf('day');
  return next.diff(now).as('milliseconds');
}

// ============================================================================
// DEPRECATED - Remove after all builders are migrated
// ============================================================================

/** @deprecated Use getTodayISOSafe() + getWeekStartFromDate() instead */
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

/** @deprecated Use weekDatesInTZ() instead */
export function weekDatesLocal(weekStartISO: string): string[] {
  const [year, month, day] = weekStartISO.split('-').map(Number);
  const dates: string[] = [];
  
  for (let i = 0; i < 7; i++) {
    const localDate = new Date(year, month - 1, day + i);
    const yyyy = localDate.getFullYear();
    const mm = String(localDate.getMonth() + 1).padStart(2, '0');
    const dd = String(localDate.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  
  return dates;
}
