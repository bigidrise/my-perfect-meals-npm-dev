/**
 * @jest-environment jsdom
 *
 * GroceryStoreCoachSheet — Find a Product mode navigation
 *
 * Confirms that:
 *  1. The Build a Meal | Find a Product mode tabs are visible even when a
 *     restored meal session puts the sheet directly into the meal-result state.
 *  2. Switching to Find a Product from the meal-result state works, a search
 *     reaches Product Scan's by-name API and renders its existing results.
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
jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn(),
  queryClient: { invalidateQueries: jest.fn() },
}));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: { items: [] } }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/voice/VoiceInputButton', () => ({
  __esModule: true,
  default: ({ onChange }: any) => <button onClick={() => onChange("I'm looking for spaghetti sauce.")}>Dictate product</button>,
}));
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
  ok: true,
  result: {
    productName: 'Spaghetti sauce', analysisMethod: 'by_name', alignmentGrade: 'B',
    overallSummary: 'Compare sauces for your nutrition goals.', verdict: 'Check current sodium and serving size.',
    verdictLevel: 'caution', analysisProfile: ['Cardiac Protocol'],
    scoreCards: Object.fromEntries(['kids', 'adults', 'diet', 'fitnessGoal'].map(key => [key, { verdict: 'neutral', reason: 'Compare the current label.' }])),
    betterAlternatives: [
      { category: "Rao's Marinara", whyBetter: ['Compare sodium for your goals.'], targetCriteria: 'Check current sodium.' },
      { category: 'Victoria Marinara', whyBetter: ['Compare ingredients.'], targetCriteria: 'Check current ingredients.' },
      { category: 'Carbone Marinara', whyBetter: ['Compare serving size.'], targetCriteria: 'Check current serving size.' },
    ],
    ingredientConsiderations: ['Unverified options: confirm the current ingredient and allergen label.'],
    educationalFooter: 'Not a verified label scan.', extractedIngredients: [], highRiskFindings: [],
    outcomeCards: [], ingredientDecoder: [], mayNotAlignWith: [], betterFor: [], householdNotes: [],
    profileFactorsUsed: ['Cardiac Protocol'], whatMattersMost: [], fallbackUsed: false,
  },
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
      expect(post).toHaveBeenCalledWith('/api/biometrics/ingredient-scan-by-name', {
        productName: 'marinara sauce',
      }),
    );

    // The actual shared Product Scan result component renders options and warnings.
    await screen.findByText('Compare sauces for your nutrition goals.');
    expect(screen.getByText('Carbone Marinara')).toBeInTheDocument();
    expect(screen.getByText("Rao's Marinara")).toBeInTheDocument();
    expect(screen.getByText('Victoria Marinara')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText(/Unverified options/)).toBeInTheDocument();
    expect(screen.getByTestId('tab-build-meal')).toBeInTheDocument();
  });

  it('submits the editable voice transcript through the same by-name path', async () => {
    (post as jest.Mock).mockResolvedValue(PRODUCT_RESULT);
    render(<GroceryStoreCoachSheet open onOpenChange={jest.fn()} />);
    fireEvent.click(screen.getByTestId('tab-find-product'));
    fireEvent.click(screen.getByText('Dictate product'));
    expect(screen.getByTestId('input-find-product')).toHaveValue("I'm looking for spaghetti sauce.");
    expect(post).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByTestId('input-find-product'), { key: 'Enter' });
    await screen.findByText('Compare sauces for your nutrition goals.');
    expect(post).toHaveBeenCalledWith('/api/biometrics/ingredient-scan-by-name', {
      productName: "I'm looking for spaghetti sauce.",
    });
  });

  it('does not fabricate a grade or pad a short list when analysis lacks a supported grade', async () => {
    (post as jest.Mock).mockResolvedValue({
      ok: true, result: { ...PRODUCT_RESULT.result, gradeUnavailable: true,
        betterAlternatives: PRODUCT_RESULT.result.betterAlternatives.slice(0, 1) },
    });
    render(<GroceryStoreCoachSheet open onOpenChange={jest.fn()} />);
    fireEvent.click(screen.getByTestId('tab-find-product'));
    fireEvent.change(screen.getByTestId('input-find-product'), { target: { value: 'spaghetti sauce' } });
    fireEvent.click(screen.getByTestId('button-product-search'));
    await screen.findByText("Rao's Marinara");
    expect(screen.queryByText('B')).not.toBeInTheDocument();
    expect(screen.queryByText('Victoria Marinara')).not.toBeInTheDocument();
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
      {
        status: 503,
        body: JSON.stringify({
          error: 'Clinical guidance temporarily unavailable. Please try again.',
          retryable: true,
        }),
      },
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
    expect(screen.queryByText(/API 503|retryable/)).not.toBeInTheDocument();
  });

  it('explains unverified products without exposing an HTTP error or recommending a brand', async () => {
    (post as jest.Mock).mockRejectedValue({
      status: 422,
      body: JSON.stringify({
        code: 'PRODUCT_INGREDIENTS_UNVERIFIED',
        error: 'Complete product ingredients cannot be verified.',
        retryable: false,
      }),
    });

    render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);
    fireEvent.click(screen.getByTestId('tab-find-product'));
    fireEvent.change(await screen.findByTestId('input-find-product'), { target: { value: 'milk' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-product-search'));
    });

    // This suite mocks translations to return keys; the real English copy
    // explains Product Scan rather than exposing the HTTP body.
    await waitFor(() => expect(screen.getByText('findProduct.verificationRequired')).toBeInTheDocument());
    expect(screen.queryByText(/API 422|PRODUCT_INGREDIENTS_UNVERIFIED/)).not.toBeInTheDocument();
  });
});
