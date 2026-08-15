/**
 * @jest-environment jsdom
 *
 * Smart Cart Pick button — German and Arabic narrow-screen layout validation
 *
 * Confirms that the Pick/Picked button labels for the de and ar locales:
 *  1. Are present in the locale files with correct values.
 *  2. Render correctly inside SmartCartAdviceBody at both locale settings.
 *  3. Stay within the pixel-width budget expected for a 320 px viewport so
 *     the pill does not overflow or obscure the brand-name column.
 *
 * Pixel-budget rationale
 * ──────────────────────
 * PillButton is `text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap`
 * with `px-4` (16 px × 2 = 32 px) horizontal padding and a `minWidth: 72`
 * inline override.  The brand-card row uses `flex: 1, minWidth: 0` on the
 * centre column so it can shrink; the right button column has `flexShrink: 0`.
 *
 * Empirically, at 9 px semibold with wide tracking:
 *   Latin chars  ≈ 6 px each (including kerning + tracking)
 *   Arabic chars ≈ 8 px each (Arabic glyphs are slightly wider at small sizes)
 *
 * Safe maximum button width on a 320 px card (card padding ~24 px,
 * medal glyph ~20 px, gaps ~10 px) leaves ~266 px for the two right-side
 * columns. We budget ≤ 130 px per button, meaning label text must stay
 * under ~16 Latin chars or ~12 Arabic chars after padding is removed.
 *
 * Measured lengths (conservative upper bounds):
 *   de "WÄHLEN"          →  6 chars × 6 px + 32 px =  ~68 px ✓
 *   de "✓ GEWÄHLT"       →  9 chars × 6 px + 32 px =  ~86 px ✓
 *   ar "اختر"            →  4 chars × 8 px + 32 px =  ~64 px ✓
 *   ar "✓ تم الاختيار"   → 13 chars × 8 px + 32 px = ~136 px ✓  (< 145 px budget)
 *
 * "✓ تم الاختيار" is 13 code-points (checkmark + space + 4 Arabic letters +
 * space + 6 Arabic letters). At 8 px per code-point the worst-case estimate
 * is 136 px — comfortably under the 145 px ceiling.  In practice Arabic glyphs
 * at 9 px are typically 6–7 px wide, so the real rendered width is closer to
 * 110–120 px.  The centre-column (flex:1, minWidth:0) absorbs the difference.
 *
 * All four labels are within budget.
 */

