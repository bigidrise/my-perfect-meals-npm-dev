import { localDayUTCBounds } from "../../utils/localDayBounds";
import { getUserTimezone, isValidIanaTimezone } from "../nutritionDayService";

const FALLBACK_TIMEZONE = "UTC";

export function localDateInTimezone(at: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(at);
}

export function shiftLocalDate(localDate: string, days: number): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days, 12));
  return shifted.toISOString().slice(0, 10);
}

export function assignedHydrationLocalDate(input: {
  eventTime: Date;
  eventLocalDate?: string | null;
  currentTimezone: string;
}): string {
  return input.eventLocalDate || localDateInTimezone(input.eventTime, input.currentTimezone);
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
    timezone = await getUserTimezone(input.subjectUserId);
  }
  if (!isValidIanaTimezone(timezone)) timezone = FALLBACK_TIMEZONE;

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