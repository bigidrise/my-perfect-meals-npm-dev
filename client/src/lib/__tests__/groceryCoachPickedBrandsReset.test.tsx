/**
 * @jest-environment jsdom
 *
 * GroceryStoreCoachSheet — brand summary bar resets when shopping list regenerates
 *
 * What these tests verify
 * ────────────────────────
 * GroceryStoreCoachSheet calls setPickedBrands(new Map()) in three code paths
 * that replace the shopping list mid-session:
 *
 *   sendMessage()            line ~660  (before first await)
 *   fetchProductAdvice()     line ~592  (before its first await)
 *   handleNewSession()       line ~731  (synchronous reset)
 *
 * Each test proves the picks are cleared by verifying the component returns to
 * phase === "result" with a BRAND NEW result and the summary bar is ABSENT.
 * Asserting after the new result renders is essential: the bar lives inside the
 * result view, so if stale picks remained in pickedBrands the bar would reappear
 * as soon as the new result mounted — the test would catch that regression.
 *
 * Why this design works as a regression
 * ──────────────────────────────────────
 * If setPickedBrands(new Map()) is removed from both sendMessage (~line 660) and
 * fetchProductAdvice (~line 592):
 *   - Old picks remain in React state throughout the loading cycle.
 *   - When the new result renders (phase === "result"), pickedBrands.size > 0
 *     causes data-testid="picked-brands-summary" to appear.
 *   - The waitFor assertion below fails. ✓
 *
 * If setPickedBrands(new Map()) is removed from handleNewSession (~line 731):
 *   - Old picks survive the "New" click.
 *   - The subsequent sendMessage would clear them via line ~660 in the current
 *     code — but if that were also removed, stale picks remain through the full
 *     cycle and the bar reappears after the new result renders. ✓
 *
 * Run: npx jest client/src/lib/__tests__/groceryCoachPickedBrandsReset.test.tsx
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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: any) => {
      if (k === 'smartCart.brandsSummary') {
        const count = opts?.count ?? 0;
        return count === 1 ? '1 brand selected' : `${count} brands selected`;
      }
      return k;
    },
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

jest.mock('@/stores/shoppingListStore', () => ({
  useShoppingListStore: jest.fn(() => jest.fn()),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

jest.mock('@/lib/api', () => ({ post: jest.fn(), get: jest.fn() }));

jest.mock('@/lib/sentry', () => ({
  setUserContext: jest.fn(),
  clearUserContext: jest.fn(),
}));

jest.mock('@/components/MealRefinementSheet', () => ({
  __esModule: true,
  default: () => null,
}));

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
import GroceryStoreCoachSheet from '@/components/shopping/GroceryStoreCoachSheet';

// ── Constants ─────────────────────────────────────────────────────────────────

const SESSION_KEY = 'grocery-coach-session:u1';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * Session payload with one picked brand.
 * The productAdvice covers every ingredient so isAdviceStale() returns false
 * and the component restores advice without a background re-fetch.
 */
const INITIAL_SESSION = {
  result: {
    meal: { name: 'Herb Chicken', description: 'Light', prepTime: '25m', servings: 2 },
    reasoning: [],
    macros: { calories: 380, protein: 44, carbs: 6, fat: 13 },
    shoppingList: [
      { item: 'chicken breast', quantity: '1', unit: 'lb', category: 'Meat' },
    ],
    ownedIngredients: [],
    followUpSuggestions: [],
    servingCount: 2,
  },
  productAdvice: {
    advice: [
      {
        ingredient: 'chicken breast',
        category: 'Meat',
        recommended: [{ brand: 'Tyson Air Chilled', rank: 1, grade: 'A', reason: 'Clean' }],
        avoid: [],
      },
    ],
    profileUsed: [],
  },
  // One brand was picked — summary bar should be visible on restore
  pickedBrandsEntries: [
    ['chicken breast', { brand: 'Tyson Air Chilled', rank: 1, grade: 'A', reason: 'Clean' }],
  ],
  conversation: [],
  savedAt: Date.now(),
};

/**
 * The API response returned when sendMessage fires for the NEW recommendation.
 * Uses a distinct meal name ("Turkey Bowl") so tests can wait for it to appear.
 */
const NEW_RESULT = {
  meal: { name: 'Turkey Bowl', description: 'Fresh start', prepTime: '20m', servings: 2 },
  reasoning: [],
  macros: { calories: 340, protein: 40, carbs: 10, fat: 10 },
  shoppingList: [
    { item: 'turkey breast', quantity: '6', unit: 'oz', category: 'Meat' },
  ],
  ownedIngredients: [],
  followUpSuggestions: [],
  servingCount: 2,
};

/**
 * Wire up post() to discriminate by URL:
 *   /recommend      → resolves with NEW_RESULT
 *   /product-advisor → resolves with empty advice (no new picks)
 *   /meal-card       → resolves with minimal card object (non-blocking)
 *   anything else    → resolves empty
 */
