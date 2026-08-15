/**
 * @jest-environment jsdom
 *
 * GroceryStoreCoachSheet — brand pick persistence & cross-account isolation
 *
 * Renders the actual component to verify:
 *  1. Brand picks are restored from localStorage when the sheet is reopened
 *  2. User A's brand picks are never shown to user B after an account switch
 *  3. User B's localStorage key is never written with user A's picks
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
  useAuth: jest.fn(() => ({ user: { id: USER_A_ID } })),
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

// Hoist ID constants so the mock factory above can reference them.
const USER_A_ID = 'brand-pick-user-a';
const USER_B_ID = 'brand-pick-user-b';
const KEY_A = `grocery-coach-session:${USER_A_ID}`;
const KEY_B = `grocery-coach-session:${USER_B_ID}`;

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAuth } from '@/contexts/AuthContext';
import { get, post } from '@/lib/api';
import GroceryStoreCoachSheet from '@/components/shopping/GroceryStoreCoachSheet';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MEAL_RESULT = {
  meal: { name: 'Grilled Salmon', description: 'Healthy omega-3 meal', prepTime: '20m', servings: 2 },
  reasoning: ['High protein', 'Low carb'],
  macros: { calories: 450, protein: 42, carbs: 10, fat: 22 },
  ownedIngredients: [],
  shoppingList: [
    { item: 'Salmon Fillet', quantity: '2', unit: 'lb', category: 'Seafood' },
    { item: 'Olive Oil',     quantity: '2', unit: 'tbsp', category: 'Pantry' },
  ],
  followUpSuggestions: [],
  servingCount: 2,
};

// Product advice covering the same ingredients as MEAL_RESULT.shoppingList.
// Including this in the saved session prevents the restore effect from
// triggering fetchProductAdvice (which would call setPickedBrands(new Map())).
const PRODUCT_ADVICE = {
  advice: [
    {
      ingredient: 'Salmon Fillet',
      category: 'Seafood',
      usualPick: null,
      recommended: [{ brand: 'Wild Planet', rank: 1 as const, grade: 'A' as const, reason: 'Wild caught' }],
      avoid: [],
    },
    {
      ingredient: 'Olive Oil',
      category: 'Pantry',
      usualPick: null,
      recommended: [{ brand: 'California Olive Ranch', rank: 1 as const, grade: 'A' as const, reason: 'EVOO' }],
      avoid: [],
    },
  ],
  profileUsed: ['GLP-1'],
};

// Two brand picks: one per ingredient in MEAL_RESULT.shoppingList.
const PICKED_BRANDS_ENTRIES: Array<[string, { brand: string; rank: 1; grade: 'A'; reason: string }]> = [
  ['salmon fillet', { brand: 'Wild Planet',           rank: 1, grade: 'A', reason: 'Wild caught' }],
  ['olive oil',     { brand: 'California Olive Ranch', rank: 1, grade: 'A', reason: 'EVOO' }],
];

function makeSession(overrides: { pickedBrandsEntries?: typeof PICKED_BRANDS_ENTRIES } = {}) {
  return {
    result: MEAL_RESULT,
    preRefinedResult: undefined,
    conversation: [{ role: 'user' as const, content: 'Suggest a healthy meal' }],
    productAdvice: PRODUCT_ADVICE,
    pickedBrandsEntries: overrides.pickedBrandsEntries ?? PICKED_BRANDS_ENTRIES,
    savedAt: Date.now(),
  };
}

function renderSheet() {
  return render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  (get as jest.Mock).mockResolvedValue({ items: [] });
  (post as jest.Mock).mockResolvedValue({ advice: [] });
  (useAuth as jest.Mock).mockReturnValue({ user: { id: USER_A_ID } });
});

// ── 1. Picks survive sheet close and reopen ────────────────────────────────────

describe('brand picks — survive sheet close and reopen', () => {
  it('shows the picked-brands summary when picks are in the restored session', async () => {
    localStorage.setItem(KEY_A, JSON.stringify(makeSession()));
    renderSheet();

    // The picked-brand summary div (data-testid="picked-brands-summary") is
    // rendered when pickedBrands.size > 0 in result phase.
    await waitFor(() =>
      expect(screen.getByTestId('picked-brands-summary')).toBeInTheDocument()
    );
  });

  it('does not show the picked-brands summary when the session has no picks', async () => {
    localStorage.setItem(KEY_A, JSON.stringify(makeSession({ pickedBrandsEntries: [] })));
    renderSheet();

    // Give the component time to restore state
    await act(async () => { await Promise.resolve(); });

    expect(screen.queryByTestId('picked-brands-summary')).not.toBeInTheDocument();
  });

  it('shows the picked-brands summary for a single brand pick', async () => {
    const singlePick: typeof PICKED_BRANDS_ENTRIES = [
      ['olive oil', { brand: 'California Olive Ranch', rank: 1, grade: 'A', reason: 'EVOO' }],
    ];
    localStorage.setItem(KEY_A, JSON.stringify(makeSession({ pickedBrandsEntries: singlePick })));
    renderSheet();

    await waitFor(() =>
      expect(screen.getByTestId('picked-brands-summary')).toBeInTheDocument()
    );
  });
});

// ── 2. Cross-account isolation — user A's picks must not appear for user B ────

describe('cross-account isolation — picks cleared on account switch', () => {
  it('does not show user A picks after switching to user B with no session', async () => {
    // Pre-populate user A's session with picks
    localStorage.setItem(KEY_A, JSON.stringify(makeSession()));

    // Render as user A — picks should be visible
    (useAuth as jest.Mock).mockReturnValue({ user: { id: USER_A_ID } });
    const { rerender } = renderSheet();
    await waitFor(() =>
      expect(screen.getByTestId('picked-brands-summary')).toBeInTheDocument()
    );

    // Switch to user B — no session stored for B
    (useAuth as jest.Mock).mockReturnValue({ user: { id: USER_B_ID } });
    rerender(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);
    await act(async () => { await Promise.resolve(); });

    // User A's picks summary must have disappeared
    await waitFor(() =>
      expect(screen.queryByTestId('picked-brands-summary')).not.toBeInTheDocument()
    );
  });

  it('does not write user A picks into user B localStorage key after an account switch', async () => {
    // Pre-populate user A's session with picks
    localStorage.setItem(KEY_A, JSON.stringify(makeSession()));

    // Render as user A — picks should be visible
    (useAuth as jest.Mock).mockReturnValue({ user: { id: USER_A_ID } });
    const { rerender } = renderSheet();
    await waitFor(() =>
      expect(screen.getByTestId('picked-brands-summary')).toBeInTheDocument()
    );

    // Switch to user B — no session for B
    (useAuth as jest.Mock).mockReturnValue({ user: { id: USER_B_ID } });
    rerender(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);

    // Flush pending effects
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    // User B's key must remain absent — no picks leaked from user A's in-memory state
    const raw = localStorage.getItem(KEY_B);
    if (raw) {
      const parsed = JSON.parse(raw);
      // If any payload was written, it must not contain A's picks
      expect(parsed.pickedBrandsEntries ?? []).toHaveLength(0);
    } else {
      expect(raw).toBeNull();
    }
  });

  it('does not show user A picks when initially rendered directly as user B', async () => {
    // User A has a session with picks; user B has none
    localStorage.setItem(KEY_A, JSON.stringify(makeSession()));

    // Render directly as user B — no prior render as A
    (useAuth as jest.Mock).mockReturnValue({ user: { id: USER_B_ID } });
    renderSheet();

    await act(async () => { await Promise.resolve(); });

    // User B must never see user A's picked-brands summary
    expect(screen.queryByTestId('picked-brands-summary')).not.toBeInTheDocument();
  });
});
