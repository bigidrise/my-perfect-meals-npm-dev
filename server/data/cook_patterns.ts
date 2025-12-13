export const SAFE_TEMP = {
  chicken: 165,
  turkey: 165,
  beef: 160,    // ground
  salmon: 145,
  tuna: 145,
  shrimp: 120,  // opaque/pink
  eggs: 160,
} as const;

export type PatternId = 'stir_fry' | 'sheet_pan' | 'omelet' | 'bowl' | 'quesadilla' | 'generic';

export function detectPattern(tags: string[], ingredients: string[]): PatternId {
  const T = new Set(tags.map(t => t.toLowerCase()));
  const I = ingredients.map(x => x.toLowerCase());
  if (T.has('stir-fry') || T.has('one‑pan') || I.includes('soy sauce')) return 'stir_fry';
  if (T.has('sheet‑pan') || T.has('sheet-pan')) return 'sheet_pan';
  if (I.includes('eggs')) return 'omelet';
  if (I.includes('tortilla') || I.includes('quesadilla')) return 'quesadilla';
  if (T.has('meal‑bowl') || T.has('bowl')) return 'bowl';
  return 'generic';
}