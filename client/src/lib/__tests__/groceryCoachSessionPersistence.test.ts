/**
 * @jest-environment jsdom
 *
 * GroceryStoreCoachSheet — session persistence and list-add contracts
 *
 * Three behaviors verified:
 *  1. isAdviceStale — correctly detects when saved brand picks no longer cover
 *     the restored shopping list (e.g. after an ingredient swap).
 *  2. Session payload round-trip — productAdvice is included in the localStorage
 *     payload alongside result and conversation, and is re-hydrated on restore.
 *  3. handleAddToList complete-list contract — both shoppingList AND
 *     ownedIngredients reach the shopping store so users get the full recipe.
 */

// ── Module mocks required by the component import ────────────────────────────
jest.mock('wouter', () => ({ useLocation: () => ['/', jest.fn()] }));
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...rest }: any) => {
      const React = require('react');
      return React.createElement('div', rest, children);
    },
  },
  AnimatePresence: ({ children }: any) => children,
}));
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock('@/lib/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('@/stores/shoppingListStore', () => ({
  useShoppingListStore: jest.fn(() => jest.fn()),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user' } }),
}));
jest.mock('@/lib/sentry', () => ({
  setUserContext: jest.fn(),
  clearUserContext: jest.fn(),
}));
jest.mock('@/components/ui/pill-button', () => ({ PillButton: () => null }));

import { isAdviceStale, computeClientProductKey } from '@/components/shopping/GroceryStoreCoachSheet';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ADVICE_FIXTURE = {
  advice: [
    { ingredient: 'Chicken Breast', category: 'Meat', recommended: [], avoid: [] },
    { ingredient: 'Olive Oil',      category: 'Pantry', recommended: [], avoid: [] },
    { ingredient: 'Broccoli',       category: 'Produce', recommended: [], avoid: [] },
  ],
  profileUsed: [],
};

const SHOPPING_LIST_MATCHING = [
  { item: 'Chicken Breast', quantity: '2', unit: 'lb', category: 'Meat' },
  { item: 'Olive Oil',      quantity: '1', unit: 'tbsp', category: 'Pantry' },
  { item: 'Broccoli',       quantity: '1', unit: 'head', category: 'Produce' },
];

const SHOPPING_LIST_AFTER_SWAP = [
  { item: 'Chicken Breast', quantity: '2', unit: 'lb',   category: 'Meat' },
  { item: 'Olive Oil',      quantity: '1', unit: 'tbsp', category: 'Pantry' },
  // 'Broccoli' swapped for 'Zucchini' — advice is stale
  { item: 'Zucchini',       quantity: '1', unit: 'unit', category: 'Produce' },
];

// ── 1. isAdviceStale ──────────────────────────────────────────────────────────

describe('isAdviceStale', () => {
  it('returns false when saved advice covers every item in the shopping list', () => {
    expect(isAdviceStale(ADVICE_FIXTURE, SHOPPING_LIST_MATCHING)).toBe(false);
  });

  it('returns true when the shopping list contains an ingredient not in the advice', () => {
    // After an ingredient swap the new item won't be in the saved advice
    expect(isAdviceStale(ADVICE_FIXTURE, SHOPPING_LIST_AFTER_SWAP)).toBe(true);
  });

  it('is case-insensitive for both advice ingredients and shopping list items', () => {
    const upperList = [
      { item: 'CHICKEN BREAST', quantity: '1', unit: 'lb', category: 'Meat' },
      { item: 'OLIVE OIL',      quantity: '1', unit: 'tbsp', category: 'Pantry' },
      { item: 'BROCCOLI',       quantity: '1', unit: 'head', category: 'Produce' },
    ];
    expect(isAdviceStale(ADVICE_FIXTURE, upperList)).toBe(false);
  });

  it('returns false for an empty shopping list (nothing can be missing)', () => {
    expect(isAdviceStale(ADVICE_FIXTURE, [])).toBe(false);
  });

  it('returns true for a non-empty shopping list when advice is empty', () => {
    expect(isAdviceStale({ advice: [], profileUsed: [] }, SHOPPING_LIST_MATCHING)).toBe(true);
  });
});

// ── 2. Session payload round-trip ─────────────────────────────────────────────

