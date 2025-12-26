// client/src/utils/week.ts
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Return the Monday (ISO week start) yyyy-mm-dd of the given date (UTC-safe).
 */
export function getMondayISOFromDate(d = new Date()): string {
  // Normalize to UTC midnight of the provided date
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const weekday = date.getUTCDay(); // 0..6 (Sun..Sat)
  // Distance to Monday going backwards: Sun(0)->6, Mon(1)->0, Tue(2)->1, ...
  const backToMonday = (weekday + 6) % 7;
  date.setUTCDate(date.getUTCDate() - backToMonday);

  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const da = pad(date.getUTCDate());
  return `${y}-${m}-${da}`;
}

/**
 * If dateISO provided (yyyy-mm-dd), anchor to that date; else use "today".
 */
export function getWeekStartISO(dateISO?: string): string {
  if (dateISO) {
    // Treat the passed ISO date as UTC (safe for 'YYYY-MM-DD')
    const d = new Date(`${dateISO}T00:00:00Z`);
    return getMondayISOFromDate(d);
  }
  return getMondayISOFromDate(new Date());
}

export function prevWeekISO(weekISO: string): string {
  const date = new Date(`${weekISO}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 7);
  return getMondayISOFromDate(date);
}

export function nextWeekISO(weekISO: string): string {
  const date = new Date(`${weekISO}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 7);
  return getMondayISOFromDate(date);
}

/**
 * Display like "Sep 8-14" or "Sep 29 - Oct 5" (UTC-safe).
 */
export function formatWeekRange(weekStartISO: string): string {
  const start = new Date(`${weekStartISO}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
  const startMonth = monthFmt.format(start);
  const endMonth = monthFmt.format(end);
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();

  return startMonth === endMonth
    ? `${startMonth} ${startDay}-${endDay}`
    : `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

function parseLocalDate(dateISO: string): Date {
  const [year, month, day] = dateISO.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getDayName(dateISO: string): string {
  const date = parseLocalDate(dateISO);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

export function getDayNameLong(dateISO: string): string {
  const date = parseLocalDate(dateISO);
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

export function formatDateShort(dateISO: string): string {
  const date = parseLocalDate(dateISO);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}