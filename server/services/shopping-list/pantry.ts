// server/services/shopping-list/pantry.ts
import { SHARED_PANTRY_STAPLES } from '../../../shared/pantryStaples';

export { SHARED_PANTRY_STAPLES as PANTRY_KEYWORDS };

export function isPantryItem(name: string): boolean {
  const n = name.trim().toLowerCase();
  return SHARED_PANTRY_STAPLES.some(k => n === k || n.includes(k));
}
