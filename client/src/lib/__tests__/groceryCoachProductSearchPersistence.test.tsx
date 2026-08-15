/**
 * @jest-environment jsdom
 *
 * GroceryStoreCoachSheet — Find-a-Product session persistence
 *
 * Renders the actual component to verify:
 *  1. Product-search results are restored from localStorage within 24 h
 *  2. Expired sessions (>24 h) are discarded and the key is removed
 *  3. "Compare Another" clears the localStorage key and resets the UI to idle
 *  4. User A's product session is never shown to user B (key isolation)
 *  5. Switching accounts never writes user A's result under user B's key (owner-key guard)
 *  6. In-flight product-advisor responses for user A are discarded after an account switch
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
  useAuth: jest.fn(() => ({ user: { id: 'user-ps-a' } })),
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
import { useAuth } from '@/contexts/AuthContext';
import { get, post } from '@/lib/api';
import GroceryStoreCoachSheet from '@/components/shopping/GroceryStoreCoachSheet';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_A_ID = 'user-ps-a';
const USER_B_ID = 'user-ps-b';
const KEY_A = `grocery-coach-product-search:${USER_A_ID}`;
const KEY_B = `grocery-coach-product-search:${USER_B_ID}`;

const PRODUCT_RESULT = {
  advice: [
    {
      ingredient: 'Greek Yogurt',
      category: 'Dairy & Eggs',
      usualPick: null,
      recommended: [
        { brand: 'Fage Total', rank: 1, grade: 'A', reason: 'High protein, low sugar' },
        { brand: 'Chobani Plain', rank: 2, grade: 'A', reason: 'Clean ingredients' },
      ],
      avoid: [],
    },
  ],
  profileUsed: ['High Protein'],
};

function makeProductSession(overrides: Partial<{ savedAt: number; query: string }> = {}) {
  return {
    query: overrides.query ?? 'high-protein yogurt',
    advice: PRODUCT_RESULT,
    savedAt: overrides.savedAt ?? Date.now(),
  };
}

function renderSheet() {
  return render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);
}

async function switchToFindProduct() {
  const tab = await screen.findByTestId('tab-find-product');
  fireEvent.click(tab);
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  (get as jest.Mock).mockResolvedValue({ items: [] });
  (useAuth as jest.Mock).mockReturnValue({ user: { id: USER_A_ID } });
});

// ── 1. Restore within 24 h ────────────────────────────────────────────────────

describe('product-search restore within 24 h', () => {
  it('renders brand picks from the restored session (component reaches result phase)', async () => {
    localStorage.setItem(KEY_A, JSON.stringify(makeProductSession()));
    renderSheet();
    await switchToFindProduct();
    // Brand names from PRODUCT_RESULT are the visible signal that results were restored
    await waitFor(() => expect(screen.getByText('Fage Total')).toBeInTheDocument());
    expect(screen.getByText('Chobani Plain')).toBeInTheDocument();
  });

  it('renders the Compare Another button when a session is restored, confirming result phase', async () => {
    localStorage.setItem(KEY_A, JSON.stringify(makeProductSession({ query: 'low-sodium crackers' })));
    renderSheet();
    await switchToFindProduct();
    // If the session was restored, productPhase = "result" and Compare Another is visible
    await waitFor(() => expect(screen.getByTestId('button-compare-another')).toBeInTheDocument());
    // The idle search input is hidden in result phase
    expect(screen.queryByTestId('input-find-product')).not.toBeInTheDocument();
  });

  it('shows the Compare Another button when a session is restored', async () => {
    localStorage.setItem(KEY_A, JSON.stringify(makeProductSession()));
    renderSheet();
    await switchToFindProduct();
    await waitFor(() => expect(screen.getByTestId('button-compare-another')).toBeInTheDocument());
  });
});

// ── 2. Expired session is discarded ──────────────────────────────────────────

describe('expired product-search session (>24 h)', () => {
  it('shows the idle search input instead of results when the session is older than 24 h', async () => {
    const TWENTY_FIVE_HOURS_AGO = Date.now() - 25 * 60 * 60 * 1000;
    localStorage.setItem(KEY_A, JSON.stringify(makeProductSession({ savedAt: TWENTY_FIVE_HOURS_AGO })));

    renderSheet();
    await switchToFindProduct();

    await waitFor(() => expect(screen.getByTestId('input-find-product')).toBeInTheDocument());
    expect(screen.queryByText('Greek Yogurt')).not.toBeInTheDocument();
  });

  it('removes the expired key from localStorage so it cannot be restored later', async () => {
    const TWENTY_FIVE_HOURS_AGO = Date.now() - 25 * 60 * 60 * 1000;
    localStorage.setItem(KEY_A, JSON.stringify(makeProductSession({ savedAt: TWENTY_FIVE_HOURS_AGO })));

    renderSheet();
    await switchToFindProduct();
    await waitFor(() => expect(screen.getByTestId('input-find-product')).toBeInTheDocument());

    expect(localStorage.getItem(KEY_A)).toBeNull();
  });
});

// ── 3. Compare Another clears the session ─────────────────────────────────────

describe('Compare Another resets the session', () => {
  it('returns to idle state when Compare Another is clicked', async () => {
    localStorage.setItem(KEY_A, JSON.stringify(makeProductSession()));
    renderSheet();
    await switchToFindProduct();
    await waitFor(() => expect(screen.getByTestId('button-compare-another')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-compare-another'));
    });

    await waitFor(() => expect(screen.getByTestId('input-find-product')).toBeInTheDocument());
    expect(screen.queryByText('Greek Yogurt')).not.toBeInTheDocument();
  });

  it('removes the localStorage key when Compare Another is clicked', async () => {
    localStorage.setItem(KEY_A, JSON.stringify(makeProductSession()));
    renderSheet();
    await switchToFindProduct();
    await waitFor(() => expect(screen.getByTestId('button-compare-another')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-compare-another'));
    });

    await waitFor(() => expect(localStorage.getItem(KEY_A)).toBeNull());
  });

  it('leaves the meal-session key intact when Compare Another is clicked', async () => {
    const mealKey = `grocery-coach-session:${USER_A_ID}`;
    localStorage.setItem(mealKey, JSON.stringify({ result: null, savedAt: Date.now() }));
    localStorage.setItem(KEY_A, JSON.stringify(makeProductSession()));

    renderSheet();
    await switchToFindProduct();
    await waitFor(() => expect(screen.getByTestId('button-compare-another')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-compare-another'));
    });

    await waitFor(() => expect(localStorage.getItem(KEY_A)).toBeNull());
    // Meal session must be untouched by Compare Another
    expect(localStorage.getItem(mealKey)).not.toBeNull();
  });
});

// ── 4. User isolation — no cross-account restore ──────────────────────────────

describe('user account isolation', () => {
  it('does not show user A product results when rendering as user B', async () => {
    localStorage.setItem(KEY_A, JSON.stringify(makeProductSession()));

    // Render as user B — the restore effect looks up KEY_B which is empty
    (useAuth as jest.Mock).mockReturnValue({ user: { id: USER_B_ID } });
    renderSheet();
    await switchToFindProduct();

    await waitFor(() => expect(screen.getByTestId('input-find-product')).toBeInTheDocument());
    expect(screen.queryByText('Greek Yogurt')).not.toBeInTheDocument();
  });

  it('leaves user A data in localStorage intact when rendering as user B', async () => {
    localStorage.setItem(KEY_A, JSON.stringify(makeProductSession()));
    (useAuth as jest.Mock).mockReturnValue({ user: { id: USER_B_ID } });

    renderSheet();
    await switchToFindProduct();
    await waitFor(() => expect(screen.getByTestId('input-find-product')).toBeInTheDocument());

    // User A's key must not be cleared or overwritten by user B's session lifecycle
    const raw = localStorage.getItem(KEY_A);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).advice.advice[0].ingredient).toBe('Greek Yogurt');
  });
});

// ── 5. Owner-key guard — account switch must not write stale data ──────────────

describe('owner-key guard — account switch does not write stale data', () => {
  it('does not write user A product result under user B key after an account switch', async () => {
    (post as jest.Mock).mockResolvedValue(PRODUCT_RESULT);

    const { rerender } = renderSheet();
    await switchToFindProduct();

    // Perform a product search as user A
    const input = await screen.findByTestId('input-find-product');
    fireEvent.change(input, { target: { value: 'high-protein yogurt' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-product-search'));
    });

    // Wait for brand picks to appear — confirms user A's search landed
    await waitFor(() => expect(screen.getByText('Fage Total')).toBeInTheDocument());

    // Switch to user B — simulates account change
    (useAuth as jest.Mock).mockReturnValue({ user: { id: USER_B_ID } });
    rerender(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);

    // Flush all pending effects
    await act(async () => { await Promise.resolve(); });

    // User B's key must remain empty — the owner-key guard must have blocked the write
    expect(localStorage.getItem(KEY_B)).toBeNull();
  });
});

// ── 6. In-flight sessionGenRef guard ──────────────────────────────────────────

describe('sessionGenRef guard — in-flight response discarded on account switch', () => {
  it('does not show user A result or populate user B key when a search resolves after switching', async () => {
    // Hold the fetch so we can switch users before it resolves
    let resolveFetch!: (v: unknown) => void;
    (post as jest.Mock).mockReturnValue(new Promise((res) => { resolveFetch = res; }));

    const { rerender } = renderSheet();
    await switchToFindProduct();

    // Start a search for user A — it is now in-flight
    const input = await screen.findByTestId('input-find-product');
    fireEvent.change(input, { target: { value: 'protein bars' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-product-search'));
    });

    // Switch to user B before the fetch resolves
    (useAuth as jest.Mock).mockReturnValue({ user: { id: USER_B_ID } });
    rerender(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);

    // Let the in-flight fetch for user A complete
    await act(async () => {
      resolveFetch(PRODUCT_RESULT);
      await Promise.resolve();
    });

    // User B must see idle state — user A's response must have been discarded
    expect(screen.queryByText('Greek Yogurt')).not.toBeInTheDocument();
    // User B's localStorage key must remain empty
    expect(localStorage.getItem(KEY_B)).toBeNull();
  });
});
