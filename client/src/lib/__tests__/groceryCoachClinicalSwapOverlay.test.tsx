/**
 * @jest-environment jsdom
 *
 * GroceryStoreCoachSheet — clinical swap overlay component test
 *
 * Verifies that when the server returns a clinical swap result
 * (alternatives: [], coachSuggestion only) for a GLP-1 or diabetic user:
 *
 *  1. The swap overlay opens and shows the coach suggestion card.
 *  2. The "Other Options" section is absent (no alternatives to render).
 *  3. "Use This" is disabled before the user selects anything.
 *  4. Clicking the coach suggestion card enables "Use This".
 *  5. Clicking "Use This" commits the swap and closes the overlay.
 *  6. The shopping list reflects the new item.
 *
 * Run: npx jest client/src/lib/__tests__/groceryCoachClinicalSwapOverlay.test.tsx
 */

// ── Module mocks — must appear before imports ─────────────────────────────────

// Render portals inline so the swap overlay appears in the test document.
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
  useAuth: jest.fn(() => ({ user: { id: 'clinical-test-user' } })),
}));
jest.mock('@/components/ui/pill-button', () => ({ PillButton: () => null }));

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { post, get } from '@/lib/api';
import GroceryStoreCoachSheet from '@/components/shopping/GroceryStoreCoachSheet';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Meal result with one shopping list item the user can try to swap. */
const CLINICAL_MEAL_RESULT = {
  meal: {
    name: 'GLP-1 Compliant Bowl',
    description: 'Low-fat, high-protein meal for GLP-1 users.',
    prepTime: '20 minutes',
    servings: 1,
  },
  reasoning: ['Low fat', 'High protein', 'GLP-1 compliant'],
  macros: { calories: 350, protein: 38, carbs: 18, fat: 8 },
  ownedIngredients: [],
  shoppingList: [
    { item: 'Chicken breast', quantity: '6', unit: 'oz', category: 'Meat' },
    { item: 'Broccoli', quantity: '1', unit: 'cup', category: 'Produce' },
  ],
  followUpSuggestions: ['More protein', 'Lower carbs'],
  servingCount: 1,
};

/**
 * Clinical swap result — what the server returns for GLP-1 / diabetic users.
 * alternatives is [] because fat/carb compliance cannot be verified on
 * LLM-generated items without nutritionJson.
 */
const CLINICAL_SWAP_RESULT = {
  coachSuggestion: {
    item: 'Turkey breast',
    quantity: '6',
    unit: 'oz',
    reason: 'Lean protein, very low fat — safe for your GLP-1 protocol.',
  },
  alternatives: [],
  savedOption: null,
  protocolNote:
    'Alternatives hidden: clinical fat/carb compliance cannot be verified without nutrition data.',
};

// ── Setup helpers ─────────────────────────────────────────────────────────────

function setupMocks(swapResult = CLINICAL_SWAP_RESULT) {
  (post as jest.Mock).mockImplementation(async (url: string) => {
    if (url === '/api/grocery-coach/recommend') return CLINICAL_MEAL_RESULT;
    if (url === '/api/grocery-coach/swap-ingredient') return swapResult;
    if (url === '/api/grocery-coach/finalize-card') return { status: 'failed' };
    if (url === '/api/grocery-coach/product-advisor') return { advice: [] };
    return {};
  });
  (get as jest.Mock).mockResolvedValue({ items: [] });
}

/** Renders the sheet and waits for the first meal result to load. */
async function renderAndGetMeal() {
  render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);

  // Use the first Quick Start chip to trigger sendMessage
  const chip = screen.getByText("What's for dinner tonight?");
  await act(async () => {
    fireEvent.click(chip);
  });

  await waitFor(
    () => expect(screen.getByText('GLP-1 Compliant Bowl')).toBeInTheDocument(),
    { timeout: 4000 },
  );
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  setupMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Swap overlay opens with a clinical response (alternatives: [])
// ─────────────────────────────────────────────────────────────────────────────

