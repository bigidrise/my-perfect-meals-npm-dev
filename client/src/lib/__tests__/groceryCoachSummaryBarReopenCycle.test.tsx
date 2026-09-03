/**
 * @jest-environment jsdom
 *
 * GroceryStoreCoachSheet — summary bar visibility across close/reopen cycles
 *
 * Component-level integration tests that render GroceryStoreCoachSheet, interact
 * with the brand-pick UI, toggle the `open` prop, and assert whether
 * `data-testid="picked-brands-summary"` appears with the correct count.
 *
 * Core behaviours under test
 * ──────────────────────────
 * 1. Bar is HIDDEN when no picks were made and the sheet opens.
 * 2. Bar shows COUNT after picks are made during the current session.
 * 3. Bar still shows the SAME COUNT after close → reopen
 *    (the !open effect must NOT clear pickedBrands).
 * 4. Bar is HIDDEN after all picks are cleared before closing.
 * 5. Bar is restored from localStorage on first mount when a previous session
 *    already had pickedBrandsEntries.
 *
 * These tests would FAIL if the `!open` useEffect in GroceryStoreCoachSheet.tsx
 * were changed to call `setPickedBrands(new Map())` (the regression guard).
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
 * Translation mock — returns realistic strings for keys used by the summary bar
 * and the Pick/Picked pill buttons so tests can locate controls by visible text.
 */