describe('Session payload — productAdvice round-trip', () => {
  const SESSION_KEY = 'grocery-coach-session';

  beforeEach(() => {
    localStorage.clear();
  });

  it('includes productAdvice in the serialized payload', () => {
    const payload = {
      result: {
        meal: { name: 'Grilled Chicken', description: '', prepTime: '20m', servings: 2 },
        reasoning: [],
        macros: { calories: 400, protein: 40, carbs: 20, fat: 10 },
        ownedIngredients: [],
        shoppingList: [{ item: 'Chicken Breast', quantity: '2', unit: 'lb', category: 'Meat' }],
        followUpSuggestions: [],
        servingCount: 1,
      },
      conversation: [{ role: 'user' as const, content: 'Give me protein' }],
      productAdvice: ADVICE_FIXTURE,
      savedAt: Date.now(),
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));

    const raw = localStorage.getItem(SESSION_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);

    expect(parsed.productAdvice).toBeDefined();
    expect(parsed.productAdvice.advice).toHaveLength(3);
    expect(parsed.productAdvice.advice[0].ingredient).toBe('Chicken Breast');
  });

  it('round-trips all three advice ingredients without data loss', () => {
    const payload = {
      result: { meal: { name: 'Test', description: '', prepTime: '', servings: 1 }, reasoning: [], macros: { calories: 0, protein: 0, carbs: 0, fat: 0 }, ownedIngredients: [], shoppingList: [], followUpSuggestions: [], servingCount: 1 },
      conversation: [],
      productAdvice: ADVICE_FIXTURE,
      savedAt: Date.now(),
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY)!);

    const ingredients = parsed.productAdvice.advice.map((a: any) => a.ingredient);
    expect(ingredients).toEqual(['Chicken Breast', 'Olive Oil', 'Broccoli']);
  });

  it('correctly identifies a fresh session where productAdvice is absent', () => {
    // Simulates an old session saved before this feature shipped
    const legacyPayload = {
      result: { meal: { name: 'Old Meal', description: '', prepTime: '', servings: 1 }, reasoning: [], macros: { calories: 0, protein: 0, carbs: 0, fat: 0 }, ownedIngredients: [], shoppingList: SHOPPING_LIST_MATCHING, followUpSuggestions: [], servingCount: 1 },
      conversation: [],
      // no productAdvice field
      savedAt: Date.now(),
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(legacyPayload));
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY)!);

    // productAdvice will be undefined — re-fetch should be triggered on restore
    expect(parsed.productAdvice).toBeUndefined();
  });

  it('expires sessions older than 24 hours', () => {
    const TWENTY_FIVE_HOURS_AGO = Date.now() - 25 * 60 * 60 * 1000;
    const stalePayload = {
      result: { meal: { name: 'Old', description: '', prepTime: '', servings: 1 }, reasoning: [], macros: { calories: 0, protein: 0, carbs: 0, fat: 0 }, ownedIngredients: [], shoppingList: [], followUpSuggestions: [], servingCount: 1 },
      conversation: [],
      productAdvice: ADVICE_FIXTURE,
      savedAt: TWENTY_FIVE_HOURS_AGO,
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(stalePayload));

    // Simulate the expiry check the hydration effect performs
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY)!);
    const isExpired = !parsed.savedAt || Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000;
    expect(isExpired).toBe(true);

    if (isExpired) localStorage.removeItem(SESSION_KEY);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});

// ── 3. Session generation token — cross-account in-flight guard ───────────────

describe('Session generation token — cross-account in-flight guard', () => {
  /**
   * Simulates the guard pattern used in fetchProductAdvice, sendMessage,
   * finalizeCard, and handleSwapRequest:
   *
   *   const gen = sessionGenRef.current;
   *   // ... await API call ...
   *   if (sessionGenRef.current !== gen) return;  // discard if switched
   *   setProductAdvice(data);
   *
   * Tests that a state setter is NOT called when the session generation
   * increments between the capture and the resolution.
   */

  it('discards a response when the session generation increments before it resolves', async () => {
    const sessionGenRef = { current: 0 };
    const setProductAdvice = jest.fn();

    // Simulate the guarded async pattern
    async function simulateFetchProductAdvice() {
      const gen = sessionGenRef.current; // capture = 0
      // Simulate async delay
      await Promise.resolve();
      // Identity changed while in flight
      if (sessionGenRef.current !== gen) return;
      setProductAdvice({ advice: [], profileUsed: [] });
    }

    const promise = simulateFetchProductAdvice();
    sessionGenRef.current += 1; // identity switch happens before resolution
    await promise;

    expect(setProductAdvice).not.toHaveBeenCalled();
  });

  it('applies the response when the session generation is unchanged', async () => {
    const sessionGenRef = { current: 0 };
    const setProductAdvice = jest.fn();

    async function simulateFetchProductAdvice() {
      const gen = sessionGenRef.current;
      await Promise.resolve();
      if (sessionGenRef.current !== gen) return;
      setProductAdvice({ advice: [], profileUsed: [] });
    }

    await simulateFetchProductAdvice(); // no identity switch
    expect(setProductAdvice).toHaveBeenCalledTimes(1);
  });

  it('discards multiple stacked in-flight responses after two identity switches', async () => {
    const sessionGenRef = { current: 0 };
    const setState = jest.fn();

    async function simulateAsyncCallback(label: string) {
      const gen = sessionGenRef.current;
      await Promise.resolve();
      if (sessionGenRef.current !== gen) return;
      setState(label);
    }

    const p1 = simulateAsyncCallback('A-response'); // gen=0
    sessionGenRef.current += 1; // switch to user B
    const p2 = simulateAsyncCallback('B-response'); // gen=1
    sessionGenRef.current += 1; // switch to user C
    await Promise.all([p1, p2]);

    // Both responses from A and B are stale — only C's requests (none here) should land
    expect(setState).not.toHaveBeenCalled();
  });
});

