export function formatLocalDateKey(iso: string) {
  // iso in user's local already; keep YYYY-MM-DD
  return iso.slice(0, 10);
}