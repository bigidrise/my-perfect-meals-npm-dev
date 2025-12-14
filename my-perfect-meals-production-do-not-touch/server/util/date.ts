export function getWeekStart(d = new Date()) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay(); // 0 Sun
  const diff = (day + 6) % 7; // Monday start
  x.setUTCDate(x.getUTCDate() - diff);
  x.setUTCHours(0,0,0,0);
  return x;
}