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
  useAuth: jest.fn(() => ({ user: { id: 'test-user-banner' } })),
}));
jest.mock('@/components/ui/pill-button', () => ({ PillButton: () => null }));

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { post, get } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
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
  // Reset useAuth to the default user before each test
  (useAuth as jest.Mock).mockImplementation(() => ({ user: { id: 'test-user-banner' } }));
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

// ── 5. Session persistence after Restore Original ────────────────────────────

describe('Session persistence after "Restore original"', () => {
  it('a page reload after restoring shows the original meal and no banner', async () => {
    const SESSION_KEY = 'grocery-coach-session:test-user-banner';

    // Step 1 – render, get the first result, then refine it.
    const { unmount } = render(
      <GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />,
    );

    const chip = screen.getByText("What's for dinner tonight?");
    await act(async () => { fireEvent.click(chip); });
    await waitFor(
      () => expect(screen.getByText('Grilled Chicken')).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // Refine the meal
    const refineBtn = screen.getByText('Refine Meal');
    await act(async () => { fireEvent.click(refineBtn); });
    expect(capturedOnRefined).not.toBeNull();
    await act(async () => { capturedOnRefined!(REFINED_RESULT); });

    // Confirm the refined meal and banner are showing
    await waitFor(() =>
      expect(screen.getByText('Restore original')).toBeInTheDocument(),
    );
    expect(screen.getByText('Herb-Crusted Grilled Chicken')).toBeInTheDocument();

    // Step 2 – tap "Restore original"
    await act(async () => {
      fireEvent.click(screen.getByText('Restore original'));
    });

    // Banner gone, original meal restored in the UI
    expect(screen.queryByText('Restore original')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('Grilled Chicken')).toBeInTheDocument(),
    );

    // Step 3 – wait for the save effect to flush the post-restore state to
    // localStorage (result = FIRST_RESULT, preRefinedResult absent).
    await waitFor(() => {
      const raw = localStorage.getItem(SESSION_KEY);
      expect(raw).not.toBeNull();
      const session = JSON.parse(raw!);
      // The persisted result must be the original, not the refined version
      expect(session.result?.meal?.name).toBe('Grilled Chicken');
      // preRefinedResult must be absent so reload can't restore the banner
      expect(session.preRefinedResult).toBeUndefined();
    });

    // Step 4 – simulate a page reload by unmounting and re-rendering while
    // localStorage still holds the post-restore session.
    unmount();

    render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);

    // The original meal should appear from localStorage
    await waitFor(() =>
      expect(screen.getByText('Grilled Chicken')).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // The "Restore original" banner must NOT appear — it was not persisted
    expect(screen.queryByText('Restore original')).not.toBeInTheDocument();
    expect(screen.queryByText('Showing refined version')).not.toBeInTheDocument();

    // The refined meal name must not be visible
    expect(screen.queryByText('Herb-Crusted Grilled Chicken')).not.toBeInTheDocument();
  });
});

// ── 6. Session persistence — cleared preRefinedResult is not rehydrated ───────


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

// ── 6. Session reset — banner hidden when sheet reopens for a new user ─────────

