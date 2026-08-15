/**
 * @jest-environment jsdom
 *
 * GroceryStoreCoachSheet — Find a Product mode navigation
 *
 * Confirms that:
 *  1. The Build a Meal | Find a Product mode tabs are visible even when a
 *     restored meal session puts the sheet directly into the meal-result state.
 *  2. Switching to Find a Product from the meal-result state works, a search
 *     can be performed, and results (including a verified usual pick) render.
 *  3. Switching back to Build a Meal preserves the restored meal result.
 */

// ── Module mocks — must appear before imports ─────────────────────────────────

jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));
jest.mock('@/components/MealRefinementSheet', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('wouter', () => ({ useLocation: () => ['/', jest.fn()] }));
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...rest }: any) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const R = require('react');
      return R.createElement('div', rest, children);
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
  useAuth: jest.fn(() => ({ user: { id: 'test-user-fpm' } })),
}));
jest.mock('@/components/ui/pill-button', () => ({ PillButton: () => null }));
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

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { post, get } from '@/lib/api';
import GroceryStoreCoachSheet from '@/components/shopping/GroceryStoreCoachSheet';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SESSION_KEY = 'grocery-coach-session:test-user-fpm';

const MEAL_RESULT = {
  meal: {
    name: 'Grilled Chicken',
    description: 'Classic grilled chicken breast',
    prepTime: '25m',
    servings: 2,
  },
  reasoning: ['High protein'],
  macros: { calories: 350, protein: 42, carbs: 5, fat: 14 },
  ownedIngredients: [],
  shoppingList: [
    { item: 'Chicken Breast', quantity: '2', unit: 'lb', category: 'Meat' },
  ],
  followUpSuggestions: [],
  servingCount: 2,
};

const PRODUCT_RESULT = {
  advice: [
    {
      ingredient: 'Marinara Sauce',
      category: 'Sauce',
      usualPick: { brand: 'Carbone Marinara', reason: 'Your saved favorite' },
      recommended: [
        { brand: "Rao's Marinara", rank: 1, grade: 'A', reason: 'Low sodium' },
        { brand: 'Victoria Marinara', rank: 2, grade: 'B', reason: 'Clean list' },
      ],
      avoid: [],
    },
  ],
  profileUsed: ['Cardiac Protocol'],
};

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  (get as jest.Mock).mockResolvedValue({ items: [] });
});

function seedMealSession() {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      result: MEAL_RESULT,
      conversation: [],
      productAdvice: null,
      savedAt: Date.now(),
    }),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Find a Product mode navigation', () => {
  it('shows mode tabs on a restored meal-result state and allows switching to Find a Product', async () => {
    seedMealSession();
    (post as jest.Mock).mockResolvedValue(PRODUCT_RESULT);

    render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);

    // Restored meal result is visible…
    await waitFor(() => expect(screen.getByText('Grilled Chicken')).toBeInTheDocument());
    // …and the mode tabs are still reachable (regression: tabs used to hide in result state)
    expect(screen.getByTestId('tab-build-meal')).toBeInTheDocument();
    const productTab = screen.getByTestId('tab-find-product');
    expect(productTab).toBeInTheDocument();

    // Switch to Find a Product and search
    fireEvent.click(productTab);
    const input = await screen.findByTestId('input-find-product');
    fireEvent.change(input, { target: { value: 'marinara sauce' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-product-search'));
    });

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/grocery-coach/product-advisor', {
        ingredients: ['marinara sauce'],
      }),
    );

    // Results render, including the pinned verified usual pick
    await waitFor(() => expect(screen.getByTestId('card-usual-pick')).toBeInTheDocument());
    expect(screen.getByText('Carbone Marinara')).toBeInTheDocument();
    expect(screen.getByText("Rao's Marinara")).toBeInTheDocument();
  });

  it('preserves the meal result when toggling back to Build a Meal', async () => {
    seedMealSession();
    (post as jest.Mock).mockResolvedValue(PRODUCT_RESULT);

    render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Grilled Chicken')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('tab-find-product'));
    await screen.findByTestId('input-find-product');
    // Meal content is hidden while in product mode
    expect(screen.queryByText('Grilled Chicken')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tab-build-meal'));
    await waitFor(() => expect(screen.getByText('Grilled Chicken')).toBeInTheDocument());
  });

  it('surfaces the server 503 clinical-unavailable message instead of a generic error', async () => {
    (post as jest.Mock).mockRejectedValue(
      new Error('Clinical guidance temporarily unavailable. Please try again.'),
    );

    render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);
    fireEvent.click(screen.getByTestId('tab-find-product'));
    const input = await screen.findByTestId('input-find-product');
    fireEvent.change(input, { target: { value: 'milk' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-product-search'));
    });

    await waitFor(() =>
      expect(
        screen.getByText('Clinical guidance temporarily unavailable. Please try again.'),
      ).toBeInTheDocument(),
    );
  });
});
