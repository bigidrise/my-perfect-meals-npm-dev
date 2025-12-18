import type { ShoppingItem } from './types';
export function shoppingPadHref(items: ShoppingItem[]) {
  const payload = encodeURIComponent(btoa(JSON.stringify(items)));
  return `/shopping?payload=${payload}`;
}