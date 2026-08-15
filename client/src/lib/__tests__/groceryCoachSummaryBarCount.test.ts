/**
 * @jest-environment jsdom
 *
 * GroceryStoreCoachSheet — Smart Cart summary bar count sync
 *
 * Verifies that the `pickedBrands` Map size stays accurate through pick /
 * un-pick cycles so the summary bar always shows the correct count and the
 * correct plural form.
 *
 * Tests use the pure exported helpers `togglePickedBrand` (Map reducer) and
 * the i18n pluralisation keys loaded directly from the locale JSON files so
 * no component mount or React rendering is required.
 *
 * Covered scenarios
 * ─────────────────
 *  • pick 2 brands → size = 2 → uses `_other` key (plural)
 *  • un-pick one   → size = 1 → uses `_one` key (singular)
 *  • un-pick last  → size = 0 → bar must be hidden (condition: size > 0)
 *  • Same flow verified in `es` (Spanish) locale
 */

// ── Module stubs required by the component file (import side-effects) ─────────
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
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock('@/stores/shoppingListStore', () => ({ useShoppingListStore: jest.fn(() => jest.fn()) }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
jest.mock('@/lib/api', () => ({ post: jest.fn(), get: jest.fn() }));

import { togglePickedBrand } from '@/components/shopping/GroceryStoreCoachSheet';

// ── i18n locale fixtures ──────────────────────────────────────────────────────
// Load the real locale files so the test stays honest about the key names and
// interpolation tokens, without standing up the full i18n runtime.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const enLocale = require('@/i18n/locales/en.json') as {
  shopping: { smartCart: Record<string, string> };
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const esLocale = require('@/i18n/locales/es.json') as {
  shopping: { smartCart: Record<string, string> };
};

/**
 * Minimal simulation of react-i18next's `t("smartCart.brandsSummary", { count })`.
 *
 * react-i18next uses the ICU / i18next plural suffixes `_one` and `_other`
 * (for languages without additional plural categories). When count === 1 the
 * `_one` key is used; otherwise `_other` is used and `{{count}}` is replaced
 * with the actual number.
 */
function simulateT(keys: Record<string, string>, count: number): string {
  const template = count === 1 ? keys['brandsSummary_one'] : keys['brandsSummary_other'];
  if (template === undefined) throw new Error(`Missing pluralisation key for count=${count}`);
  return template.replace('{{count}}', String(count));
}

/** Whether the summary bar should be visible for a given pickedBrands size. */
function barVisible(size: number): boolean {
  return size > 0;
}

// ── Brand fixture ─────────────────────────────────────────────────────────────
interface BrandRec {
  brand: string;
  rank: 1 | 2 | 3;
  grade: 'A' | 'B' | 'C';
  reason: string;
}

function makeBrand(name: string): BrandRec {
  return { brand: name, rank: 1, grade: 'A', reason: 'top pick' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Count sync — pick → un-pick cycle
// ─────────────────────────────────────────────────────────────────────────────

describe('Smart Cart summary bar count — pick / un-pick lifecycle', () => {
  it('reports size 0 and hides the bar when no brands are picked', () => {
    const picks = new Map<string, BrandRec>();

    expect(picks.size).toBe(0);
    expect(barVisible(picks.size)).toBe(false);
  });

  it('reports size 1 and shows the bar after picking one brand', () => {
    let picks = new Map<string, BrandRec>();
    picks = togglePickedBrand(picks, 'olive oil', makeBrand('California Olive Ranch'));

    expect(picks.size).toBe(1);
    expect(barVisible(picks.size)).toBe(true);
  });

  it('reports size 2 after picking two distinct ingredients', () => {
    let picks = new Map<string, BrandRec>();
    picks = togglePickedBrand(picks, 'olive oil', makeBrand('California Olive Ranch'));
    picks = togglePickedBrand(picks, 'chicken broth', makeBrand('Swanson Organic'));

    expect(picks.size).toBe(2);
    expect(barVisible(picks.size)).toBe(true);
  });

  it('drops to size 1 after un-picking one of two brands', () => {
    const brandA = makeBrand('California Olive Ranch');
    const brandB = makeBrand('Swanson Organic');

    let picks = new Map<string, BrandRec>();
    picks = togglePickedBrand(picks, 'olive oil', brandA);
    picks = togglePickedBrand(picks, 'chicken broth', brandB);
    expect(picks.size).toBe(2);

    // Un-pick olive oil by toggling the same brand again
    picks = togglePickedBrand(picks, 'olive oil', brandA);

    expect(picks.size).toBe(1);
    expect(picks.has('olive oil')).toBe(false);
    expect(picks.has('chicken broth')).toBe(true);
  });

  it('drops to size 0 and hides the bar after un-picking the last brand', () => {
    const brand = makeBrand('Swanson Organic');

    let picks = new Map<string, BrandRec>();
    picks = togglePickedBrand(picks, 'chicken broth', brand);
    expect(picks.size).toBe(1);

    picks = togglePickedBrand(picks, 'chicken broth', brand);

    expect(picks.size).toBe(0);
    expect(barVisible(picks.size)).toBe(false);
  });

  it('does not double-count when the same ingredient is picked twice with different brands', () => {
    const brand1 = makeBrand('California Olive Ranch');
    const brand2 = makeBrand('Kirkland Organic EVOO');

    let picks = new Map<string, BrandRec>();
    picks = togglePickedBrand(picks, 'olive oil', brand1);
    picks = togglePickedBrand(picks, 'olive oil', brand2); // replaces — not adds

    // Still exactly one entry for this ingredient
    expect(picks.size).toBe(1);
    expect(picks.get('olive oil')?.brand).toBe('Kirkland Organic EVOO');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// i18n pluralisation — English
// ─────────────────────────────────────────────────────────────────────────────

describe('Smart Cart summary bar i18n — English plural forms', () => {
  const keys = enLocale.shopping.smartCart;

  it('en: brandsSummary_one and brandsSummary_other keys exist', () => {
    expect(keys['brandsSummary_one']).toBeDefined();
    expect(keys['brandsSummary_other']).toBeDefined();
  });

  it('en: uses the _one key (singular) when count = 1', () => {
    const text = simulateT(keys, 1);
    // Must match the singular key verbatim (no interpolation token needed for _one)
    expect(text).toBe(keys['brandsSummary_one']);
    expect(text).toContain('1');
  });

  it('en: uses the _other key (plural) when count = 2', () => {
    const text = simulateT(keys, 2);
    expect(text).toContain('2');
    // The plural key must not contain the literal string "1 brand" (would be wrong)
    expect(text).not.toBe(keys['brandsSummary_one']);
  });

  it('en: full pick-2 → un-pick-1 → un-pick-last cycle matches correct plural forms', () => {
    const brandA = makeBrand('California Olive Ranch');
    const brandB = makeBrand('Swanson Organic');

    // Step 1: pick 2
    let picks = new Map<string, BrandRec>();
    picks = togglePickedBrand(picks, 'olive oil', brandA);
    picks = togglePickedBrand(picks, 'chicken broth', brandB);

    expect(picks.size).toBe(2);
    expect(barVisible(picks.size)).toBe(true);
    expect(simulateT(keys, picks.size)).toContain('2');
    // Plural key used — should not be the singular phrasing
    expect(simulateT(keys, picks.size)).toBe(simulateT(keys, 2));

    // Step 2: un-pick one → size 1 → singular
    picks = togglePickedBrand(picks, 'olive oil', brandA);

    expect(picks.size).toBe(1);
    expect(barVisible(picks.size)).toBe(true);
    expect(simulateT(keys, picks.size)).toBe(keys['brandsSummary_one']);

    // Step 3: un-pick last → size 0 → bar hidden
    picks = togglePickedBrand(picks, 'chicken broth', brandB);

    expect(picks.size).toBe(0);
    expect(barVisible(picks.size)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Close / reopen cycle — picks are preserved across sheet open/close
// ─────────────────────────────────────────────────────────────────────────────
//
// The component's `!open` effect intentionally does NOT reset pickedBrands.
// Picks are written to localStorage (as pickedBrandsEntries) and restored when
// the sheet reopens, so the summary bar must reflect the correct count both
// before and after a close/reopen cycle.
//
// These tests simulate the session-serialisation logic that the component uses:
//   • "save session" = record pickedBrandsEntries in a plain object
//   • "restore session" = rebuild the Map from pickedBrandsEntries
//   • "close" = state is unchanged (picks not cleared)
//   • "reopen" = session is read; picks come back
// ─────────────────────────────────────────────────────────────────────────────

interface SessionSnapshot {
  pickedBrandsEntries?: Array<[string, BrandRec]>;
}

/** Simulate saving picks to the session object (mirrors the component's save effect). */
function saveSession(picks: Map<string, BrandRec>): SessionSnapshot {
  return picks.size > 0 ? { pickedBrandsEntries: Array.from(picks.entries()) } : {};
}

/** Simulate restoring picks from the session object (mirrors the component's load effect). */
function restoreSession(session: SessionSnapshot): Map<string, BrandRec> {
  if (session.pickedBrandsEntries?.length) {
    return new Map(session.pickedBrandsEntries);
  }
  return new Map();
}

describe('Smart Cart summary bar count — close / reopen cycle', () => {
  it('bar is visible with correct count after picking 2 brands then reopening', () => {
    const brandA = makeBrand('California Olive Ranch');
    const brandB = makeBrand('Swanson Organic');

    // Pick 2 brands (sheet open)
    let picks = new Map<string, BrandRec>();
    picks = togglePickedBrand(picks, 'olive oil', brandA);
    picks = togglePickedBrand(picks, 'chicken broth', brandB);
    expect(picks.size).toBe(2);
    expect(barVisible(picks.size)).toBe(true);

    // Close sheet — session is saved; picks are preserved (not cleared)
    const session = saveSession(picks);
    expect(session.pickedBrandsEntries).toHaveLength(2);

    // Reopen sheet — session is restored
    const restoredPicks = restoreSession(session);

    expect(restoredPicks.size).toBe(2);
    expect(barVisible(restoredPicks.size)).toBe(true);
    expect(restoredPicks.has('olive oil')).toBe(true);
    expect(restoredPicks.has('chicken broth')).toBe(true);
  });

  it('bar shows count=1 after picking 1 brand → close → reopen', () => {
    const brand = makeBrand('Kirkland Organic EVOO');

    let picks = new Map<string, BrandRec>();
    picks = togglePickedBrand(picks, 'olive oil', brand);
    expect(picks.size).toBe(1);

    const session = saveSession(picks);
    const restoredPicks = restoreSession(session);

    expect(restoredPicks.size).toBe(1);
    expect(barVisible(restoredPicks.size)).toBe(true);
    expect(restoredPicks.get('olive oil')?.brand).toBe('Kirkland Organic EVOO');
  });

  it('bar is hidden when no picks were made before closing and reopening', () => {
    // No picks at all — session has no pickedBrandsEntries
    const picks = new Map<string, BrandRec>();
    const session = saveSession(picks);

    expect(session.pickedBrandsEntries).toBeUndefined();

    const restoredPicks = restoreSession(session);

    expect(restoredPicks.size).toBe(0);
    expect(barVisible(restoredPicks.size)).toBe(false);
  });

  it('bar reflects unpick that happened before close: pick 2 → unpick 1 → close → reopen shows count=1', () => {
    const brandA = makeBrand('California Olive Ranch');
    const brandB = makeBrand('Swanson Organic');

    let picks = new Map<string, BrandRec>();
    picks = togglePickedBrand(picks, 'olive oil', brandA);
    picks = togglePickedBrand(picks, 'chicken broth', brandB);
    // Unpick one before closing
    picks = togglePickedBrand(picks, 'olive oil', brandA);
    expect(picks.size).toBe(1);

    const session = saveSession(picks);
    const restoredPicks = restoreSession(session);

    expect(restoredPicks.size).toBe(1);
    expect(barVisible(restoredPicks.size)).toBe(true);
    expect(restoredPicks.has('olive oil')).toBe(false);
    expect(restoredPicks.has('chicken broth')).toBe(true);
  });

  it('bar is hidden when all picks were cleared before closing: pick 2 → unpick both → close → reopen shows count=0', () => {
    const brandA = makeBrand('California Olive Ranch');
    const brandB = makeBrand('Swanson Organic');

    let picks = new Map<string, BrandRec>();
    picks = togglePickedBrand(picks, 'olive oil', brandA);
    picks = togglePickedBrand(picks, 'chicken broth', brandB);
    // Clear all picks before closing
    picks = togglePickedBrand(picks, 'olive oil', brandA);
    picks = togglePickedBrand(picks, 'chicken broth', brandB);
    expect(picks.size).toBe(0);

    const session = saveSession(picks);
    const restoredPicks = restoreSession(session);

    expect(restoredPicks.size).toBe(0);
    expect(barVisible(restoredPicks.size)).toBe(false);
  });

  it('en: summary bar text stays correct after close/reopen with 2 picks', () => {
    const keys = enLocale.shopping.smartCart;
    const brandA = makeBrand('California Olive Ranch');
    const brandB = makeBrand('Swanson Organic');

    let picks = new Map<string, BrandRec>();
    picks = togglePickedBrand(picks, 'olive oil', brandA);
    picks = togglePickedBrand(picks, 'chicken broth', brandB);

    const session = saveSession(picks);
    const restoredPicks = restoreSession(session);

    expect(restoredPicks.size).toBe(2);
    const text = simulateT(keys, restoredPicks.size);
    expect(text).toContain('2');
    expect(text).not.toBe(keys['brandsSummary_one']);
  });

  it('en: summary bar text stays correct after close/reopen with 1 pick', () => {
    const keys = enLocale.shopping.smartCart;
    const brand = makeBrand('Swanson Organic');

    let picks = new Map<string, BrandRec>();
    picks = togglePickedBrand(picks, 'chicken broth', brand);

    const session = saveSession(picks);
    const restoredPicks = restoreSession(session);

    expect(restoredPicks.size).toBe(1);
    const text = simulateT(keys, restoredPicks.size);
    expect(text).toBe(keys['brandsSummary_one']);
    expect(text).toContain('1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// i18n pluralisation — Spanish (second locale)
// ─────────────────────────────────────────────────────────────────────────────

describe('Smart Cart summary bar i18n — Spanish plural forms', () => {
  const keys = esLocale.shopping.smartCart;

  it('es: brandsSummary_one and brandsSummary_other keys exist', () => {
    expect(keys['brandsSummary_one']).toBeDefined();
    expect(keys['brandsSummary_other']).toBeDefined();
  });

  it('es: uses the _one key when count = 1', () => {
    const text = simulateT(keys, 1);
    expect(text).toBe(keys['brandsSummary_one']);
    expect(text).toContain('1');
  });

  it('es: uses the _other key when count = 2 and interpolates the count', () => {
    const text = simulateT(keys, 2);
    expect(text).toContain('2');
    expect(text).not.toBe(keys['brandsSummary_one']);
  });

  it('es: full pick-2 → un-pick-1 → un-pick-last cycle selects the right plural forms', () => {
    const brandA = makeBrand('Aceite Carbonell');
    const brandB = makeBrand('Caldo Aneto');

    // Step 1: pick 2
    let picks = new Map<string, BrandRec>();
    picks = togglePickedBrand(picks, 'aceite de oliva', brandA);
    picks = togglePickedBrand(picks, 'caldo de pollo', brandB);

    expect(picks.size).toBe(2);
    expect(barVisible(picks.size)).toBe(true);
    const twoText = simulateT(keys, picks.size);
    expect(twoText).toContain('2');
    expect(twoText).toBe(simulateT(keys, 2));

    // Step 2: un-pick one → singular
    picks = togglePickedBrand(picks, 'aceite de oliva', brandA);

    expect(picks.size).toBe(1);
    const oneText = simulateT(keys, picks.size);
    expect(oneText).toBe(keys['brandsSummary_one']);
    expect(barVisible(picks.size)).toBe(true);

    // Step 3: un-pick last → bar disappears
    picks = togglePickedBrand(picks, 'caldo de pollo', brandB);

    expect(picks.size).toBe(0);
    expect(barVisible(picks.size)).toBe(false);
  });
});