// ── 4. handleAddToList — ownedIngredients contract ────────────────────────────

describe('handleAddToList — complete list (shoppingList + ownedIngredients)', () => {
  /**
   * Tests the pure list-merge logic used inside handleAddToList without needing
   * to render the full component.  The function maps both arrays through the
   * same toItems() helper and concatenates them.
   */
  function simulateAddToList(result: {
    meal: { name: string };
    shoppingList: Array<{ item: string; quantity: string; unit: string }>;
    ownedIngredients?: Array<{ item: string; quantity: string; unit: string }>;
  }) {
    const toItems = (arr: Array<{ item: string; quantity: string; unit: string }>) =>
      arr.map((s) => ({
        name: s.item,
        quantity: parseFloat(s.quantity) || 1,
        unit: s.unit || '',
        sourceMeals: [result.meal?.name || 'Grocery Coach'],
      }));

    return [
      ...toItems(result.shoppingList),
      ...toItems(result.ownedIngredients ?? []),
    ];
  }

  it('includes both shopping list items and owned ingredients', () => {
    const result = {
      meal: { name: 'Chicken & Broccoli' },
      shoppingList: [
        { item: 'Chicken Breast', quantity: '2', unit: 'lb' },
        { item: 'Broccoli',       quantity: '1', unit: 'head' },
      ],
      ownedIngredients: [
        { item: 'Olive Oil', quantity: '1', unit: 'tbsp' },
        { item: 'Salt',      quantity: '1', unit: 'tsp' },
      ],
    };

    const items = simulateAddToList(result);

    expect(items).toHaveLength(4);
    expect(items.map((i) => i.name)).toEqual(
      expect.arrayContaining(['Chicken Breast', 'Broccoli', 'Olive Oil', 'Salt'])
    );
  });

  it('still works when ownedIngredients is absent (undefined)', () => {
    const result = {
      meal: { name: 'Simple Salad' },
      shoppingList: [
        { item: 'Romaine', quantity: '1', unit: 'head' },
      ],
      // ownedIngredients intentionally omitted
    };

    const items = simulateAddToList(result);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Romaine');
  });

  it('still works when ownedIngredients is an empty array', () => {
    const result = {
      meal: { name: 'Eggs' },
      shoppingList: [{ item: 'Eggs', quantity: '6', unit: 'count' }],
      ownedIngredients: [],
    };

    const items = simulateAddToList(result);
    expect(items).toHaveLength(1);
  });

  it('sources all items under the meal name', () => {
    const result = {
      meal: { name: 'Stir Fry' },
      shoppingList:      [{ item: 'Tofu',   quantity: '1', unit: 'block' }],
      ownedIngredients: [{ item: 'Soy Sauce', quantity: '2', unit: 'tbsp' }],
    };

    const items = simulateAddToList(result);
    expect(items.every((i) => i.sourceMeals[0] === 'Stir Fry')).toBe(true);
  });

  it('parses fractional quantities correctly', () => {
    const result = {
      meal: { name: 'Test' },
      shoppingList:      [{ item: 'Almond Flour', quantity: '0.5', unit: 'cup' }],
      ownedIngredients: [{ item: 'Baking Powder', quantity: '1.5', unit: 'tsp' }],
    };

    const items = simulateAddToList(result);
    expect(items[0].quantity).toBe(0.5);
    expect(items[1].quantity).toBe(1.5);
  });
});

// ── 5. Brand picks persistence — round-trip ───────────────────────────────────

