/**
 * @jest-environment jsdom
 *
 * GroceryStoreCoachSheet — brand-pick substitution
 *
 * Section A: pure-helper unit tests for resolveItemName and togglePickedBrand.
 *   These verify the low-level substitution logic in isolation.
 *
 * Section B: component-level integration test that renders GroceryStoreCoachSheet,
 *   seeds a session with both shoppingList and ownedIngredients, picks a brand for
 *   an ingredient that lives only in ownedIngredients (not shoppingList), clicks
 *   "Add All to Shopping List", and asserts the shopping-list store receives the
 *   branded item — not its generic name.
 *
 *   This test would fail if the `...toItems(result.ownedIngredients ?? [])` call
 *   were removed from handleAddToList, even though all Section A tests would still pass.
 */

// ── Module stubs (must precede ALL imports) ───────────────────────────────────

jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));
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
/**
 * Translation keys used by PillButton labels and the "Add All" button.
 * Map the keys the component actually calls t() with to their English strings
 * so the integration tests can locate and click the rendered controls.
 */
const I18N_STRINGS: Record<string, string> = {
  'smartCart.pick': 'Pick',
  'smartCart.picked': '✓ Picked',
  // add further keys here as the component acquires more translated labels
};
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, _opts?: unknown) => I18N_STRINGS[k] ?? k,
    i18n: { language: 'en' },
  }),
}));
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock('@/hooks/useSpeechToText', () => ({
  useSpeechToText: () => ({
    state: 'idle',
    text: '',
    start: jest.fn(),
    stop: jest.fn(),
    reset: jest.fn(),
    supported: true,
  }),
}));
jest.mock('@/stores/shoppingListStore', () => ({ useShoppingListStore: jest.fn(() => jest.fn()) }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
jest.mock('@/lib/api', () => ({ post: jest.fn(), get: jest.fn() }));
jest.mock('@/lib/sentry', () => ({ setUserContext: jest.fn(), clearUserContext: jest.fn() }));
jest.mock('@/components/MealRefinementSheet', () => ({ __esModule: true, default: () => null }));
/**
 * PillButton is mocked as a plain <button> so tests can click it without
 * needing the full animation/style infrastructure.
 */
jest.mock('@/components/ui/pill-button', () => ({
  PillButton: ({ children, onClick, disabled }: any) => {
    const R = require('react');
    return R.createElement('button', { onClick, disabled }, children);
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { post, get } from '@/lib/api';
import { useShoppingListStore } from '@/stores/shoppingListStore';
import GroceryStoreCoachSheet from '@/components/shopping/GroceryStoreCoachSheet';
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

// ═════════════════════════════════════════════════════════════════════════════
// SECTION A — pure-helper unit tests
// ═════════════════════════════════════════════════════════════════════════════

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
// handleAddToList simulation — brand picks applied to ownedIngredients
// ─────────────────────────────────────────────────────────────────────────────

describe('handleAddToList brand-pick substitution — ownedIngredients', () => {
  it('applies a brand pick when the matching ingredient lives in ownedIngredients, not shoppingList', () => {
    const shoppingList: Array<{ item: string; quantity: string; unit: string }> = [
      { item: 'chicken breast', quantity: '1', unit: 'lb' },
    ];
    const ownedIngredients: Array<{ item: string; quantity: string; unit: string }> = [
      { item: 'olive oil', quantity: '2', unit: 'tbsp' },
    ];

    const picks = new Map<string, BrandRec>();
    // The brand pick is keyed to an ingredient that lives only in ownedIngredients
    picks.set('olive oil', makeBrand('California Olive Ranch EVOO'));

    const allItems = [
      ...simulateAddToList(shoppingList, picks),
      ...simulateAddToList(ownedIngredients, picks),
    ];

    const oliveOilItem = allItems.find((i) => i.name === 'California Olive Ranch EVOO');
    expect(oliveOilItem).toBeDefined();
    // Generic name must NOT appear — the brand should have replaced it
    expect(allItems.find((i) => i.name === 'olive oil')).toBeUndefined();
  });

  it('keeps the generic name for ownedIngredients items that have no brand pick', () => {
    const ownedIngredients: Array<{ item: string; quantity: string; unit: string }> = [
      { item: 'kosher salt', quantity: '1', unit: 'tsp' },
    ];

    const result = simulateAddToList(ownedIngredients, new Map());

    expect(result[0].name).toBe('kosher salt');
  });

  it('applies picks independently to both shoppingList and ownedIngredients in the combined output', () => {
    const shoppingList: Array<{ item: string; quantity: string; unit: string }> = [
      { item: 'spinach', quantity: '1', unit: 'bag' },
    ];
    const ownedIngredients: Array<{ item: string; quantity: string; unit: string }> = [
      { item: 'olive oil', quantity: '2', unit: 'tbsp' },
      { item: 'garlic', quantity: '3', unit: 'cloves' },
    ];

    const picks = new Map<string, BrandRec>();
    picks.set('spinach', makeBrand('Earthbound Farm Organic'));
    picks.set('olive oil', makeBrand('California Olive Ranch EVOO'));
    // garlic has no pick — should stay generic

    const allItems = [
      ...simulateAddToList(shoppingList, picks),
      ...simulateAddToList(ownedIngredients, picks),
    ];

    expect(allItems[0].name).toBe('Earthbound Farm Organic');    // shoppingList pick
    expect(allItems[1].name).toBe('California Olive Ranch EVOO'); // ownedIngredients pick
    expect(allItems[2].name).toBe('garlic');                      // no pick → generic
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

// ═════════════════════════════════════════════════════════════════════════════
// SECTION B — component-level integration test
//
// Renders the real GroceryStoreCoachSheet, seeds a session that has BOTH
// shoppingList and ownedIngredients, picks a brand for the owned ingredient,
// triggers "Add All to Shopping List", and asserts the shopping-list store
// receives the branded item — not the generic name.
//
// This test would FAIL if `...toItems(result.ownedIngredients ?? [])` were
// deleted from handleAddToList, even though all Section A tests would pass.
// ═════════════════════════════════════════════════════════════════════════════

/** Session key matches the component's SESSION_KEY for user 'u1'. */
const SESSION_KEY = 'grocery-coach-session:u1';

/**
 * A coach result where:
 *   shoppingList    → chicken breast  (no brand will be picked)
 *   ownedIngredients → olive oil       (brand WILL be picked)
 *
 * productAdvice covers BOTH items so isAdviceStale() returns false and the
 * saved advice is restored without triggering a background re-fetch.
 */
const SEEDED_SESSION = {
  result: {
    meal: { name: 'Herb Chicken', description: 'Light and healthy', prepTime: '25m', servings: 2 },
    reasoning: ['High protein'],
    macros: { calories: 380, protein: 44, carbs: 6, fat: 13 },
    shoppingList: [
      { item: 'chicken breast', quantity: '1', unit: 'lb', category: 'Meat' },
    ],
    ownedIngredients: [
      { item: 'olive oil', quantity: '2', unit: 'tbsp' },
    ],
    followUpSuggestions: [],
    servingCount: 2,
  },
  productAdvice: {
    advice: [
      {
        ingredient: 'chicken breast',
        category: 'Meat',
        recommended: [{ brand: 'Tyson Air Chilled', rank: 1, grade: 'A', reason: 'Clean ingredients' }],
        avoid: [],
      },
      {
        ingredient: 'olive oil',
        category: 'Pantry',
        recommended: [{ brand: 'California Olive Ranch EVOO', rank: 1, grade: 'A', reason: 'Best cold-pressed' }],
        avoid: [],
      },
    ],
    profileUsed: [],
  },
  conversation: [],
  savedAt: Date.now(),
};

describe('handleAddToList — brand picks applied to ownedIngredients (component integration)', () => {
  /** Captured addItems spy — set fresh for each test. */
  let mockAddItems: jest.Mock;

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();

    // Wire up a fresh addItems spy that the component will call via
    //   const addItems = useShoppingListStore((s) => s.addItems);
    // The mock ignores the selector and returns whatever mockReturnValue says.
    mockAddItems = jest.fn();
    (useShoppingListStore as jest.Mock).mockReturnValue(mockAddItems);

    // Saved-keys fetch and any background advisor calls should resolve cleanly.
    (get as jest.Mock).mockResolvedValue({ items: [] });
    (post as jest.Mock).mockResolvedValue({});
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('passes the brand name — not the generic name — for an owned ingredient to addItems', async () => {
    // Seed the session so the component restores result + productAdvice on mount.
    localStorage.setItem(SESSION_KEY, JSON.stringify(SEEDED_SESSION));

    render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);

    // Wait for the restored meal result to appear.
    await waitFor(() => expect(screen.getByText('Herb Chicken')).toBeInTheDocument());

    // The Smart Cart section renders two "Pick" buttons — one per ingredient.
    // Order matches the productAdvice.advice array:
    //   index 0 → chicken breast  (shoppingList item)
    //   index 1 → olive oil       (ownedIngredients item)  ← the one we pick
    const pickButtons = await waitFor(() => {
      const btns = screen.getAllByText('Pick');
      expect(btns).toHaveLength(2);
      return btns;
    });

    // Click the olive oil "Pick" button (index 1).
    fireEvent.click(pickButtons[1]);

    // Now the button should read "✓ Picked" — confirm the state was updated.
    await waitFor(() => expect(screen.getAllByText('✓ Picked')).toHaveLength(1));

    // Click "Add All to Shopping List".
    fireEvent.click(screen.getByText('Add All to Shopping List'));

    // Assert addItems was called exactly once.
    expect(mockAddItems).toHaveBeenCalledTimes(1);

    const [itemsArg] = mockAddItems.mock.calls[0] as [Array<{ name: string }>];

    // The owned ingredient must arrive with the brand name, not 'olive oil'.
    const oliveOilEntry = itemsArg.find((i) => i.name === 'California Olive Ranch EVOO');
    expect(oliveOilEntry).toBeDefined();

    // The generic name must NOT appear anywhere in the call.
    expect(itemsArg.find((i) => i.name === 'olive oil')).toBeUndefined();

    // The shopping-list item (chicken breast) had no pick — it stays generic.
    const chickenEntry = itemsArg.find((i) => i.name === 'chicken breast');
    expect(chickenEntry).toBeDefined();
  });

  it('passes the generic owned-ingredient name when no brand is picked for it', async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(SEEDED_SESSION));

    render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Herb Chicken')).toBeInTheDocument());

    // Do NOT click any Pick button — no brands selected.
    fireEvent.click(screen.getByText('Add All to Shopping List'));

    expect(mockAddItems).toHaveBeenCalledTimes(1);

    const [itemsArg] = mockAddItems.mock.calls[0] as [Array<{ name: string }>];

    // Without a pick the owned ingredient must appear as its generic name.
    expect(itemsArg.find((i) => i.name === 'olive oil')).toBeDefined();
    expect(itemsArg.find((i) => i.name === 'California Olive Ranch EVOO')).toBeUndefined();
  });
});
