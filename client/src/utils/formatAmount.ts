export function formatAmount(value: number | string | undefined | null): string {
  if (value == null || value === "") return "";
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(n)) return String(value);
  return String(Math.round(n * 100) / 100);
}