const mockT = (key: string, opts?: Record<string, unknown>): string => {
  if (key === 'smartCart.brandsSummary') {
    const count = opts?.count as number;
    return count === 1 ? '1 brand selected' : `${count} brands selected`;
  }
  if (key === 'smartCart.pick') return 'Pick';
  if (key === 'smartCart.picked') return '✓ Picked';
  // Return the key itself for any other translation call
  return key;
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
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
jest.mock('@/components/ui/pill-button', () => ({
  PillButton: ({ children, onClick, disabled }: any) => {
    const R = require('react');
    return R.createElement('button', { onClick, disabled }, children);
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { post, get } from '@/lib/api';
import { useShoppingListStore } from '@/stores/shoppingListStore';
import GroceryStoreCoachSheet from '@/components/shopping/GroceryStoreCoachSheet';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Session key used by the component for user 'u1'. */
const SESSION_KEY = 'grocery-coach-session:u1';

// ── Session fixtures ──────────────────────────────────────────────────────────

/**
 * A minimal coach result with two ingredients:
 *   shoppingList     → chicken breast
 *   ownedIngredients → olive oil
 *
 * productAdvice covers both so isAdviceStale() returns false and the sheet
 * renders the Smart Cart without a background re-fetch.
 */
const BASE_RESULT = {
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
};

const BASE_PRODUCT_ADVICE = {
  advice: [
    {
      ingredient: 'chicken breast',
      category: 'Meat',
      recommended: [{ brand: 'Tyson Air Chilled', rank: 1, grade: 'A', reason: 'Clean' }],
      avoid: [],
    },
    {
      ingredient: 'olive oil',
      category: 'Pantry',
      recommended: [{ brand: 'California Olive Ranch EVOO', rank: 1, grade: 'A', reason: 'Best' }],
      avoid: [],
    },
  ],
  profileUsed: [],
};

/** Session that restores a result + product advice but no prior picks. */
function makeSession(extra: object = {}): string {
  return JSON.stringify({
    result: BASE_RESULT,
    productAdvice: BASE_PRODUCT_ADVICE,
    conversation: [],
    savedAt: Date.now(),
    ...extra,
  });
}

/** Session that also includes pre-existing picks for both ingredients. */
function makeSessionWithPicks(): string {
  return makeSession({
    pickedBrandsEntries: [
      ['chicken breast', { brand: 'Tyson Air Chilled', rank: 1, grade: 'A', reason: 'Clean' }],
      ['olive oil', { brand: 'California Olive Ranch EVOO', rank: 1, grade: 'A', reason: 'Best' }],
    ],
  });
}

// ── Shared setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  (useShoppingListStore as jest.Mock).mockReturnValue(jest.fn());
  (get as jest.Mock).mockResolvedValue({ items: [] });
  (post as jest.Mock).mockResolvedValue({});
});

afterEach(() => {
  localStorage.clear();
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 1 — Bar is hidden when the sheet opens with no prior picks
// ─────────────────────────────────────────────────────────────────────────────

describe('Summary bar — initial state with no picks', () => {
  it('does not render the summary bar when the sheet opens with no picks in session', async () => {
    // Seed a session that has a result but no pickedBrandsEntries
    localStorage.setItem(SESSION_KEY, makeSession());

    render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);

    // Wait for the result to load and Smart Cart to mount
    await waitFor(() => expect(screen.getByText('Herb Chicken')).toBeInTheDocument());

    // Bar must not be present because pickedBrands.size === 0
    expect(screen.queryByTestId('picked-brands-summary')).not.toBeInTheDocument();
  });

  it('does not render the summary bar when the sheet opens with no session at all', async () => {
    render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);

    // Nothing loads — the sheet stays in idle phase. Bar must not be present.
    expect(screen.queryByTestId('picked-brands-summary')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 2 — Bar visible with correct count after picks are made
// ─────────────────────────────────────────────────────────────────────────────

describe('Summary bar — bar reflects current pick count', () => {
  it('shows "1 brands selected" after picking one brand', async () => {
    localStorage.setItem(SESSION_KEY, makeSession());

    render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Herb Chicken')).toBeInTheDocument());

    // Pick buttons appear in the Smart Cart; pick the first one (chicken breast)
    const pickButtons = await waitFor(() => {
      const btns = screen.getAllByText('Pick');
      expect(btns.length).toBeGreaterThanOrEqual(1);
      return btns;
    });

    fireEvent.click(pickButtons[0]);

    await waitFor(() =>
      expect(screen.getByTestId('picked-brands-summary')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('picked-brands-summary').textContent).toContain('1 brand selected');
  });

  it('shows "2 brands selected" after picking both brands', async () => {
    localStorage.setItem(SESSION_KEY, makeSession());

    render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Herb Chicken')).toBeInTheDocument());

    const pickButtons = await waitFor(() => {
      const btns = screen.getAllByText('Pick');
      expect(btns).toHaveLength(2);
      return btns;
    });

    fireEvent.click(pickButtons[0]); // chicken breast
    fireEvent.click(pickButtons[1]); // olive oil

    await waitFor(() =>
      expect(screen.getByTestId('picked-brands-summary').textContent).toContain('2 brands selected'),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 3 — Close/reopen cycle: picks survive, bar stays visible
//
// This is the regression-guard test for the task. It would FAIL if the !open
// effect were changed to call setPickedBrands(new Map()).
// ─────────────────────────────────────────────────────────────────────────────

describe('Summary bar — close/reopen cycle preserves picks', () => {
  it('bar still shows count=2 after closing and reopening the sheet', async () => {
    localStorage.setItem(SESSION_KEY, makeSession());

    const onOpenChange = jest.fn();
    const { rerender } = render(
      <GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />,
    );

    await waitFor(() => expect(screen.getByText('Herb Chicken')).toBeInTheDocument());

    // Pick both brands
    const pickButtons = await waitFor(() => {
      const btns = screen.getAllByText('Pick');
      expect(btns).toHaveLength(2);
      return btns;
    });
    fireEvent.click(pickButtons[0]);
    fireEvent.click(pickButtons[1]);

    await waitFor(() =>
      expect(screen.getByTestId('picked-brands-summary').textContent).toContain('2 brands selected'),
    );

    // Close the sheet (open → false)
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={false} onOpenChange={onOpenChange} />);
    });

    // Reopen the sheet (false → true)
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />);
    });

    // Picks must still be present — bar shows the same count
    await waitFor(() =>
      expect(screen.getByTestId('picked-brands-summary')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('picked-brands-summary').textContent).toContain('2 brands selected');
  });

  it('bar shows count=1 after picking 2, unpicking 1, then closing and reopening', async () => {
    localStorage.setItem(SESSION_KEY, makeSession());

    const onOpenChange = jest.fn();
    const { rerender } = render(
      <GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />,
    );

    await waitFor(() => expect(screen.getByText('Herb Chicken')).toBeInTheDocument());

    const pickButtons = await waitFor(() => {
      const btns = screen.getAllByText('Pick');
      expect(btns).toHaveLength(2);
      return btns;
    });

    // Pick both
    fireEvent.click(pickButtons[0]);
    fireEvent.click(pickButtons[1]);
    await waitFor(() =>
      expect(screen.getByTestId('picked-brands-summary').textContent).toContain('2 brands selected'),
    );

    // Un-pick the first (toggle off by clicking the "✓ Picked" button)
    const pickedButtons = screen.getAllByText('✓ Picked');
    fireEvent.click(pickedButtons[0]);
    await waitFor(() =>
      expect(screen.getByTestId('picked-brands-summary').textContent).toContain('1 brand selected'),
    );

    // Close → reopen
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={false} onOpenChange={onOpenChange} />);
    });
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />);
    });

    await waitFor(() =>
      expect(screen.getByTestId('picked-brands-summary').textContent).toContain('1 brand selected'),
    );
  });

  it('bar is hidden after all picks are cleared before closing, even after reopen', async () => {
    localStorage.setItem(SESSION_KEY, makeSession());

    const onOpenChange = jest.fn();
    const { rerender } = render(
      <GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />,
    );

    await waitFor(() => expect(screen.getByText('Herb Chicken')).toBeInTheDocument());

    const pickButtons = await waitFor(() => {
      const btns = screen.getAllByText('Pick');
      expect(btns).toHaveLength(2);
      return btns;
    });

    // Pick both then un-pick both
    fireEvent.click(pickButtons[0]);
    fireEvent.click(pickButtons[1]);
    await waitFor(() =>
      expect(screen.getByTestId('picked-brands-summary')).toBeInTheDocument(),
    );

    const pickedButtons = screen.getAllByText('✓ Picked');
    fireEvent.click(pickedButtons[0]);
    fireEvent.click(pickedButtons[1]);

    await waitFor(() =>
      expect(screen.queryByTestId('picked-brands-summary')).not.toBeInTheDocument(),
    );

    // Close → reopen: bar must remain hidden
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={false} onOpenChange={onOpenChange} />);
    });
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />);
    });

    expect(screen.queryByTestId('picked-brands-summary')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 4 — Bar restored from localStorage when session has pre-existing picks
//
// Simulates re-opening the app after a previous session where picks were made:
// the session is read from localStorage on mount (when SESSION_KEY changes)
// and pickedBrandsEntries are restored into state.
// ─────────────────────────────────────────────────────────────────────────────

describe('Summary bar — picks restored from a previous session on mount', () => {
  it('bar shows count=2 on first mount when session already has 2 pickedBrandsEntries', async () => {
    // Seed a session that was saved with picks already present
    localStorage.setItem(SESSION_KEY, makeSessionWithPicks());

    render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByTestId('picked-brands-summary')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('picked-brands-summary').textContent).toContain('2 brands selected');
  });

  it('bar is hidden on mount when session has a result but zero pickedBrandsEntries', async () => {
    localStorage.setItem(SESSION_KEY, makeSession()); // no pickedBrandsEntries

    render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Herb Chicken')).toBeInTheDocument());

    expect(screen.queryByTestId('picked-brands-summary')).not.toBeInTheDocument();
  });

  it('bar still shows restored count=2 after a subsequent close/reopen cycle', async () => {
    localStorage.setItem(SESSION_KEY, makeSessionWithPicks());

    const onOpenChange = jest.fn();
    const { rerender } = render(
      <GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('picked-brands-summary').textContent).toContain('2 brands selected'),
    );

    // Close and reopen
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={false} onOpenChange={onOpenChange} />);
    });
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />);
    });

    await waitFor(() =>
      expect(screen.getByTestId('picked-brands-summary').textContent).toContain('2 brands selected'),
    );
  });
});