describe('clinical swap overlay — opens with alternatives: []', () => {
  test('swap overlay appears after clicking Replace on a shopping list item', async () => {
    await renderAndGetMeal();

    // Find and click the Replace button for "Chicken breast"
    const replaceBtn = screen.getByTitle('Replace Chicken breast');
    await act(async () => {
      fireEvent.click(replaceBtn);
    });

    // Overlay header must appear
    await waitFor(
      () => expect(screen.getByText('Replace Chicken breast')).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });

  test('coach suggestion card is visible when alternatives is []', async () => {
    await renderAndGetMeal();

    const replaceBtn = screen.getByTitle('Replace Chicken breast');
    await act(async () => {
      fireEvent.click(replaceBtn);
    });

    // Wait for the overlay to load
    await waitFor(
      () => expect(screen.getByText("Coach's Best Pick")).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // The coach suggestion item must be visible
    expect(screen.getByText('Turkey breast')).toBeInTheDocument();
    expect(
      screen.getByText('Lean protein, very low fat — safe for your GLP-1 protocol.'),
    ).toBeInTheDocument();
  });

  test('"Other Options" section is absent when alternatives is []', async () => {
    await renderAndGetMeal();

    const replaceBtn = screen.getByTitle('Replace Chicken breast');
    await act(async () => {
      fireEvent.click(replaceBtn);
    });

    await waitFor(
      () => expect(screen.getByText("Coach's Best Pick")).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // "Other Options" section must not render when alternatives is empty
    expect(screen.queryByText('Other Options')).not.toBeInTheDocument();
  });

  test('protocol note is visible explaining why alternatives are hidden', async () => {
    await renderAndGetMeal();

    const replaceBtn = screen.getByTitle('Replace Chicken breast');
    await act(async () => {
      fireEvent.click(replaceBtn);
    });

    await waitFor(
      () => expect(screen.getByText("Coach's Best Pick")).toBeInTheDocument(),
      { timeout: 3000 },
    );

    expect(
      screen.getByText(/Alternatives hidden: clinical fat\/carb compliance/i),
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. "Use This" button state — auto-enabled for clinical single-option overlay
// ─────────────────────────────────────────────────────────────────────────────
//
// When alternatives is [] the component auto-selects coachSuggestion so the
// user can immediately tap "Use This" without an extra click.  This is
// intentional UX for clinical users who have only one option.

describe('"Use This" button state with empty alternatives', () => {
  test('"Use This" is enabled immediately when the overlay loads (coachSuggestion auto-selected)', async () => {
    await renderAndGetMeal();

    const replaceBtn = screen.getByTitle('Replace Chicken breast');
    await act(async () => {
      fireEvent.click(replaceBtn);
    });

    // Wait for the swap result to load
    await waitFor(
      () => expect(screen.getByText("Coach's Best Pick")).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // coachSuggestion is auto-selected → "Use This" must already be enabled
    const useThisBtn = screen.getByText('Use This');
    expect(useThisBtn).not.toBeDisabled();
  });

  test('"Use This" renders with active styling when alternatives is [] (coachSuggestion auto-selected)', async () => {
    await renderAndGetMeal();

    const replaceBtn = screen.getByTitle('Replace Chicken breast');
    await act(async () => {
      fireEvent.click(replaceBtn);
    });

    await waitFor(
      () => expect(screen.getByText("Coach's Best Pick")).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // The button text is visible and the button is not disabled — user can
    // tap it immediately without first selecting from an alternatives list
    expect(screen.getByText('Use This')).toBeInTheDocument();
    expect(screen.getByText('Use This')).not.toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. "Use This" commits the swap and updates the shopping list
// ─────────────────────────────────────────────────────────────────────────────

describe('"Use This" commits swap when alternatives is []', () => {
  test('clicking "Use This" after selecting coachSuggestion updates the shopping list', async () => {
    await renderAndGetMeal();

    // Verify original item is present
    expect(screen.getByText('Chicken breast')).toBeInTheDocument();

    // Open swap overlay
    const replaceBtn = screen.getByTitle('Replace Chicken breast');
    await act(async () => {
      fireEvent.click(replaceBtn);
    });

    await waitFor(
      () => expect(screen.getByText("Coach's Best Pick")).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // Select the only available option (coachSuggestion)
    await act(async () => {
      fireEvent.click(screen.getByText('Turkey breast'));
    });

    // Click "Use This"
    await act(async () => {
      fireEvent.click(screen.getByText('Use This'));
    });

    // Swap overlay must close
    await waitFor(() =>
      expect(screen.queryByText("Coach's Best Pick")).not.toBeInTheDocument(),
    );

    // The shopping list must now show Turkey breast instead of Chicken breast
    await waitFor(() =>
      expect(screen.getByText('Turkey breast')).toBeInTheDocument(),
    );
    expect(screen.queryByText('Chicken breast')).not.toBeInTheDocument();
  });

  test('other shopping list items are unaffected after committing the swap', async () => {
    await renderAndGetMeal();

    // Confirm broccoli is present before the swap
    expect(screen.getByText('Broccoli')).toBeInTheDocument();

    const replaceBtn = screen.getByTitle('Replace Chicken breast');
    await act(async () => {
      fireEvent.click(replaceBtn);
    });

    await waitFor(
      () => expect(screen.getByText("Coach's Best Pick")).toBeInTheDocument(),
      { timeout: 3000 },
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Turkey breast'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Use This'));
    });

    await waitFor(() =>
      expect(screen.queryByText("Coach's Best Pick")).not.toBeInTheDocument(),
    );

    // Broccoli must still be in the list — unaffected by the swap
    expect(screen.getByText('Broccoli')).toBeInTheDocument();
  });

  test('swap overlay closes after "Use This" is clicked', async () => {
    await renderAndGetMeal();

    const replaceBtn = screen.getByTitle('Replace Chicken breast');
    await act(async () => {
      fireEvent.click(replaceBtn);
    });

    await waitFor(
      () => expect(screen.getByText("Coach's Best Pick")).toBeInTheDocument(),
      { timeout: 3000 },
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Turkey breast'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Use This'));
    });

    // Overlay must be closed — header and footer gone
    await waitFor(() => {
      expect(screen.queryByText("Coach's Best Pick")).not.toBeInTheDocument();
      expect(screen.queryByText('Use This')).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Cancel button works with empty alternatives
// ─────────────────────────────────────────────────────────────────────────────

describe('Cancel button with empty alternatives', () => {
  test('clicking Cancel closes the overlay without changing the shopping list', async () => {
    await renderAndGetMeal();

    const replaceBtn = screen.getByTitle('Replace Chicken breast');
    await act(async () => {
      fireEvent.click(replaceBtn);
    });

    await waitFor(
      () => expect(screen.getByText("Coach's Best Pick")).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // Click Cancel — do NOT select or confirm
    await act(async () => {
      fireEvent.click(screen.getByText('Cancel'));
    });

    // Overlay must close
    expect(screen.queryByText("Coach's Best Pick")).not.toBeInTheDocument();
    expect(screen.queryByText('Use This')).not.toBeInTheDocument();

    // Original item must still be in the list (no swap applied)
    expect(screen.getByText('Chicken breast')).toBeInTheDocument();
    expect(screen.queryByText('Turkey breast')).not.toBeInTheDocument();
  });
});
