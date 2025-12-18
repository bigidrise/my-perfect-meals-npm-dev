const UNIT_MAP: Record<string,string> = {
  teaspoon: 'tsp', teaspoons: 'tsp', tsp: 'tsp',
  tablespoon: 'tbsp', tablespoons: 'tbsp', tbsp: 'tbsp',
  cup: 'cup', cups: 'cup',
  ounce: 'oz', ounces: 'oz', oz: 'oz',
  pound: 'lb', pounds: 'lb', lb: 'lb', lbs: 'lb',
  clove: 'clove', cloves: 'clove',
  piece: 'count', pieces: 'count', count: 'count',
  can: 'can', cans: 'can',
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml',
  l: 'l', liter: 'l', liters: 'l',
  packet: 'packet', packets: 'packet'
};
export function normalizeUnit(u?: string){ if(!u) return undefined; const k=u.trim().toLowerCase(); return UNIT_MAP[k] ?? k; }
export function roundQty(q?: number, u?: string){ if(q==null||isNaN(q)) return undefined; const unit=u?.toLowerCase(); if(unit==='tsp'||unit==='tbsp'||unit==='oz'){ return Math.round(q*10)/10;} return Math.round(q*2)/2;}
export function canonicalName(s: string){ return s.trim().toLowerCase().replace(/\b(large|small|medium|fresh|organic|boneless|skinless)\b/g,'').replace(/\s{2,}/g,' ').trim(); }