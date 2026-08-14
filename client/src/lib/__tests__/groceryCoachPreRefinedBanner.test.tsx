/**
 * @jest-environment jsdom
 *
 * GroceryStoreCoachSheet — "Restore original" banner lifecycle
 *
 * Confirms that:
 *  1. The "Restore original" banner appears after a meal is refined via
 *     MealRefinementSheet.
 *  2. Sending a typed follow-up message clears preRefinedResult so the
 *     banner is absent when the new result loads.
 *  3. The "Try a Different Meal" (Generate Another) path also clears it,
 *     because handleGenerateAnother delegates to the same sendMessage callback.
 */

// ── Module mocks — must appear before imports ─────────────────────────────────

// Render portals inline so the component's content appears in the test document
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

// Capture the onRefined callback so tests can trigger refinement programmatically
let capturedOnRefined: ((refined: any) => void) | null = null;
jest.mock('@/components/MealRefinementSheet', () => ({
  __esModule: true,
  default: (props: any) => {
    // Store the callback whenever the sheet is open so tests can call it.
    // When open=false we leave the previous capture intact — the component
    // still renders but the callback doesn't change.
    if (props.open) capturedOnRefined = props.onRefined;
    return null;
  },
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
  useAuth: () => ({ user: { id: 'test-user-banner' } }),
}));
jest.mock('@/components/ui/pill-button', () => ({ PillButton: () => null }));

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { post, get } from '@/lib/api';
import GroceryStoreCoachSheet from '@/components/shopping/GroceryStoreCoachSheet';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FIRST_RESULT = {
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

const REFINED_RESULT = {
  ...FIRST_RESULT,
  meal: {
    ...FIRST_RESULT.meal,
    name: 'Herb-Crusted Grilled Chicken',
    description: 'Refined version with herbs',
  },
};

const SECOND_RESULT = {
  meal: {
    name: 'Salmon Bowl',
    description: 'Fresh salmon with rice',
    prepTime: '20m',
    servings: 1,
  },
  reasoning: ['Omega-3 rich'],
  macros: { calories: 480, protein: 38, carbs: 40, fat: 16 },
  ownedIngredients: [],
  shoppingList: [
    { item: 'Salmon Fillet', quantity: '6', unit: 'oz', category: 'Meat' },
  ],
  followUpSuggestions: [],
  servingCount: 1,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupPostMock(firstResponse = FIRST_RESULT) {
  (post as jest.Mock).mockImplementation(async (url: string) => {
    if (url === '/api/grocery-coach/recommend') return firstResponse;
    if (url === '/api/grocery-coach/finalize-card') return { status: 'failed' };
    if (url === '/api/grocery-coach/product-advisor') return { advice: [] };
    return {};
  });
  (get as jest.Mock).mockResolvedValue({ items: [] });
}

/** Renders the sheet, clicks a Quick Start chip, and waits for the result. */
async function renderAndGetFirstResult() {
  const onOpenChange = jest.fn();
  render(<GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />);

  // Click the first Quick Start chip to trigger sendMessage
  const chip = screen.getByText("What's for dinner tonight?");
  await act(async () => {
    fireEvent.click(chip);
  });

  // Wait for the first result meal name to appear
  await waitFor(
    () => expect(screen.getByText('Grilled Chicken')).toBeInTheDocument(),
    { timeout: 3000 },
  );

  return { onOpenChange };
}

/** Clicks the "Refine Meal" button and calls onRefined with the supplied payload. */
async function refineCurrentMeal(refinedPayload: typeof REFINED_RESULT) {
  const refineBtn = screen.getByText('Refine Meal');
  await act(async () => {
    fireEvent.click(refineBtn);
  });

  // capturedOnRefined is now set by the MealRefinementSheet mock
  expect(capturedOnRefined).not.toBeNull();
  await act(async () => {
    capturedOnRefined!(refinedPayload);
  });
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  capturedOnRefined = null;
  localStorage.clear();
  jest.clearAllMocks();
  setupPostMock();
});

// ── 1. Banner appears after refinement ───────────────────────────────────────

describe('"Restore original" banner visibility', () => {
  it('appears after a meal is refined via MealRefinementSheet', async () => {
    await renderAndGetFirstResult();
    await refineCurrentMeal(REFINED_RESULT);

    await waitFor(() =>
      expect(screen.getByText('Restore original')).toBeInTheDocument(),
    );
    expect(screen.getByText('Showing refined version')).toBeInTheDocument();
  });
});

// ── 2. Banner absent after typed follow-up ────────────────────────────────────

describe('Typed follow-up after refinement', () => {
  it('banner is absent when the new result loads after a typed message', async () => {
    await renderAndGetFirstResult();
    await refineCurrentMeal(REFINED_RESULT);

    // Confirm banner is visible before the follow-up
    await waitFor(() =>
      expect(screen.getByText('Restore original')).toBeInTheDocument(),
    );

    // Configure post to return SECOND_RESULT for the next recommend call
    (post as jest.Mock).mockImplementation(async (url: string) => {
      if (url === '/api/grocery-coach/recommend') return SECOND_RESULT;
      if (url === '/api/grocery-coach/finalize-card') return { status: 'failed' };
      if (url === '/api/grocery-coach/product-advisor') return { advice: [] };
      return {};
    });

    // Type a follow-up message and submit
    const textarea = screen.getByPlaceholderText(
      'Make it cheaper… faster… vegetarian…',
    );
    fireEvent.change(textarea, { target: { value: 'Something lighter please' } });

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    });

    // Wait for the new result to appear
    await waitFor(
      () => expect(screen.getByText('Salmon Bowl')).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // Banner must be gone
    expect(screen.queryByText('Restore original')).not.toBeInTheDocument();
    expect(screen.queryByText('Showing refined version')).not.toBeInTheDocument();
  });

  it('banner is absent immediately when sendMessage fires (before new result lands)', async () => {
    await renderAndGetFirstResult();
    await refineCurrentMeal(REFINED_RESULT);

    await waitFor(() =>
      expect(screen.getByText('Restore original')).toBeInTheDocument(),
    );

    // Make the recommend call hang so we can check the loading state
    let resolveRecommend!: (v: any) => void;
    (post as jest.Mock).mockImplementation(async (url: string) => {
      if (url === '/api/grocery-coach/recommend') {
        return new Promise((res) => { resolveRecommend = res; });
      }
      return { advice: [] };
    });

    const textarea = screen.getByPlaceholderText(
      'Make it cheaper… faster… vegetarian…',
    );
    fireEvent.change(textarea, { target: { value: 'Make it vegan' } });

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    });

    // While loading, the banner should already be gone (cleared synchronously)
    await waitFor(() =>
      expect(screen.queryByText('Restore original')).not.toBeInTheDocument(),
    );

    // Resolve the pending request so the component unmounts cleanly
    await act(async () => {
      resolveRecommend(SECOND_RESULT);
    });
  });
});