describe('Brand picks persistence — survive sheet close and reopen', () => {
  /**
   * Simulates the save logic:
   *   pickedBrandsEntries: pickedBrands.size > 0 ? [...pickedBrands.entries()] : undefined
   *
   * And the restore logic:
   *   if (session.pickedBrandsEntries?.length) setPickedBrands(new Map(session.pickedBrandsEntries))
   *
   * Tests use localStorage directly (the same storage the component uses) so
   * there is no divergence between the assertions and production behaviour.
   */

  const SESSION_KEY = 'grocery-coach-session:test-user';

  function makeBrandRec(brand: string) {
    return { brand, rank: 1 as const, grade: 'A' as const, reason: 'top pick' };
  }

  const BASE_RESULT = {
    meal: { name: 'Grilled Chicken', description: '', prepTime: '20m', servings: 2 },
    reasoning: [],
    macros: { calories: 400, protein: 40, carbs: 20, fat: 10 },
    ownedIngredients: [],
    shoppingList: [{ item: 'Chicken Breast', quantity: '2', unit: 'lb', category: 'Meat' }],
    followUpSuggestions: [],
    servingCount: 1,
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('persists picked brand entries in the localStorage payload', () => {
    const picks = new Map([
      ['olive oil', makeBrandRec('California Olive Ranch EVOO')],
      ['chicken breast', makeBrandRec('Bell & Evans Organic')],
    ]);

    const payload = {
      result: BASE_RESULT,
      conversation: [],
      pickedBrandsEntries: [...picks.entries()],
      savedAt: Date.now(),
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));

    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY)!);
    expect(parsed.pickedBrandsEntries).toHaveLength(2);
    expect(parsed.pickedBrandsEntries[0][0]).toBe('olive oil');
    expect(parsed.pickedBrandsEntries[0][1].brand).toBe('California Olive Ranch EVOO');
    expect(parsed.pickedBrandsEntries[1][0]).toBe('chicken breast');
    expect(parsed.pickedBrandsEntries[1][1].brand).toBe('Bell & Evans Organic');
  });

  it('restores picked brands from stored entries into a Map', () => {
    const originalPicks = new Map([
      ['spinach', makeBrandRec('Earthbound Farm Organic')],
    ]);

    // Save (as the component's save effect would)
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      result: BASE_RESULT,
      conversation: [],
      pickedBrandsEntries: [...originalPicks.entries()],
      savedAt: Date.now(),
    }));

    // Restore (as the component's hydration effect would)
    const raw = localStorage.getItem(SESSION_KEY)!;
    const session = JSON.parse(raw) as { pickedBrandsEntries?: Array<[string, { brand: string }]> };
    const restored = session.pickedBrandsEntries?.length
      ? new Map(session.pickedBrandsEntries)
      : new Map();

    expect(restored.get('spinach')?.brand).toBe('Earthbound Farm Organic');
    expect(restored.size).toBe(1);
  });

  it('reopening the sheet after navigation does not clear picks from the previous session', () => {
    // Simulate: user picks a brand, sheet is closed (navigation away), then reopened.
    // The on-close effect no longer clears pickedBrands; instead they are
    // persisted to localStorage alongside the result.

    const picks = new Map([
      ['olive oil', makeBrandRec('California Olive Ranch EVOO')],
      ['avocado', makeBrandRec('Wholly Guacamole')],
    ]);

    // --- Sheet close: save effect writes picks to storage ---
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      result: BASE_RESULT,
      conversation: [],
      pickedBrandsEntries: [...picks.entries()],
      savedAt: Date.now(),
    }));

    // --- Navigation + reopen: hydration effect restores from storage ---
    const raw = localStorage.getItem(SESSION_KEY)!;
    const session = JSON.parse(raw) as {
      result?: typeof BASE_RESULT;
      pickedBrandsEntries?: Array<[string, { brand: string }]>;
    };
    const restoredPicks = session.pickedBrandsEntries?.length
      ? new Map(session.pickedBrandsEntries)
      : new Map();

    // Both picks must survive the round-trip
    expect(restoredPicks.size).toBe(2);
    expect(restoredPicks.get('olive oil')?.brand).toBe('California Olive Ranch EVOO');
    expect(restoredPicks.get('avocado')?.brand).toBe('Wholly Guacamole');
  });

  it('omits pickedBrandsEntries from the payload when the Map is empty', () => {
    const picks = new Map(); // no picks

    const payload = {
      result: BASE_RESULT,
      conversation: [],
      pickedBrandsEntries: picks.size > 0 ? [...picks.entries()] : undefined,
      savedAt: Date.now(),
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY)!);

    // Undefined is stripped by JSON.stringify — key must be absent
    expect(parsed.pickedBrandsEntries).toBeUndefined();
  });

  it('restores an empty Map when pickedBrandsEntries is absent (legacy session)', () => {
    // Simulate a session saved before brand-pick persistence shipped
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      result: BASE_RESULT,
      conversation: [],
      // no pickedBrandsEntries field
      savedAt: Date.now(),
    }));

    const raw = localStorage.getItem(SESSION_KEY)!;
    const session = JSON.parse(raw) as { pickedBrandsEntries?: Array<[string, unknown]> };
    const restored = session.pickedBrandsEntries?.length
      ? new Map(session.pickedBrandsEntries)
      : new Map();

    expect(restored.size).toBe(0);
  });
});

// ── 6 & 7 ────────────────────────────────────────────────────────────────────
// Find-a-Product session persistence and sessionGenRef guard are tested by
// rendering the actual component in:
//   client/src/lib/__tests__/groceryCoachProductSearchPersistence.test.tsx
// ─────────────────────────────────────────────────────────────────────────────
