/**
 * @jest-environment jsdom
 *
 * GroceryStoreCoachSheet — "★ Saved" badge and personalization banner
 *
 * Verifies that when a user has saved groceries whose keys match a product
 * advisor recommendation:
 *  1. The "★ Saved" pill badge renders on the matching brand card.
 *  2. The "Personalized from your Saved Groceries" banner appears when ≥1
 *     saved item is present in the advice, and is absent when none are saved.
 *  3. The Pick / "✓ Picked" button labels render correctly and fire onPick.
 */

// ── Module mocks ─────────────────────────────────────────────────────────────
// GroceryStoreCoachSheet imports several runtime-only modules (wouter, framer-motion,
// zustand stores, AuthContext) that use ESM syntax Jest can't parse.  Mock them
// before any imports so the test suite can import the pure helpers it needs.
// Note: @/lib/sentry is automatically stubbed via jest.config.ts moduleNameMapper.

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
      const React = require('react');
      return React.createElement('div', rest, children);
    },
  },
  AnimatePresence: ({ children }: any) => children,
}));
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock('@/lib/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('@/stores/shoppingListStore', () => ({ useShoppingListStore: jest.fn(() => jest.fn()) }));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({ user: { id: 'test-user' } })),
}));
jest.mock('@/components/ui/pill-button', () => ({
  PillButton: ({ children, onClick, active }: any) => {
    const React = require('react');
    return React.createElement('button', { onClick, 'data-active': active }, children);
  },
}));
jest.mock('@/hooks/useSpeechToText', () => ({
  useSpeechToText: () => ({
    state: 'idle',
    text: '',
    start: jest.fn(),
    stop: jest.fn(),
    reset: jest.fn(),
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => {
      // Return predictable English strings so assertions don't depend on locale files.
      const map: Record<string, string> = {
        'smartCart.pick': 'Pick',
        'smartCart.picked': '✓ Picked',
        'smartCart.brandsSummary': opts?.count === 1
          ? `1 brand selected`
          : `${opts?.count ?? 0} brands selected`,
      };
      return map[key] ?? key;
    },
    i18n: { language: 'en', changeLanguage: jest.fn() },
  }),
}));

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  SmartCartAdviceBody,
  computeClientProductKey,
} from '@/components/shopping/GroceryStoreCoachSheet';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const OLIVE_OIL_ADVICE = {
  ingredient: 'Olive Oil',
  category: 'Pantry',
  recommended: [
    { brand: 'California Olive Ranch', rank: 1 as const, grade: 'A' as const, reason: 'High polyphenol content.' },
    { brand: 'Kirkland Organic', rank: 2 as const, grade: 'B' as const, reason: 'Good value pick.' },
    { brand: 'Store Brand', rank: 3 as const, grade: 'C' as const, reason: 'Budget option.' },
  ],
  avoid: [],
};

const SALMON_ADVICE = {
  ingredient: 'Salmon',
  category: 'Meat',
  recommended: [
    { brand: 'Wild Planet', rank: 1 as const, grade: 'A' as const, reason: 'Wild-caught, sustainable.' },
  ],
  avoid: [{ brand: 'Generic Farmed', reason: 'High contaminants.' }],
};

// ── Helper: build a savedProductKeys Set from ingredient+brand pairs ───────────

function makeKeys(...pairs: Array<[brand: string, ingredient: string]>): Set<string> {
  return new Set(pairs.map(([b, i]) => computeClientProductKey(b, i)));
}

/** Empty pick state — used as the default for tests that don't exercise picks. */
const NO_PICKS = new Map<string, any>();
const NO_OP_PICK = () => {};

// ── computeClientProductKey ───────────────────────────────────────────────────

describe('computeClientProductKey', () => {
  it('lowercases and strips non-alphanumeric characters from both sides', () => {
    expect(computeClientProductKey('California Olive Ranch', 'Olive Oil'))
      .toBe('name::californiaoliveranch::oliveoil');
  });

  it('produces the same key regardless of casing', () => {
    expect(computeClientProductKey('WILD PLANET', 'Salmon'))
      .toBe(computeClientProductKey('Wild Planet', 'salmon'));
  });
});

// ── SmartCartAdviceBody — "★ Saved" badge ────────────────────────────────────

describe('SmartCartAdviceBody — "★ Saved" badge', () => {
  it('renders the ★ Saved badge on a brand card whose key is in savedProductKeys', () => {
    const savedKeys = makeKeys(['California Olive Ranch', 'Olive Oil']);

    const { getByTestId } = render(
      <SmartCartAdviceBody
        advice={[OLIVE_OIL_ADVICE]}
        savedProductKeys={savedKeys}
        savingKey={null}
        onSave={() => {}}
        pickedBrands={NO_PICKS}
        onPick={NO_OP_PICK}
      />,
    );

    expect(getByTestId('saved-badge-California Olive Ranch')).toBeInTheDocument();
    expect(getByTestId('saved-badge-California Olive Ranch')).toHaveTextContent('★ Saved');
  });

  it('does NOT render the ★ Saved badge when the brand key is not in savedProductKeys', () => {
    const { queryByTestId } = render(
      <SmartCartAdviceBody
        advice={[OLIVE_OIL_ADVICE]}
        savedProductKeys={new Set()}
        savingKey={null}
        onSave={() => {}}
        pickedBrands={NO_PICKS}
        onPick={NO_OP_PICK}
      />,
    );

    expect(queryByTestId('saved-badge-California Olive Ranch')).toBeNull();
    expect(queryByTestId('saved-badge-Kirkland Organic')).toBeNull();
  });

  it('renders the badge only on the matching brand, not on other brands in the same ingredient', () => {
    // Only rank-2 brand is saved.
    const savedKeys = makeKeys(['Kirkland Organic', 'Olive Oil']);

    const { queryByTestId } = render(
      <SmartCartAdviceBody
        advice={[OLIVE_OIL_ADVICE]}
        savedProductKeys={savedKeys}
        savingKey={null}
        onSave={() => {}}
        pickedBrands={NO_PICKS}
        onPick={NO_OP_PICK}
      />,
    );

    expect(queryByTestId('saved-badge-California Olive Ranch')).toBeNull();
    expect(queryByTestId('saved-badge-Kirkland Organic')).toBeInTheDocument();
    expect(queryByTestId('saved-badge-Store Brand')).toBeNull();
  });

  it('renders badges on multiple brands when several are saved', () => {
    const savedKeys = makeKeys(
      ['Wild Planet', 'Salmon'],
      ['California Olive Ranch', 'Olive Oil'],
    );

    const { getByTestId } = render(
      <SmartCartAdviceBody
        advice={[OLIVE_OIL_ADVICE, SALMON_ADVICE]}
        savedProductKeys={savedKeys}
        savingKey={null}
        onSave={() => {}}
        pickedBrands={NO_PICKS}
        onPick={NO_OP_PICK}
      />,
    );

    expect(getByTestId('saved-badge-California Olive Ranch')).toBeInTheDocument();
    expect(getByTestId('saved-badge-Wild Planet')).toBeInTheDocument();
  });
});