describe('Session reset — banner absent after full session reset (new user ID)', () => {
  it('banner does not appear when the sheet reopens for a different user after a refinement', async () => {
    const USER_A = 'test-user-session-a';
    const USER_B = 'test-user-session-b';

    // ── Step 1: mount as User A, generate a result, refine it ──────────────
    (useAuth as jest.Mock).mockImplementation(() => ({ user: { id: USER_A } }));

    const { unmount } = render(
      <GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />,
    );

    // Trigger first result via Quick Start chip
    const chip = screen.getByText("What's for dinner tonight?");
    await act(async () => {
      fireEvent.click(chip);
    });

    await waitFor(
      () => expect(screen.getByText('Grilled Chicken')).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // Refine the meal so preRefinedResult is set and the banner appears
    const refineBtn = screen.getByText('Refine Meal');
    await act(async () => {
      fireEvent.click(refineBtn);
    });
    expect(capturedOnRefined).not.toBeNull();
    await act(async () => {
      capturedOnRefined!(REFINED_RESULT);
    });

    await waitFor(() =>
      expect(screen.getByText('Restore original')).toBeInTheDocument(),
    );

    // ── Step 2: simulate a full session reset by switching to User B ────────
    // Unmount the sheet (mimics closing it / logging out)
    unmount();

    // Switch the auth context to User B — this changes SESSION_KEY
    (useAuth as jest.Mock).mockImplementation(() => ({ user: { id: USER_B } }));

    // User B has no saved session in localStorage, so no preRefinedResult
    // Remount the sheet for User B
    render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);

    // ── Step 3: confirm the banner is absent ─────────────────────────────────
    // The sheet should render without a result (fresh session for User B)
    // and the banner must NOT appear under any circumstances.
    expect(screen.queryByText('Restore original')).not.toBeInTheDocument();
    expect(screen.queryByText('Showing refined version')).not.toBeInTheDocument();
  });

  it('banner does not appear for User B even when User A session is still in localStorage', async () => {
    const USER_A = 'test-user-session-a2';
    const USER_B = 'test-user-session-b2';

    // Pre-seed User A's session with a refinement active
    localStorage.setItem(
      `grocery-coach-session:${USER_A}`,
      JSON.stringify({
        result: REFINED_RESULT,
        preRefinedResult: FIRST_RESULT,
        conversation: [],
        savedAt: Date.now(),
      }),
    );

    // Mount directly as User B — their session key points to a different entry
    (useAuth as jest.Mock).mockImplementation(() => ({ user: { id: USER_B } }));

    render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);

    // User B has no session at their key; the banner must stay hidden
    expect(screen.queryByText('Restore original')).not.toBeInTheDocument();
    expect(screen.queryByText('Showing refined version')).not.toBeInTheDocument();
  });
});

// ── 7. Inline logout/login — banner hidden when auth cycles without unmount ────
//
// Covers the case where the sheet stays mounted through a full auth cycle:
// UserA (logged in) → null (logged out) → UserB (new login).
// The SESSION_KEY changes twice in the same component lifetime. A stale
// closure or missing effect dependency could leak UserA's preRefinedResult
// into UserB's view.

