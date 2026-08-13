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
 */

// ── Module mocks ─────────────────────────────────────────────────────────────
// GroceryStoreCoachSheet imports several runtime-only modules (wouter, framer-motion,
// zustand stores) that use ESM syntax Jest can't parse.  Mock them before any
// imports so the test suite can import the pure helpers it actually needs.

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
jest.mock('@/lib/api', () => ({ post: jest.fn() }));
jest.mock('@/stores/shoppingListStore', () => ({ useShoppingListStore: jest.fn(() => jest.fn()) }));

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
      />,
    );

    expect(getByTestId('personalization-banner')).toBeInTheDocument();
  });
});
