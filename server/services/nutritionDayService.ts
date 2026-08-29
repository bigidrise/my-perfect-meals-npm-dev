/**
 * Nutrition Day Service
 *
 * Single source of truth for "what calendar day does a macro_logs entry belong to?"
 *
 * Architecture rules:
 *  - Timestamps in macro_logs.at are UTC absolutes. Never mutate them.
 *  - "Day" is computed at query time from the nutrition account OWNER's timezone.
 *  - A coach in California viewing a Florida client uses the Florida client's timezone.
 *  - Source of timezone: users.timezone (IANA string, e.g., "America/Chicago").
 *
 * Phase 1 note:
 *  users.timezone exists in the schema but is not yet user-settable in the UI.
 *  When a settings screen ships, the timezone is updated there — this service does
 *  not need to change. The field defaults to "America/Chicago" for existing users.
 *
 * DO NOT replicate date-boundary logic inline in routes or services.
 * Every place that groups macro_logs by day goes through this module.
 */

import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

/** Validates a real IANA timezone supported by this runtime. */
export function isValidIanaTimezone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz.trim() || tz.length > 100) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function sanitizeTz(tz: unknown): string {
  if (isValidIanaTimezone(tz)) return tz;
  return "UTC";
}

/**
 * Fetches the IANA timezone for the user who owns the nutrition data.
 *
 * ALWAYS pass the data OWNER's userId, not the session user's ID.
 * A coach or physician reading client data should pass the client's userId here.
 */
export async function getUserTimezone(userId: string): Promise<string> {
  try {
    const [row] = await db
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return sanitizeTz(row?.timezone ?? "UTC");
  } catch {
    return "UTC";
  }
}

export async function setUserTimezone(userId: string, timezone: string): Promise<string> {
  if (!isValidIanaTimezone(timezone)) throw new Error("Invalid IANA timezone");
  await db
    .update(users)
    .set({ timezone, timezoneUpdatedAt: new Date() })
    .where(eq(users.id, userId));
  return timezone;
}

/**
 * Returns today's local date string (YYYY-MM-DD) in the given IANA timezone.
 * Use this wherever the server needs "today" relative to the data owner.
 */
export function todayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: sanitizeTz(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Returns a local date string (YYYY-MM-DD) for N days before the given local date.
 * Safe for use in date range calculations (compliance windows, streaks, etc.).
 *
 * @param localDateISO  Anchor date in YYYY-MM-DD (e.g., today in owner's timezone).
 * @param daysBack      How many days to go back (0 = same date).
 */
export function daysAgo(localDateISO: string, daysBack: number): string {
  const d = new Date(`${localDateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns a PostgreSQL SQL string that converts a timestamptz column to the
 * owner's local calendar date.
 *
 * Use in SELECT and GROUP BY instead of `col::date` (which silently uses UTC).
 * PostgreSQL handles DST transitions correctly with IANA timezone names.
 *
 * @param colSql   Raw SQL for the timestamptz column, e.g., "macro_logs.at"
 * @param timezone IANA timezone for the data owner.
 *
 * Example output:
 *   (macro_logs.at AT TIME ZONE 'America/Chicago')::date
 */
export function localDateExpr(colSql: string, timezone: string): string {
  return `(${colSql} AT TIME ZONE '${sanitizeTz(timezone)}')::date`;
}

/**
 * Returns a PostgreSQL SQL WHERE fragment that matches rows belonging to a
 * specific local calendar day in the owner's timezone.
 *
 * Using a SQL expression (not JS Date bounds) guarantees the DELETE and the
 * aggregation query use identical day-boundary logic, with no DST math in JS.
 *
 * @param colSql       Raw SQL for the timestamptz column.
 * @param timezone     IANA timezone for the data owner.
 * @param localDateISO YYYY-MM-DD local date from the owner's perspective.
 *
 * Example output:
 *   (macro_logs.at AT TIME ZONE 'America/Chicago')::date = '2026-07-28'::date
 */
export function localDayMatchSQL(
  colSql: string,
  timezone: string,
  localDateISO: string,
): string {
  return `${localDateExpr(colSql, timezone)} = '${localDateISO}'::date`;
}