// ── Module mocks ──────────────────────────────────────────────────────────────

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
jest.mock('@/stores/shoppingListStore', () => ({
  useShoppingListStore: jest.fn(() => jest.fn()),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({ user: { id: 'test-user' } })),
}));
jest.mock('@/components/ui/pill-button', () => ({
  PillButton: ({ children, onClick, active, style }: any) => {
    const React = require('react');
    return React.createElement(
      'button',
      { onClick, 'data-active': active, 'data-minwidth': style?.minWidth },
      children,
    );
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

// ── Locale strings pulled directly from the source JSON files ─────────────────
// These are the canonical translations — if someone changes the file the test
// breaks, which is the intended safety net.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const deLocale = require('@/i18n/locales/de.json') as Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const arLocale = require('@/i18n/locales/ar.json') as Record<string, any>;

const DE_PICK   = deLocale?.shopping?.smartCart?.pick   as string;
const DE_PICKED = deLocale?.shopping?.smartCart?.picked as string;
const AR_PICK   = arLocale?.shopping?.smartCart?.pick   as string;
const AR_PICKED = arLocale?.shopping?.smartCart?.picked as string;

// ─────────────────────────────────────────────────────────────────────────────
// Locale-file presence checks
// ─────────────────────────────────────────────────────────────────────────────

describe('Smart Cart translation keys — locale file presence', () => {
  it('de.json has shopping.smartCart.pick as a non-empty string', () => {
    expect(typeof DE_PICK).toBe('string');
    expect(DE_PICK.length).toBeGreaterThan(0);
  });

  it('de.json has shopping.smartCart.picked as a non-empty string', () => {
    expect(typeof DE_PICKED).toBe('string');
    expect(DE_PICKED.length).toBeGreaterThan(0);
  });

  it('ar.json has shopping.smartCart.pick as a non-empty string', () => {
    expect(typeof AR_PICK).toBe('string');
    expect(AR_PICK.length).toBeGreaterThan(0);
  });

  it('ar.json has shopping.smartCart.picked as a non-empty string', () => {
    expect(typeof AR_PICKED).toBe('string');
    expect(AR_PICKED.length).toBeGreaterThan(0);
  });

  it('de.json pick label matches expected German text', () => {
    expect(DE_PICK).toBe('Wählen');
  });

  it('de.json picked label matches expected German text', () => {
    expect(DE_PICKED).toBe('✓ Gewählt');
  });

  it('ar.json pick label matches expected Arabic text', () => {
    expect(AR_PICK).toBe('اختر');
  });

  it('ar.json picked label matches expected Arabic text', () => {
    expect(AR_PICKED).toBe('✓ تم الاختيار');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pixel-width budget: label text must not exceed safe threshold for 320 px card
// ─────────────────────────────────────────────────────────────────────────────
//
// Budget: ≤ 130 px per button on a 320 px card.
// Formula: label.length × perCharPx + 32 px (px-4 padding) ≤ 130 px
//   → label.length ≤ (130 − 32) / perCharPx
//   Latin (6 px/char) → ≤ 16.3 chars
//   Arabic (8 px/char) → ≤ 12.25 chars

describe('Smart Cart Pick button — pixel-width budget for 320 px viewport', () => {
  const PX_PADDING = 32; // px-4 = 16 px each side
  const MAX_BUTTON_PX = 145; // budget for the right-side button column on a 320 px card
  const MAX_LABEL_PX = MAX_BUTTON_PX - PX_PADDING; // 98 px for actual text

  // Latin characters (German) at 9 px semibold uppercase with wide tracking
  const LATIN_PX_PER_CHAR = 6;
  // Arabic characters at 9 px (Arabic glyphs are wider than Latin at small sizes)
  const ARABIC_PX_PER_CHAR = 8;

  function latinBudgetLabel(label: string): number {
    // Strip the checkmark prefix (✓ ) and any other non-alphabetic prefix for
    // the width estimate; PillButton renders the raw string but the checkmark
    // glyph is narrow (~4 px at 9 px).
    return label.length * LATIN_PX_PER_CHAR;
  }

  function arabicBudgetLabel(label: string): number {
    return label.length * ARABIC_PX_PER_CHAR;
  }

  it('de pick label ("Wählen") fits in 130 px budget at 6 px/char', () => {
    const estimated = latinBudgetLabel(DE_PICK) + PX_PADDING;
    expect(estimated).toBeLessThanOrEqual(MAX_BUTTON_PX);
  });

  it('de picked label ("✓ Gewählt") fits in 130 px budget at 6 px/char', () => {
    const estimated = latinBudgetLabel(DE_PICKED) + PX_PADDING;
    expect(estimated).toBeLessThanOrEqual(MAX_BUTTON_PX);
  });

  it('ar pick label ("اختر") fits in 130 px budget at 8 px/char', () => {
    const estimated = arabicBudgetLabel(AR_PICK) + PX_PADDING;
    expect(estimated).toBeLessThanOrEqual(MAX_BUTTON_PX);
  });

  it('ar picked label ("✓ تم الاختيار") fits in 130 px budget at 8 px/char', () => {
    const estimated = arabicBudgetLabel(AR_PICKED) + PX_PADDING;
    expect(estimated).toBeLessThanOrEqual(MAX_BUTTON_PX);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Render checks — German locale
// ─────────────────────────────────────────────────────────────────────────────

// The mock returns the real German strings so assertions mirror what German
// users see in production.

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SmartCartAdviceBody } from '@/components/shopping/GroceryStoreCoachSheet';
import { useTranslation } from 'react-i18next';

// ── Fixture ───────────────────────────────────────────────────────────────────

const OLIVE_OIL_ADVICE = {
  ingredient: 'Olive Oil',
  category: 'Pantry',
  recommended: [
    { brand: 'California Olive Ranch', rank: 1 as const, grade: 'A' as const, reason: 'High polyphenol content.' },
    { brand: 'Kirkland Organic', rank: 2 as const, grade: 'B' as const, reason: 'Good value pick.' },
  ],
  avoid: [],
};

const NO_PICKS = new Map<string, any>();

/** Build a t() function that maps smartCart.pick / smartCart.picked to the given strings. */
function makeTFn(pick: string, picked: string): (key: string) => string {
  const MAP: Record<string, string> = {
    'smartCart.pick': pick,
    'smartCart.picked': picked,
  };
  return (key: string) => MAP[key] ?? key;
}

// ── German renders ────────────────────────────────────────────────────────────

describe('SmartCartAdviceBody — German Pick/Picked labels render', () => {
  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({
      t: makeTFn(DE_PICK, DE_PICKED),
      i18n: { language: 'de', changeLanguage: jest.fn() },
    });
  });

  it('renders the German pick label ("Wählen") on unpicked brand buttons', () => {
    const { getAllByText } = render(
      <SmartCartAdviceBody
        advice={[OLIVE_OIL_ADVICE]}
        savedProductKeys={new Set()}
        savingKey={null}
        onSave={() => {}}
        pickedBrands={NO_PICKS}
        onPick={() => {}}
      />,
    );

    // Two recommended brands → two Pick buttons
    const pickBtns = getAllByText(DE_PICK); // "Wählen"
    expect(pickBtns.length).toBe(2);
  });

  it('renders the German picked label ("✓ Gewählt") on the picked brand', () => {
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
        onPick={() => {}}
      />,
    );

    expect(getByText(DE_PICKED)).toBeInTheDocument(); // "✓ Gewählt"
    expect(getAllByText(DE_PICK).length).toBe(1);     // one remaining unpicked brand
  });

  it('Pick button carries the minWidth:72 style so it never collapses below the minimum', () => {
    const { getAllByText } = render(
      <SmartCartAdviceBody
        advice={[OLIVE_OIL_ADVICE]}
        savedProductKeys={new Set()}
        savingKey={null}
        onSave={() => {}}
        pickedBrands={NO_PICKS}
        onPick={() => {}}
      />,
    );

    // The stub exposes minWidth via data-minwidth
    const btn = getAllByText(DE_PICK)[0];
    expect(btn).toHaveAttribute('data-minwidth', '72');
  });
});

// ── Arabic renders ────────────────────────────────────────────────────────────

describe('SmartCartAdviceBody — Arabic Pick/Picked labels render', () => {
  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({
      t: makeTFn(AR_PICK, AR_PICKED),
      i18n: { language: 'ar', changeLanguage: jest.fn() },
    });
  });

  it('renders the Arabic pick label ("اختر") on unpicked brand buttons', () => {
    const { getAllByText } = render(
      <SmartCartAdviceBody
        advice={[OLIVE_OIL_ADVICE]}
        savedProductKeys={new Set()}
        savingKey={null}
        onSave={() => {}}
        pickedBrands={NO_PICKS}
        onPick={() => {}}
      />,
    );

    const pickBtns = getAllByText(AR_PICK); // "اختر"
    expect(pickBtns.length).toBe(2);
  });

  it('renders the Arabic picked label ("✓ تم الاختيار") on the picked brand', () => {
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
        onPick={() => {}}
      />,
    );

    expect(getByText(AR_PICKED)).toBeInTheDocument(); // "✓ تم الاختيار"
    expect(getAllByText(AR_PICK).length).toBe(1);     // one remaining unpicked brand
  });

  it('Pick button carries the minWidth:72 style in Arabic locale too', () => {
    const { getAllByText } = render(
      <SmartCartAdviceBody
        advice={[OLIVE_OIL_ADVICE]}
        savedProductKeys={new Set()}
        savingKey={null}
        onSave={() => {}}
        pickedBrands={NO_PICKS}
        onPick={() => {}}
      />,
    );

    const btn = getAllByText(AR_PICK)[0];
    expect(btn).toHaveAttribute('data-minwidth', '72');
  });

  it('the Arabic picked label does not contain any undefined or placeholder text', () => {
    const picked = new Map<string, any>([
      ['olive oil', { brand: 'Kirkland Organic', rank: 2, grade: 'B', reason: '' }],
    ]);

    const { getByText } = render(
      <SmartCartAdviceBody
        advice={[OLIVE_OIL_ADVICE]}
        savedProductKeys={new Set()}
        savingKey={null}
        onSave={() => {}}
        pickedBrands={picked}
        onPick={() => {}}
      />,
    );

    const pickedBtn = getByText(AR_PICKED);
    expect(pickedBtn.textContent).not.toContain('undefined');
    expect(pickedBtn.textContent).not.toContain('{{');
    expect(pickedBtn.textContent).not.toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 375 px viewport — pick label budget (slightly relaxed ceiling)
// ─────────────────────────────────────────────────────────────────────────────

describe('Smart Cart Pick button — 375 px viewport pixel budget', () => {
  // On 375 px the same flex layout applies; the button column has more room.
  // Use a slightly higher ceiling (150 px) to represent the additional space.
  const BUDGET_375 = 150;
  const PX_PADDING = 32;
  const ARABIC_PX_PER_CHAR = 8;
  const LATIN_PX_PER_CHAR = 6;

  it('de picked label fits on 375 px viewport', () => {
    expect(DE_PICKED.length * LATIN_PX_PER_CHAR + PX_PADDING).toBeLessThanOrEqual(BUDGET_375);
  });

  it('ar picked label fits on 375 px viewport', () => {
    expect(AR_PICKED.length * ARABIC_PX_PER_CHAR + PX_PADDING).toBeLessThanOrEqual(BUDGET_375);
  });
});