function mockPostWithNewResult() {
  (post as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/recommend')) {
      return Promise.resolve(NEW_RESULT);
    }
    if (url.includes('/product-advisor')) {
      // Empty advice — no new picks will be set after the reset
      return Promise.resolve({ advice: [], profileUsed: [] });
    }
    if (url.includes('/meal-card')) {
      return Promise.resolve({
        id: 'card-new',
        imageUrl: null,
        destination: '/meals/turkey-bowl',
        title: 'Turkey Bowl',
      });
    }
    return Promise.resolve({});
  });
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('GroceryStoreCoachSheet — summary bar clears when shopping list regenerates', () => {

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    (get as jest.Mock).mockResolvedValue({ items: [] });
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ── 1. handleGenerateAnother path ─────────────────────────────────────────
  //
  // "Try a Different Meal" → handleGenerateAnother → sendMessage("Give me a different option")
  // → setPickedBrands(new Map()) fires at line ~660, before the API await.
  // → fetchProductAdvice fires after the new result arrives and also calls
  //   setPickedBrands(new Map()) at line ~592.
  //
  // Regression test: the component returns to phase === "result" with a new meal
  // ("Turkey Bowl"). If stale picks were not cleared, the bar would reappear
  // alongside the new result. The assertion confirms it does not.

  it('clears the summary bar when "Try a Different Meal" delivers a new shopping list', async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(INITIAL_SESSION));
    mockPostWithNewResult();

    render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);

    // Confirm the old session restored and the bar is visible
    await waitFor(() =>
      expect(screen.getByTestId('picked-brands-summary')).toBeInTheDocument()
    );

    // Trigger handleGenerateAnother → sendMessage
    fireEvent.click(screen.getByText('Try a Different Meal'));

    // Wait for the new result to render (phase returns to "result")
    await waitFor(() =>
      expect(screen.getByText('Turkey Bowl')).toBeInTheDocument(),
      { timeout: 5000 }
    );

    // Now that the result section is mounted with the new data, the bar must be absent.
    // If setPickedBrands(new Map()) were removed, stale picks would still be in state
    // and the bar would reappear here.
    expect(screen.queryByTestId('picked-brands-summary')).not.toBeInTheDocument();
  });

  // ── 2. sendMessage path (textarea + send) ────────────────────────────────
  //
  // The user types a refinement and submits. handleSubmit → sendMessage(input).
  // Same line ~660 reset + fetchProductAdvice line ~592 reset apply.

  it('clears the summary bar when the user types a refinement and submits', async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(INITIAL_SESSION));
    mockPostWithNewResult();

    render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByTestId('picked-brands-summary')).toBeInTheDocument()
    );

    // Type a refinement in the textarea
    const textarea = screen.getByPlaceholderText('Make it cheaper… faster… vegetarian…');
    fireEvent.change(textarea, { target: { value: 'Make it vegetarian' } });

    // Click the Send button (the non-disabled button in the same flex container)
    const sendBtn = textarea
      .closest('div')!
      .querySelector('button:not([disabled])') as HTMLElement;
    expect(sendBtn).not.toBeNull();
    fireEvent.click(sendBtn);

    // Wait for new result — means phase === "result" and the result view is mounted
    await waitFor(() =>
      expect(screen.getByText('Turkey Bowl')).toBeInTheDocument(),
      { timeout: 5000 }
    );

    // Bar must not be visible — stale picks were cleared before or during the transition
    expect(screen.queryByTestId('picked-brands-summary')).not.toBeInTheDocument();
  });

  // ── 3. handleNewSession → subsequent sendMessage path ────────────────────
  //
  // Clicking "New" resets all state (including setPickedBrands(new Map()) at
  // line ~731). The user then sends a message that produces a new result.
  // If handleNewSession's reset were removed, old picks would survive the "New"
  // click; if sendMessage's reset were also removed, those stale picks would
  // persist into the new result and the bar would reappear.

  it('clears the summary bar when the user starts a new session and gets a result', async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(INITIAL_SESSION));
    mockPostWithNewResult();

    render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);

    // Confirm bar is visible from the restored session
    await waitFor(() =>
      expect(screen.getByTestId('picked-brands-summary')).toBeInTheDocument()
    );

    // Click "New" (handleNewSession) — clears result, phase → idle, picks → empty Map
    fireEvent.click(await waitFor(() => screen.getByTitle('Start a new session')));

    // Now type a quick-start or refinement message and submit to generate a new result
    const textarea = await waitFor(() =>
      screen.getByPlaceholderText('e.g. I have no idea what I want for dinner…')
    );
    fireEvent.change(textarea, { target: { value: 'Something quick' } });

    const sendBtn = textarea
      .closest('div')!
      .querySelector('button:not([disabled])') as HTMLElement;
    expect(sendBtn).not.toBeNull();
    fireEvent.click(sendBtn);

    // Wait for the new result to render
    await waitFor(() =>
      expect(screen.getByText('Turkey Bowl')).toBeInTheDocument(),
      { timeout: 5000 }
    );

    // Bar must be absent — picks cleared by handleNewSession and/or sendMessage.
    // If both resets were removed, stale picks would persist and the bar would appear.
    expect(screen.queryByTestId('picked-brands-summary')).not.toBeInTheDocument();
  });
});