// ── 3. Banner absent after "Try a Different Meal" (Generate Another) ──────────

describe('"Try a Different Meal" (Generate Another) path', () => {
  it('banner is absent when the new result loads after Generate Another', async () => {
    await renderAndGetFirstResult();
    await refineCurrentMeal(REFINED_RESULT);

    await waitFor(() =>
      expect(screen.getByText('Restore original')).toBeInTheDocument(),
    );

    // Configure second result
    (post as jest.Mock).mockImplementation(async (url: string) => {
      if (url === '/api/grocery-coach/recommend') return SECOND_RESULT;
      if (url === '/api/grocery-coach/finalize-card') return { status: 'failed' };
      if (url === '/api/grocery-coach/product-advisor') return { advice: [] };
      return {};
    });

    // Click "Try a Different Meal" — this calls handleGenerateAnother → sendMessage
    const generateBtn = screen.getByText('Try a Different Meal');
    await act(async () => {
      fireEvent.click(generateBtn);
    });

    // Wait for new result
    await waitFor(
      () => expect(screen.getByText('Salmon Bowl')).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // Banner must be gone
    expect(screen.queryByText('Restore original')).not.toBeInTheDocument();
    expect(screen.queryByText('Showing refined version')).not.toBeInTheDocument();
  });

  it('banner is absent during the loading phase triggered by Generate Another', async () => {
    await renderAndGetFirstResult();
    await refineCurrentMeal(REFINED_RESULT);

    await waitFor(() =>
      expect(screen.getByText('Restore original')).toBeInTheDocument(),
    );

    let resolveRecommend!: (v: any) => void;
    (post as jest.Mock).mockImplementation(async (url: string) => {
      if (url === '/api/grocery-coach/recommend') {
        return new Promise((res) => { resolveRecommend = res; });
      }
      return { advice: [] };
    });

    const generateBtn = screen.getByText('Try a Different Meal');
    await act(async () => {
      fireEvent.click(generateBtn);
    });

    // Banner should clear synchronously when sendMessage fires
    await waitFor(() =>
      expect(screen.queryByText('Restore original')).not.toBeInTheDocument(),
    );

    // Resolve cleanly
    await act(async () => {
      resolveRecommend(SECOND_RESULT);
    });
  });

  it('calling Generate Another without a prior refinement leaves banner absent', async () => {
    await renderAndGetFirstResult();

    // No refinement — banner should not be visible at all
    expect(screen.queryByText('Restore original')).not.toBeInTheDocument();

    (post as jest.Mock).mockImplementation(async (url: string) => {
      if (url === '/api/grocery-coach/recommend') return SECOND_RESULT;
      if (url === '/api/grocery-coach/finalize-card') return { status: 'failed' };
      if (url === '/api/grocery-coach/product-advisor') return { advice: [] };
      return {};
    });

    const generateBtn = screen.getByText('Try a Different Meal');
    await act(async () => {
      fireEvent.click(generateBtn);
    });

    await waitFor(
      () => expect(screen.getByText('Salmon Bowl')).toBeInTheDocument(),
      { timeout: 3000 },
    );

    expect(screen.queryByText('Restore original')).not.toBeInTheDocument();
  });
});

// ── 4. "Restore original" button dismisses itself ────────────────────────────

describe('"Restore original" button self-dismissal', () => {
  it('tapping "Restore original" hides the banner and restores the original meal', async () => {
    await renderAndGetFirstResult();
    await refineCurrentMeal(REFINED_RESULT);

    // Banner and refined meal name are visible
    await waitFor(() =>
      expect(screen.getByText('Restore original')).toBeInTheDocument(),
    );
    expect(screen.getByText('Herb-Crusted Grilled Chicken')).toBeInTheDocument();

    // Tap "Restore original"
    await act(async () => {
      fireEvent.click(screen.getByText('Restore original'));
    });

    // Banner must be gone immediately
    expect(screen.queryByText('Restore original')).not.toBeInTheDocument();
    expect(screen.queryByText('Showing refined version')).not.toBeInTheDocument();

    // The original meal name must be back
    await waitFor(() =>
      expect(screen.getByText('Grilled Chicken')).toBeInTheDocument(),
    );
    expect(screen.queryByText('Herb-Crusted Grilled Chicken')).not.toBeInTheDocument();
  });

  it('restoring mid-refinement-chain (double refinement) clears banner and shows first original', async () => {
    const SECOND_REFINED_RESULT = {
      ...FIRST_RESULT,
      meal: {
        ...FIRST_RESULT.meal,
        name: 'Double-Refined Chicken',
        description: 'Refined twice',
      },
    };

    await renderAndGetFirstResult();

    // First refinement: original → REFINED_RESULT
    await refineCurrentMeal(REFINED_RESULT);
    await waitFor(() =>
      expect(screen.getByText('Restore original')).toBeInTheDocument(),
    );
    expect(screen.getByText('Herb-Crusted Grilled Chicken')).toBeInTheDocument();

    // Second refinement: REFINED_RESULT → SECOND_REFINED_RESULT
    // The component guards setPreRefinedResult so the FIRST original is preserved.
    await refineCurrentMeal(SECOND_REFINED_RESULT);
    await waitFor(() =>
      expect(screen.getByText('Double-Refined Chicken')).toBeInTheDocument(),
    );

    // Banner still visible after second refinement
    expect(screen.getByText('Restore original')).toBeInTheDocument();

    // Tap restore — should jump back to the first original, not the intermediate
    await act(async () => {
      fireEvent.click(screen.getByText('Restore original'));
    });

    // Banner gone
    expect(screen.queryByText('Restore original')).not.toBeInTheDocument();
    expect(screen.queryByText('Showing refined version')).not.toBeInTheDocument();

    // The very first result is back (not the intermediate REFINED_RESULT)
    await waitFor(() =>
      expect(screen.getByText('Grilled Chicken')).toBeInTheDocument(),
    );
    expect(screen.queryByText('Herb-Crusted Grilled Chicken')).not.toBeInTheDocument();
    expect(screen.queryByText('Double-Refined Chicken')).not.toBeInTheDocument();
  });
});

// ── 5. Session persistence — cleared preRefinedResult is not rehydrated ───────

describe('Session persistence — preRefinedResult not rehydrated after sendMessage', () => {
  it('a page reload after sendMessage does not restore the Restore Original banner', async () => {
    const SESSION_KEY = 'grocery-coach-session:test-user-banner';

    // Simulate a saved session where preRefinedResult was cleared (undefined)
    // — the state that exists after sendMessage runs.
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        result: SECOND_RESULT,
        // preRefinedResult deliberately absent (matches post-sendMessage state)
        conversation: [{ role: 'user', content: 'Something lighter please' }],
        savedAt: Date.now(),
      }),
    );

    render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);

    // The result should be restored from localStorage
    await waitFor(() =>
      expect(screen.getByText('Salmon Bowl')).toBeInTheDocument(),
    );

    // The banner must NOT appear because preRefinedResult was not persisted
    expect(screen.queryByText('Restore original')).not.toBeInTheDocument();
    expect(screen.queryByText('Showing refined version')).not.toBeInTheDocument();
  });

  it('a page reload while a refinement is active DOES restore the banner', async () => {
    const SESSION_KEY = 'grocery-coach-session:test-user-banner';

    // Simulate a saved session where the user refined the meal but did NOT
    // send a new message — preRefinedResult is present.
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        result: REFINED_RESULT,
        preRefinedResult: FIRST_RESULT,
        conversation: [],
        savedAt: Date.now(),
      }),
    );

    render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByText('Herb-Crusted Grilled Chicken')).toBeInTheDocument(),
    );

    // The banner should appear because preRefinedResult was persisted
    await waitFor(() =>
      expect(screen.getByText('Restore original')).toBeInTheDocument(),
    );
  });
});
