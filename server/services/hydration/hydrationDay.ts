import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import { db } from "../../db";
import { localDayUTCBounds } from "../../utils/localDayBounds";

const FALLBACK_TIMEZONE = "UTC";

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function localDateInTimezone(at: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(at);
}

export function shiftLocalDate(localDate: string, days: number): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days, 12));
  return shifted.toISOString().slice(0, 10);
}

export async function resolveHydrationDay(input: {
  subjectUserId: string;
  localDate?: string;
  timezone?: string | null;
  now?: Date;
}): Promise<{
  localDate: string;
  timezone: string;
  start: Date;
  end: Date;
}> {
  let timezone = input.timezone?.trim() || "";
  if (!timezone) {
    const [profile] = await db
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.id, input.subjectUserId))
      .limit(1);
    timezone = profile?.timezone?.trim() || FALLBACK_TIMEZONE;
  }
  if (!isValidTimezone(timezone)) timezone = FALLBACK_TIMEZONE;

  const localDate =
    input.localDate || localDateInTimezone(input.now ?? new Date(), timezone);
  const { start, end } = localDayUTCBounds(localDate, timezone);
  return { localDate, timezone, start, end };
}

export function hydrationCalendarWindow(input: {
  endingLocalDate: string;
  timezone: string;
  days: number;
}): { start: Date; end: Date } {
  const firstLocalDate = shiftLocalDate(
    input.endingLocalDate,
    -(Math.max(1, input.days) - 1),
  );
  const { start } = localDayUTCBounds(firstLocalDate, input.timezone);
  const { end } = localDayUTCBounds(input.endingLocalDate, input.timezone);
  return { start, end };
}