describe('Inline logout/login without unmount', () => {
  it('banner is absent after auth cycles null → UserB without unmounting the sheet', async () => {
    const USER_A = 'test-inline-auth-user-a';
    const USER_B = 'test-inline-auth-user-b';

    // ── Step 1: mount as User A and get a result ─────────────────────────────
    (useAuth as jest.Mock).mockImplementation(() => ({ user: { id: USER_A } }));

    const onOpenChange = jest.fn();
    const { rerender } = render(
      <GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />,
    );

    const chip = screen.getByText("What's for dinner tonight?");
    await act(async () => {
      fireEvent.click(chip);
    });

    await waitFor(
      () => expect(screen.getByText('Grilled Chicken')).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // ── Step 2: refine the meal — banner must appear ──────────────────────────
    const refineBtn = screen.getByText('Refine Meal');
    await act(async () => {
      fireEvent.click(refineBtn);
    });
    expect(capturedOnRefined).not.toBeNull();
    await act(async () => {
      capturedOnRefined!(REFINED_RESULT);
    });

    await waitFor(() =>
      expect(screen.getByText('Restore original')).toBeInTheDocument(),
    );

    // ── Step 3: simulate logout — useAuth returns null, SESSION_KEY → "guest" ─
    // Changing the mock alone doesn't re-render; rerender() forces the component
    // to call useAuth() again, which changes SESSION_KEY and fires the effect.
    (useAuth as jest.Mock).mockImplementation(() => ({ user: null }));
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />);
    });

    // The SESSION_KEY effect resets state; banner must clear
    await waitFor(() =>
      expect(screen.queryByText('Restore original')).not.toBeInTheDocument(),
    );

    // ── Step 4: simulate login as User B — SESSION_KEY changes again ──────────
    // User B has no saved session in localStorage, so preRefinedResult should
    // remain absent after the restore effect runs.
    (useAuth as jest.Mock).mockImplementation(() => ({ user: { id: USER_B } }));
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />);
    });

    // After User B's SESSION_KEY settles the restore effect runs (no saved
    // session → result stays null, preRefinedResult stays null).
    // The banner must not appear.
    await waitFor(() =>
      expect(screen.queryByText('Restore original')).not.toBeInTheDocument(),
    );
    expect(screen.queryByText('Showing refined version')).not.toBeInTheDocument();
  });

  it('banner stays hidden for UserB even when UserA left a persisted refinement in localStorage', async () => {
    const USER_A = 'test-inline-auth-user-a3';
    const USER_B = 'test-inline-auth-user-b3';

    // Pre-seed User A's localStorage with an active refinement
    localStorage.setItem(
      `grocery-coach-session:${USER_A}`,
      JSON.stringify({
        result: REFINED_RESULT,
        preRefinedResult: FIRST_RESULT,
        conversation: [],
        savedAt: Date.now(),
      }),
    );

    // ── Mount as User A so the persisted refinement is restored ──────────────
    (useAuth as jest.Mock).mockImplementation(() => ({ user: { id: USER_A } }));

    const onOpenChange = jest.fn();
    const { rerender } = render(
      <GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />,
    );

    // The restored session includes preRefinedResult, so banner should show
    await waitFor(() =>
      expect(screen.getByText('Restore original')).toBeInTheDocument(),
    );

    // ── Logout (null) — rerender so the component picks up null user ──────────
    (useAuth as jest.Mock).mockImplementation(() => ({ user: null }));
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />);
    });

    // ── Login as User B — rerender again so SESSION_KEY flips to User B ───────
    (useAuth as jest.Mock).mockImplementation(() => ({ user: { id: USER_B } }));
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />);
    });

    // User B has no session; banner must be absent
    await waitFor(() =>
      expect(screen.queryByText('Restore original')).not.toBeInTheDocument(),
    );
    expect(screen.queryByText('Showing refined version')).not.toBeInTheDocument();
  });
});

// ── 8. open=false cycle mid-logout — banner absent when sheet reopens ─────────
//
// Edge case: the sheet closes (open=false) while User A's refinement is active,
// then auth changes to User B while the drawer is still hidden, and then the
// sheet reopens (open=true). Because the component never fully unmounts, the
// SESSION_KEY effect fires while open=false. The banner must stay absent when
// the sheet becomes visible again for User B.

