import { canonicalName, normalizeUnit, roundQty } from './normalize';
import type { ShoppingItem } from './types';
export function mergeItems(items: ShoppingItem[]): ShoppingItem[]{
  const map = new Map<string, ShoppingItem>();
  for(const it of items){
    const name = canonicalName(it.name);
    const unit = normalizeUnit(it.unit);
    const key = `${name}::${unit??''}`;
    const ex = map.get(key);
    const qty = roundQty(it.qty, unit);
    if(!ex){ map.set(key, { ...it, name, unit, qty }); }
    else{ map.set(key, { ...ex, qty: roundQty((ex.qty??0)+(qty??0), unit) }); }
  }
  return Array.from(map.values());
}