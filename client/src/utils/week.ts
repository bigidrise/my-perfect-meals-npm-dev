// client/src/utils/week.ts
// Chicago Calendar Fix v1.0 - All helpers now use noon UTC anchor pattern
import {
  isoToUtcNoonDate,
  formatISOInTZ,
  getWeekStartFromDate,
  getWeekStartISOInTZ,
  prevWeekISO as prevWeekISOSafe,
  nextWeekISO as nextWeekISOSafe,
  formatWeekLabel,
  formatDateDisplay,
  addDaysISOSafe,
} from "./midnight";

const MS_DAY = 86400000;

/**
 * Return the Monday (ISO week start) yyyy-mm-dd of the given date.
 * Uses noon UTC anchor pattern for timezone safety.
 */
export function getMondayISOFromDate(d = new Date()): string {
  const dateISO = formatISOInTZ(d);
  return getWeekStartFromDate(dateISO);
}

/**
 * If dateISO provided (yyyy-mm-dd), anchor to that date; else use "today".
 * Uses noon UTC anchor pattern for timezone safety.
 */
export function getWeekStartISO(dateISO?: string): string {
  if (dateISO) {
    return getWeekStartFromDate(dateISO);
  }
  return getWeekStartISOInTZ();
}

export function prevWeekISO(weekISO: string): string {
  return prevWeekISOSafe(weekISO);
}

export function nextWeekISO(weekISO: string): string {
  return nextWeekISOSafe(weekISO);
}

/**
 * Display like "Sep 8-14" or "Sep 29 - Oct 5".
 * Uses noon UTC anchor pattern for timezone safety.
 */
export function formatWeekRange(weekStartISO: string): string {
  const start = isoToUtcNoonDate(weekStartISO);
  const end = new Date(start.getTime() + 6 * MS_DAY);

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "America/Chicago",
    }).format(d);

  const startStr = fmt(start);
  const endStr = fmt(end);

  // Check if same month by comparing month portion
  const startMonth = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "America/Chicago" }).format(start);
  const endMonth = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "America/Chicago" }).format(end);
  const startDay = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "America/Chicago" }).format(start);
  const endDay = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "America/Chicago" }).format(end);

  return startMonth === endMonth
    ? `${startMonth} ${startDay}-${endDay}`
    : `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

// Day name helpers for UI - using noon UTC anchor pattern
export function getDayName(dateISO: string): string {
  return formatDateDisplay(dateISO, { weekday: "short" });
}

export function getDayNameLong(dateISO: string): string {
  return formatDateDisplay(dateISO, { weekday: "long" });
}

export function formatDateShort(dateISO: string): string {
  return formatDateDisplay(dateISO, { month: "short", day: "numeric" });
}