describe('open=false cycle mid-logout — banner absent on reopen for new user', () => {
  it('banner is absent when the sheet reopens after closing mid-refinement and switching users', async () => {
    const USER_A = 'test-open-cycle-user-a';
    const USER_B = 'test-open-cycle-user-b';

    // ── Step 1: mount as User A with sheet open, generate a result ────────────
    (useAuth as jest.Mock).mockImplementation(() => ({ user: { id: USER_A } }));

    const onOpenChange = jest.fn();
    const { rerender } = render(
      <GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />,
    );

    const chip = screen.getByText("What's for dinner tonight?");
    await act(async () => {
      fireEvent.click(chip);
    });

    await waitFor(
      () => expect(screen.getByText('Grilled Chicken')).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // ── Step 2: refine the meal — banner must appear ──────────────────────────
    const refineBtn = screen.getByText('Refine Meal');
    await act(async () => {
      fireEvent.click(refineBtn);
    });
    expect(capturedOnRefined).not.toBeNull();
    await act(async () => {
      capturedOnRefined!(REFINED_RESULT);
    });

    await waitFor(() =>
      expect(screen.getByText('Restore original')).toBeInTheDocument(),
    );

    // ── Step 3: close the sheet (open=false) — component stays mounted ────────
    // The open=false effect resets transient UI state but leaves
    // result / preRefinedResult in memory (so the user returns to their meal
    // when they reopen it for the same session).
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={false} onOpenChange={onOpenChange} />);
    });

    // ── Step 4: switch auth to User B while the sheet is still closed ─────────
    // SESSION_KEY changes → the restore effect fires → preRefinedResult is
    // cleared even though open=false, because the effect is keyed on
    // SESSION_KEY, not on `open`.
    (useAuth as jest.Mock).mockImplementation(() => ({ user: { id: USER_B } }));
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={false} onOpenChange={onOpenChange} />);
    });

    // ── Step 5: reopen the sheet as User B ───────────────────────────────────
    // The SESSION_KEY effect has already run (clearing preRefinedResult), so
    // the banner must not reappear when the sheet becomes visible again.
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />);
    });

    // Banner must be absent — User B's session has no preRefinedResult
    await waitFor(() =>
      expect(screen.queryByText('Restore original')).not.toBeInTheDocument(),
    );
    expect(screen.queryByText('Showing refined version')).not.toBeInTheDocument();
  });

  it('banner absent on reopen even when User B has a non-refined session in localStorage', async () => {
    const USER_A = 'test-open-cycle-user-a2';
    const USER_B = 'test-open-cycle-user-b2';

    // Pre-seed User B with a clean session (no preRefinedResult)
    localStorage.setItem(
      `grocery-coach-session:${USER_B}`,
      JSON.stringify({
        result: SECOND_RESULT,
        // preRefinedResult absent
        conversation: [{ role: 'user', content: 'Salmon please' }],
        savedAt: Date.now(),
      }),
    );

    // ── Mount as User A, generate result, refine ──────────────────────────────
    (useAuth as jest.Mock).mockImplementation(() => ({ user: { id: USER_A } }));

    const onOpenChange = jest.fn();
    const { rerender } = render(
      <GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />,
    );

    const chip = screen.getByText("What's for dinner tonight?");
    await act(async () => {
      fireEvent.click(chip);
    });

    await waitFor(
      () => expect(screen.getByText('Grilled Chicken')).toBeInTheDocument(),
      { timeout: 3000 },
    );

    const refineBtn = screen.getByText('Refine Meal');
    await act(async () => {
      fireEvent.click(refineBtn);
    });
    expect(capturedOnRefined).not.toBeNull();
    await act(async () => {
      capturedOnRefined!(REFINED_RESULT);
    });

    await waitFor(() =>
      expect(screen.getByText('Restore original')).toBeInTheDocument(),
    );

    // ── Close the sheet ───────────────────────────────────────────────────────
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={false} onOpenChange={onOpenChange} />);
    });

    // ── Switch to User B while closed ────────────────────────────────────────
    (useAuth as jest.Mock).mockImplementation(() => ({ user: { id: USER_B } }));
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={false} onOpenChange={onOpenChange} />);
    });

    // ── Reopen for User B ─────────────────────────────────────────────────────
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />);
    });

    // User B's session has a result (Salmon Bowl) but no preRefinedResult
    await waitFor(
      () => expect(screen.getByText('Salmon Bowl')).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // Banner must not appear — User B's persisted session had no refinement
    expect(screen.queryByText('Restore original')).not.toBeInTheDocument();
    expect(screen.queryByText('Showing refined version')).not.toBeInTheDocument();
  });
});

// ── 9. Same-user open → close → reopen — banner survives ────────────────────
//
// When the same user closes and reopens the sheet without any auth change the
// open=false effect must NOT clear preRefinedResult. The banner should still
// be visible after reopening and the user should be able to dismiss it
// normally via "Restore original".