// ── SmartCartAdviceBody — personalization banner ──────────────────────────────

describe('SmartCartAdviceBody — personalization banner', () => {
  it('shows the banner when ≥1 recommended brand key is in savedProductKeys', () => {
    const savedKeys = makeKeys(['California Olive Ranch', 'Olive Oil']);

    const { getByTestId } = render(
      <SmartCartAdviceBody
        advice={[OLIVE_OIL_ADVICE]}
        savedProductKeys={savedKeys}
        savingKey={null}
        onSave={() => {}}
        pickedBrands={NO_PICKS}
        onPick={NO_OP_PICK}
      />,
    );

    const banner = getByTestId('personalization-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('Personalized from your Saved Groceries');
  });

  it('hides the banner when no recommended brand keys are in savedProductKeys', () => {
    const { queryByTestId } = render(
      <SmartCartAdviceBody
        advice={[OLIVE_OIL_ADVICE]}
        savedProductKeys={new Set()}
        savingKey={null}
        onSave={() => {}}
        pickedBrands={NO_PICKS}
        onPick={NO_OP_PICK}
      />,
    );

    expect(queryByTestId('personalization-banner')).toBeNull();
  });

  it('hides the banner when the advice list is empty', () => {
    const { queryByTestId } = render(
      <SmartCartAdviceBody
        advice={[]}
        savedProductKeys={new Set(['name::somekey::somevalue'])}
        savingKey={null}
        onSave={() => {}}
        pickedBrands={NO_PICKS}
        onPick={NO_OP_PICK}
      />,
    );

    expect(queryByTestId('personalization-banner')).toBeNull();
  });

  it('shows the banner when a second ingredient has a matching saved key, even if the first does not', () => {
    // Olive oil brands not saved; salmon rank-1 brand IS saved.
    const savedKeys = makeKeys(['Wild Planet', 'Salmon']);

    const { getByTestId } = render(
      <SmartCartAdviceBody
        advice={[OLIVE_OIL_ADVICE, SALMON_ADVICE]}
        savedProductKeys={savedKeys}
        savingKey={null}
        onSave={() => {}}
        pickedBrands={NO_PICKS}
        onPick={NO_OP_PICK}
      />,
    );

    expect(getByTestId('personalization-banner')).toBeInTheDocument();
  });
});

// ── SmartCartAdviceBody — Pick / Picked button ────────────────────────────────

describe('SmartCartAdviceBody — Pick / Picked button', () => {
  it('renders "Pick" label when no brand is picked for that ingredient', () => {
    const { getAllByText } = render(
      <SmartCartAdviceBody
        advice={[OLIVE_OIL_ADVICE]}
        savedProductKeys={new Set()}
        savingKey={null}
        onSave={() => {}}
        pickedBrands={NO_PICKS}
        onPick={NO_OP_PICK}
      />,
    );

    // One Pick button per recommended brand (3 for olive oil)
    const pickBtns = getAllByText('Pick');
    expect(pickBtns.length).toBe(3);
  });

  it('renders "✓ Picked" on the picked brand and "Pick" on the rest', () => {
    const picked = new Map<string, any>([
      ['olive oil', { brand: 'California Olive Ranch', rank: 1, grade: 'A', reason: '' }],
    ]);

    const { getByText, getAllByText } = render(
      <SmartCartAdviceBody
        advice={[OLIVE_OIL_ADVICE]}
        savedProductKeys={new Set()}
        savingKey={null}
        onSave={() => {}}
        pickedBrands={picked}
        onPick={NO_OP_PICK}
      />,
    );

    expect(getByText('✓ Picked')).toBeInTheDocument();
    // Remaining two brands still show "Pick"
    expect(getAllByText('Pick').length).toBe(2);
  });

  it('calls onPick with the ingredient and brand when the Pick button is clicked', () => {
    const onPick = jest.fn();

    const { getAllByText } = render(
      <SmartCartAdviceBody
        advice={[OLIVE_OIL_ADVICE]}
        savedProductKeys={new Set()}
        savingKey={null}
        onSave={() => {}}
        pickedBrands={NO_PICKS}
        onPick={onPick}
      />,
    );

    getAllByText('Pick')[0].click();
    expect(onPick).toHaveBeenCalledWith('Olive Oil', OLIVE_OIL_ADVICE.recommended[0]);
  });
});
