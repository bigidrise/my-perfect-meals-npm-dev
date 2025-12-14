export function normalizeName(s: string): string {
  return s.trim().toLowerCase();
}
export function mergeArraysUnique<T>(...arrs: T[][]): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const arr of arrs) {
    for (const v of arr) {
      const k = typeof v === 'string' ? v.toLowerCase() : JSON.stringify(v);
      if (!seen.has(k)) { seen.add(k); out.push(v); }
    }
  }
  return out;
}
