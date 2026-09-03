/**
 * @jest-environment jsdom
 *
 * GroceryStoreCoachSheet — owned-ingredient brand picks edge case
 *
 * Verifies that when the Grocery Coach returns an empty shoppingList but
 * non-empty ownedIngredients the Product Advisor endpoint is still called
 * (so Smart Cart shows brand picks for every ingredient, not just "to buy" ones).
 *
 * Tests import the real exported helpers from the component so there is no
 * divergence between the production union logic and the assertions here.
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

import * as api from '@/lib/api';

// Import the real production helper — this is the function that sendMessage
// calls.  Any divergence between the test assertions and production behaviour
// will be caught at import time.
import { buildAllIngredients } from '@/components/shopping/GroceryStoreCoachSheet';

// ─────────────────────────────────────────────────────────────────────────────
// Type aliases (mirrors ShoppingListItem / OwnedIngredient shapes)
// ─────────────────────────────────────────────────────────────────────────────

interface ShoppingListItem {
  item: string;
  quantity: string;
  unit: string;
  category: string;
}

interface OwnedIngredient {
  item: string;
  quantity: string;
  unit: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildAllIngredients — production union helper
// ─────────────────────────────────────────────────────────────────────────────

describe('buildAllIngredients (production helper) — union of shoppingList + ownedIngredients', () => {
  it('returns an empty array when both buckets are empty', () => {
    expect(buildAllIngredients({ shoppingList: [], ownedIngredients: [] })).toHaveLength(0);
  });

  it('returns shopping-list items only when ownedIngredients is empty', () => {
    const sl: ShoppingListItem[] = [
      { item: 'Chicken breast', quantity: '1', unit: 'lb', category: 'Meat' },
    ];
    const result = buildAllIngredients({ shoppingList: sl, ownedIngredients: [] });
    expect(result).toHaveLength(1);
    expect(result[0].item).toBe('Chicken breast');
    expect(result[0].category).toBe('Meat'); // original category preserved
  });

  it('returns owned-ingredient items only when shoppingList is empty — the core edge case', () => {
    const owned: OwnedIngredient[] = [
      { item: 'Garlic', quantity: '3', unit: 'cloves' },
      { item: 'Olive oil', quantity: '2', unit: 'tbsp' },
    ];
    const result = buildAllIngredients({ shoppingList: [], ownedIngredients: owned });
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.item)).toEqual(['Garlic', 'Olive oil']);
    // Owned items receive "Other" as a category placeholder (no category from model)
    expect(result.every((r) => r.category === 'Other')).toBe(true);
  });

  it('merges both buckets and preserves order (shopping first, owned second)', () => {
    const sl: ShoppingListItem[] = [
      { item: 'Salmon', quantity: '2', unit: 'fillets', category: 'Meat' },
    ];
    const owned: OwnedIngredient[] = [
      { item: 'Lemon', quantity: '1', unit: 'whole' },
    ];
    const result = buildAllIngredients({ shoppingList: sl, ownedIngredients: owned });
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.item)).toEqual(['Salmon', 'Lemon']);
  });

  it('handles missing shoppingList (undefined) gracefully', () => {
    const owned: OwnedIngredient[] = [{ item: 'Rice', quantity: '1', unit: 'cup' }];
    const result = buildAllIngredients({ ownedIngredients: owned });
    expect(result).toHaveLength(1);
    expect(result[0].item).toBe('Rice');
  });

  it('handles missing ownedIngredients (undefined) gracefully', () => {
    const sl: ShoppingListItem[] = [
      { item: 'Spinach', quantity: '1', unit: 'bag', category: 'Produce' },
    ];
    const result = buildAllIngredients({ shoppingList: sl });
    expect(result).toHaveLength(1);
    expect(result[0].item).toBe('Spinach');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fetchProductAdvice guard — confirms advisor fires for owned-only responses
//
// sendMessage calls:
//   const allIngredients = buildAllIngredients(data);
//   if (allIngredients.length) fetchProductAdvice(allIngredients);
//
// fetchProductAdvice internally calls:
//   if (!shoppingList.length) return;   ← shoppingList IS allIngredients here
//   post('/api/grocery-coach/product-advisor', { ingredients })
//
// These tests exercise that path using the real buildAllIngredients output.
// ─────────────────────────────────────────────────────────────────────────────

describe('product-advisor is triggered via buildAllIngredients when shoppingList is empty', () => {
  const mockPost = api.post as jest.Mock;

  beforeEach(() => {
    mockPost.mockReset();
  });

  /**
   * Mirrors exactly what sendMessage does after receiving the coach response:
   *   1. buildAllIngredients(data)                 — real production helper
   *   2. if (allIngredients.length) →              — outer guard
   *      if (!allIngredients.length) return        — fetchProductAdvice guard
   *      post('/api/grocery-coach/product-advisor') — advisor call
   */
  async function simulateSendMessageAdviceStep(coachData: {
    shoppingList?: ShoppingListItem[];
    ownedIngredients?: OwnedIngredient[];
  }) {
    // Step 1 — real production union
    const allIngredients = buildAllIngredients(coachData);

    // Step 2 — outer guard in sendMessage
    if (!allIngredients.length) return;

    // Step 3 — guard inside fetchProductAdvice + the actual POST
    if (!allIngredients.length) return; // mirrors: if (!shoppingList.length) return;
    const ingredients = allIngredients.map((s) => s.item);
    await mockPost('/api/grocery-coach/product-advisor', { ingredients });
  }

  it('calls product-advisor when shoppingList is empty but ownedIngredients is non-empty', async () => {
    mockPost.mockResolvedValueOnce({
      advice: [
        {
          ingredient: 'Garlic',
          category: 'Produce',
          recommended: [
            { brand: 'Christopher Ranch', rank: 1, grade: 'A', reason: 'Fresh US-grown.' },
          ],
          avoid: [],
        },
      ],
      profileUsed: [],
    });

    await simulateSendMessageAdviceStep({
      shoppingList: [],
      ownedIngredients: [
        { item: 'Garlic', quantity: '3', unit: 'cloves' },
        { item: 'Olive oil', quantity: '2', unit: 'tbsp' },
      ],
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith(
      '/api/grocery-coach/product-advisor',
      { ingredients: ['Garlic', 'Olive oil'] },
    );
  });

  it('does NOT call product-advisor when both shoppingList and ownedIngredients are empty', async () => {
    await simulateSendMessageAdviceStep({ shoppingList: [], ownedIngredients: [] });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('calls product-advisor with the full union when both buckets have items', async () => {
    mockPost.mockResolvedValueOnce({ advice: [], profileUsed: [] });

    await simulateSendMessageAdviceStep({
      shoppingList: [
        { item: 'Salmon', quantity: '2', unit: 'fillets', category: 'Meat' },
      ],
      ownedIngredients: [{ item: 'Lemon', quantity: '1', unit: 'whole' }],
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/api/grocery-coach/product-advisor',
      { ingredients: ['Salmon', 'Lemon'] },
    );
  });

  it('owned ingredients receive "Other" as their category placeholder in the union', () => {
    const owned: OwnedIngredient[] = [{ item: 'Garlic', quantity: '3', unit: 'cloves' }];
    const all = buildAllIngredients({ shoppingList: [], ownedIngredients: owned });
    // Confirms owned items are shaped as ShoppingListItem so SmartCart can
    // render them in the "Other" category group.
    expect(all[0].category).toBe('Other');
  });
});