describe('Same-user open/close/open cycle — banner survives', () => {
  it('banner remains visible after the same user closes and reopens the sheet mid-refinement', async () => {
    const onOpenChange = jest.fn();
    const { rerender } = render(
      <GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />,
    );

    // ── Step 1: generate a result ────────────────────────────────────────────
    const chip = screen.getByText("What's for dinner tonight?");
    await act(async () => {
      fireEvent.click(chip);
    });

    await waitFor(
      () => expect(screen.getByText('Grilled Chicken')).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // ── Step 2: refine the meal — banner must appear ─────────────────────────
    const refineBtn = screen.getByText('Refine Meal');
    await act(async () => {
      fireEvent.click(refineBtn);
    });
    expect(capturedOnRefined).not.toBeNull();
    await act(async () => {
      capturedOnRefined!(REFINED_RESULT);
    });

    await waitFor(() =>
      expect(screen.getByText('Restore original')).toBeInTheDocument(),
    );
    expect(screen.getByText('Showing refined version')).toBeInTheDocument();
    expect(screen.getByText('Herb-Crusted Grilled Chicken')).toBeInTheDocument();

    // ── Step 3: close the sheet (open=false) — same user, no auth change ────
    // The open=false effect resets transient UI (input, card phase, etc.) but
    // must leave preRefinedResult intact so the banner survives the reopen.
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={false} onOpenChange={onOpenChange} />);
    });

    // ── Step 4: reopen the sheet as the same user ────────────────────────────
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />);
    });

    // The banner must still be visible — close did not clear preRefinedResult
    await waitFor(() =>
      expect(screen.getByText('Restore original')).toBeInTheDocument(),
    );
    expect(screen.getByText('Showing refined version')).toBeInTheDocument();
    expect(screen.getByText('Herb-Crusted Grilled Chicken')).toBeInTheDocument();
  });

  it('banner can be dismissed normally via "Restore original" after a same-user reopen', async () => {
    const onOpenChange = jest.fn();
    const { rerender } = render(
      <GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />,
    );

    // ── Generate a result ────────────────────────────────────────────────────
    const chip = screen.getByText("What's for dinner tonight?");
    await act(async () => {
      fireEvent.click(chip);
    });

    await waitFor(
      () => expect(screen.getByText('Grilled Chicken')).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // ── Refine the meal ───────────────────────────────────────────────────────
    const refineBtn = screen.getByText('Refine Meal');
    await act(async () => {
      fireEvent.click(refineBtn);
    });
    expect(capturedOnRefined).not.toBeNull();
    await act(async () => {
      capturedOnRefined!(REFINED_RESULT);
    });

    await waitFor(() =>
      expect(screen.getByText('Restore original')).toBeInTheDocument(),
    );

    // ── Close and reopen (same user) ─────────────────────────────────────────
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={false} onOpenChange={onOpenChange} />);
    });
    await act(async () => {
      rerender(<GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />);
    });

    // Confirm banner is still present after reopen
    await waitFor(() =>
      expect(screen.getByText('Restore original')).toBeInTheDocument(),
    );

    // ── Dismiss via "Restore original" ───────────────────────────────────────
    await act(async () => {
      fireEvent.click(screen.getByText('Restore original'));
    });

    // Banner must be gone after dismissal
    expect(screen.queryByText('Restore original')).not.toBeInTheDocument();
    expect(screen.queryByText('Showing refined version')).not.toBeInTheDocument();

    // The original meal name must be back
    await waitFor(() =>
      expect(screen.getByText('Grilled Chicken')).toBeInTheDocument(),
    );
    expect(screen.queryByText('Herb-Crusted Grilled Chicken')).not.toBeInTheDocument();
  });

  it('multiple rapid close/reopen cycles for the same user keep the banner alive each time', async () => {
    const onOpenChange = jest.fn();
    const { rerender } = render(
      <GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />,
    );

    // ── Generate and refine ───────────────────────────────────────────────────
    const chip = screen.getByText("What's for dinner tonight?");
    await act(async () => {
      fireEvent.click(chip);
    });

    await waitFor(
      () => expect(screen.getByText('Grilled Chicken')).toBeInTheDocument(),
      { timeout: 3000 },
    );

    const refineBtn = screen.getByText('Refine Meal');
    await act(async () => {
      fireEvent.click(refineBtn);
    });
    expect(capturedOnRefined).not.toBeNull();
    await act(async () => {
      capturedOnRefined!(REFINED_RESULT);
    });

    await waitFor(() =>
      expect(screen.getByText('Restore original')).toBeInTheDocument(),
    );

    // ── Three rapid close/reopen cycles ──────────────────────────────────────
    for (let cycle = 0; cycle < 3; cycle++) {
      await act(async () => {
        rerender(<GroceryStoreCoachSheet open={false} onOpenChange={onOpenChange} />);
      });
      await act(async () => {
        rerender(<GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />);
      });

      // Banner must survive every cycle
      // eslint-disable-next-line no-await-in-loop
      await waitFor(() =>
        expect(screen.getByText('Restore original')).toBeInTheDocument(),
      );
      expect(screen.getByText('Showing refined version')).toBeInTheDocument();
    }
  });

  it('localStorage still holds preRefinedResult after multiple close/reopen cycles, and a page reload restores the banner', async () => {
    const SESSION_KEY = 'grocery-coach-session:test-user-banner';

    const onOpenChange = jest.fn();
    const { rerender, unmount } = render(
      <GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />,
    );

    // ── Step 1: generate a result ─────────────────────────────────────────────
    const chip = screen.getByText("What's for dinner tonight?");
    await act(async () => {
      fireEvent.click(chip);
    });

    await waitFor(
      () => expect(screen.getByText('Grilled Chicken')).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // ── Step 2: refine the meal — banner must appear ──────────────────────────
    const refineBtn = screen.getByText('Refine Meal');
    await act(async () => {
      fireEvent.click(refineBtn);
    });
    expect(capturedOnRefined).not.toBeNull();
    await act(async () => {
      capturedOnRefined!(REFINED_RESULT);
    });

    await waitFor(() =>
      expect(screen.getByText('Restore original')).toBeInTheDocument(),
    );

    // ── Step 3: two close/reopen cycles for the same user ────────────────────
    for (let cycle = 0; cycle < 2; cycle++) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        rerender(<GroceryStoreCoachSheet open={false} onOpenChange={onOpenChange} />);
      });
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        rerender(<GroceryStoreCoachSheet open={true} onOpenChange={onOpenChange} />);
      });

      // Banner must survive every cycle
      // eslint-disable-next-line no-await-in-loop
      await waitFor(() =>
        expect(screen.getByText('Restore original')).toBeInTheDocument(),
      );
    }

    // ── Step 4: confirm localStorage was updated by the save effect and still
    //   holds preRefinedResult after all those cycles ──────────────────────────
    await waitFor(() => {
      const raw = localStorage.getItem(SESSION_KEY);
      expect(raw).not.toBeNull();
      const session = JSON.parse(raw!);
      // The current (refined) result must be persisted
      expect(session.result?.meal?.name).toBe('Herb-Crusted Grilled Chicken');
      // preRefinedResult must still be present so a page reload can restore the banner
      expect(session.preRefinedResult?.meal?.name).toBe('Grilled Chicken');
    });

    // ── Step 5: simulate a page reload by unmounting and remounting while
    //   localStorage still holds the mid-refinement session ───────────────────
    unmount();

    render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);

    // The refined meal name must be rehydrated from localStorage
    await waitFor(
      () => expect(screen.getByText('Herb-Crusted Grilled Chicken')).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // The "Restore original" banner must appear because preRefinedResult was
    // persisted across all the close/reopen cycles
    await waitFor(() =>
      expect(screen.getByText('Restore original')).toBeInTheDocument(),
    );
    expect(screen.getByText('Showing refined version')).toBeInTheDocument();
  });
});
