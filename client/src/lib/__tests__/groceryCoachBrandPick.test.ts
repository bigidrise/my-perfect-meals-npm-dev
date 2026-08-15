/**
 * @jest-environment jsdom
 *
 * GroceryStoreCoachSheet — brand-pick substitution
 *
 * Verifies that handleAddToList substitutes the user's chosen brand for the
 * generic ingredient name when building the shopping list, that generic names
 * are preserved when no brand is picked, and that the toggle removes a pick
 * (so the item reverts to the generic name).
 *
 * Tests use the pure exported helpers resolveItemName and togglePickedBrand so
 * there is no divergence between production behaviour and the assertions.
 */

// ── Module stubs (must precede component import) ─────────────────────────────
jest.mock('wouter', () => ({ useLocation: () => ['/', jest.fn()] }));
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...r }: any) => {
      const React = require('react');
      return React.createElement('div', r, children);
    },
  },
  AnimatePresence: ({ children }: any) => children,
}));
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock('@/stores/shoppingListStore', () => ({ useShoppingListStore: jest.fn(() => jest.fn()) }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
jest.mock('@/lib/api', () => ({ post: jest.fn(), get: jest.fn() }));

import {
  resolveItemName,
  togglePickedBrand,
} from '@/components/shopping/GroceryStoreCoachSheet';

// ── Minimal BrandRecommendation shape used throughout ─────────────────────────
interface BrandRec {
  brand: string;
  rank: 1 | 2 | 3;
  grade: 'A' | 'B' | 'C';
  reason: string;
}

function makeBrand(name: string): BrandRec {
  return { brand: name, rank: 1, grade: 'A', reason: 'top pick' };
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveItemName — single-item name resolution
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveItemName — brand substitution for a single item', () => {
  it('returns the brand name when the ingredient has a picked brand', () => {
    const picks = new Map<string, BrandRec>();
    picks.set('olive oil', makeBrand('California Olive Ranch EVOO'));

    expect(resolveItemName('olive oil', picks)).toBe('California Olive Ranch EVOO');
  });

  it('returns the generic name unchanged when no brand is picked', () => {
    const picks = new Map<string, BrandRec>();
    expect(resolveItemName('olive oil', picks)).toBe('olive oil');
  });

  it('matches the ingredient key case-insensitively', () => {
    // The UI stores keys in lowercase; the item name may have mixed case.
    const picks = new Map<string, BrandRec>();
    picks.set('olive oil', makeBrand('California Olive Ranch EVOO'));

    // Upper-case item name must still resolve to the brand.
    expect(resolveItemName('Olive Oil', picks)).toBe('California Olive Ranch EVOO');
    expect(resolveItemName('OLIVE OIL', picks)).toBe('California Olive Ranch EVOO');
  });

  it('returns the generic name for a different ingredient even when the map is non-empty', () => {
    const picks = new Map<string, BrandRec>();
    picks.set('olive oil', makeBrand('California Olive Ranch EVOO'));

    expect(resolveItemName('avocado', picks)).toBe('avocado');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleAddToList simulation — full list mapping
//
// Mirrors the toItems() closure inside handleAddToList:
//
//   arr.map((s) => {
//     const pick = pickedBrands.get(s.item.toLowerCase());
//     return { name: pick ? pick.brand : s.item, ... };
//   });
// ─────────────────────────────────────────────────────────────────────────────

function simulateAddToList(
  items: Array<{ item: string; quantity: string; unit: string }>,
  picks: Map<string, BrandRec>,
): Array<{ name: string; quantity: number; unit: string }> {
  return items.map((s) => ({
    name: resolveItemName(s.item, picks),
    quantity: parseFloat(s.quantity) || 1,
    unit: s.unit || '',
  }));
}

describe('handleAddToList brand-pick substitution — full list', () => {
  it('substitutes the brand for the matching ingredient when a pick exists', () => {
    const items = [{ item: 'olive oil', quantity: '2', unit: 'tbsp' }];
    const picks = new Map<string, BrandRec>();
    picks.set('olive oil', makeBrand('California Olive Ranch'));

    const result = simulateAddToList(items, picks);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('California Olive Ranch');
  });

  it('keeps the generic ingredient name when no brand is picked', () => {
    const items = [{ item: 'olive oil', quantity: '2', unit: 'tbsp' }];
    const picks = new Map<string, BrandRec>();

    const result = simulateAddToList(items, picks);

    expect(result[0].name).toBe('olive oil');
  });

  it('substitutes only the ingredients that have picks; others stay generic', () => {
    const items = [
      { item: 'olive oil', quantity: '2', unit: 'tbsp' },
      { item: 'chicken breast', quantity: '1', unit: 'lb' },
      { item: 'spinach', quantity: '1', unit: 'bag' },
    ];
    const picks = new Map<string, BrandRec>();
    picks.set('olive oil', makeBrand('California Olive Ranch'));
    picks.set('spinach', makeBrand('Earthbound Farm Organic'));

    const result = simulateAddToList(items, picks);

    expect(result[0].name).toBe('California Olive Ranch');
    expect(result[1].name).toBe('chicken breast');
    expect(result[2].name).toBe('Earthbound Farm Organic');
  });

  it('preserves quantity and unit regardless of whether a brand is picked', () => {
    const items = [{ item: 'olive oil', quantity: '2', unit: 'tbsp' }];
    const picks = new Map<string, BrandRec>();
    picks.set('olive oil', makeBrand('California Olive Ranch'));

    const result = simulateAddToList(items, picks);

    expect(result[0].quantity).toBe(2);
    expect(result[0].unit).toBe('tbsp');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// togglePickedBrand — only one brand per ingredient; toggling restores generic
// ─────────────────────────────────────────────────────────────────────────────

describe('togglePickedBrand — one brand per ingredient, toggle-off restores generic', () => {
  it('adds a brand pick for an ingredient that has no pick yet', () => {
    const prev = new Map<string, BrandRec>();
    const brand = makeBrand('California Olive Ranch');

    const next = togglePickedBrand(prev, 'olive oil', brand);

    expect(next.get('olive oil')?.brand).toBe('California Olive Ranch');
  });

  it('removes the pick when the same brand is toggled a second time', () => {
    const brand = makeBrand('California Olive Ranch');
    const prev = new Map<string, BrandRec>([['olive oil', brand]]);

    // Same brand tapped again → toggle off
    const next = togglePickedBrand(prev, 'olive oil', brand);

    expect(next.has('olive oil')).toBe(false);
  });

  it('after toggle-off the name reverts to the generic ingredient name', () => {
    const brand = makeBrand('California Olive Ranch');
    const prev = new Map<string, BrandRec>([['olive oil', brand]]);

    const next = togglePickedBrand(prev, 'olive oil', brand);

    // With no pick the resolver must return the generic name
    expect(resolveItemName('olive oil', next)).toBe('olive oil');
  });

  it('replaces an existing pick when a different brand is selected', () => {
    const brand1 = makeBrand('California Olive Ranch');
    const brand2 = makeBrand('Kirkland Organic EVOO');
    const prev = new Map<string, BrandRec>([['olive oil', brand1]]);

    const next = togglePickedBrand(prev, 'olive oil', brand2);

    expect(next.get('olive oil')?.brand).toBe('Kirkland Organic EVOO');
  });

  it('only one brand can be picked per ingredient at any time', () => {
    const brand1 = makeBrand('California Olive Ranch');
    const brand2 = makeBrand('Kirkland Organic EVOO');
    let picks = new Map<string, BrandRec>();

    picks = togglePickedBrand(picks, 'olive oil', brand1);
    picks = togglePickedBrand(picks, 'olive oil', brand2);

    // There must be exactly one entry for this ingredient
    const oliveOilPick = picks.get('olive oil');
    expect(oliveOilPick?.brand).toBe('Kirkland Organic EVOO');
    // Map has only the one key
    expect([...picks.keys()].filter((k) => k === 'olive oil')).toHaveLength(1);
  });

  it('does not mutate the previous Map', () => {
    const brand = makeBrand('California Olive Ranch');
    const prev = new Map<string, BrandRec>();

    togglePickedBrand(prev, 'olive oil', brand);

    expect(prev.has('olive oil')).toBe(false);
  });

  it('normalises the ingredient key to lowercase', () => {
    const brand = makeBrand('California Olive Ranch');
    const prev = new Map<string, BrandRec>();

    const next = togglePickedBrand(prev, 'Olive Oil', brand);

    // Key must be stored lowercase so resolveItemName (which lowercases the
    // item name) can look it up correctly.
    expect(next.has('olive oil')).toBe(true);
    expect(next.has('Olive Oil')).toBe(false);
  });
});
