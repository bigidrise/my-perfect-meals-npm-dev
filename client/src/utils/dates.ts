// All utilities assume the user's *local* timezone on the device.
// We always convert local-day boundaries to UTC ISO strings before sending to server.

/** Returns a calendar-only YYYY-MM-DD without converting that calendar day to UTC. */
export function localYYYYMMDD(d = new Date(), timeZone?: string | null): string {
  if (timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const value = (type: "year" | "month" | "day") =>
      parts.find((part) => part.type === type)?.value;
    return `${value("year")}-${value("month")}-${value("day")}`;
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Shift a calendar-only date without involving the runtime's local timezone. */
export function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days, 12));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** Start (00:00:00.000 local) and End (23:59:59.999 local) as UTC ISO strings. */
export function localDayRangeAsUTCISO(d = new Date()): { startUTC: string; endUTC: string } {
  const startLocal = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endLocal   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { startUTC: startLocal.toISOString(), endUTC: endLocal.toISOString() };
}

/** Millisecond epoch version (sometimes simpler on the backend). */
export function localDayRangeAsEpoch(d = new Date()): { startMs: number; endMs: number } {
  const startLocal = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endLocal   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { startMs: startLocal.getTime(), endMs: endLocal.getTime() };
}