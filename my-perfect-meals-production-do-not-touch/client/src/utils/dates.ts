// All utilities assume the user's *local* timezone on the device.
// We always convert local-day boundaries to UTC ISO strings before sending to server.

/** Returns YYYY-MM-DD for the local timezone (what Steps already does). */
export function localYYYYMMDD(d = new Date()): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
    .toISOString()
    .split("T")[0];
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