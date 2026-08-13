/**
 * @jest-environment jsdom
 *
 * DailyStarchIndicator — prescription prop reactivity
 *
 * Verifies that when the prescription prop changes mid-session (e.g. after a
 * profile edit or prescription refresh), the displayed slot count re-renders
 * with the new starchMealsAllowed value rather than retaining the stale count.
 */

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DailyStarchIndicator } from '@/components/DailyStarchIndicator';
import type { DailyNutritionPrescription } from '../../../../shared/dailyNutritionPrescription';

// ── Minimal prescription factory ──────────────────────────────────────────────

function makePrescription(
  starchMealsAllowed: number,
  overrides: Partial<DailyNutritionPrescription> = {},
): DailyNutritionPrescription {
  return {
    calories: 2000,
    protein: 150,
    carbs: 200,
    fat: 70,
    starchMealsAllowed,
    starchMealsRemaining: starchMealsAllowed,
    isZeroStarchDay: false,
    source: 'user_default',
    rationaleCodes: [],
    ...overrides,
  } as unknown as DailyNutritionPrescription;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** A plain meal with no starchy ingredients — never consumes a starch slot. */
const FIBER_MEAL = {
  name: 'Grilled Chicken Salad',
  ingredients: ['grilled chicken', 'spinach', 'cucumber', 'tomato'],
};

/** A meal whose ingredients include a starchy carb — consumes one slot. */
const STARCH_MEAL = {
  name: 'Rice Bowl',
  ingredients: ['white rice', 'grilled chicken', 'broccoli'],
};

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Read the normalized text content of the status label span.
 * The component renders `{emoji} {status.label}` inside a single span with
 * class `font-semibold`, so we collapse whitespace and trim to get a
 * stable string like "🟢 Available" or "🟢 2 Available".
 */
function getStatusText(): string {
  const span = document.querySelector('.font-semibold');
  return (span?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DailyStarchIndicator — compact variant gram-guidance hint reactivity', () => {
  it('shows the gram-guidance hint when gramsPerRemainingStarchMeal is present', () => {
    const { getByText } = render(
      <DailyStarchIndicator
        meals={[FIBER_MEAL]}
        compact
        prescription={makePrescription(2, {
          starchMealsRemaining: 2,
          gramsPerRemainingStarchMeal: 45,
        })}
      />,
    );

    expect(getByText('~45g ea')).toBeInTheDocument();
  });

  it('updates the gram-guidance hint when gramsPerRemainingStarchMeal changes', () => {
    const { rerender, getByText } = render(
      <DailyStarchIndicator
        meals={[FIBER_MEAL]}
        compact
        prescription={makePrescription(2, {
          starchMealsRemaining: 2,
          gramsPerRemainingStarchMeal: 45,
        })}
      />,
    );

    // Initial gram guidance is visible.
    expect(getByText('~45g ea')).toBeInTheDocument();

    // Prescription refreshes mid-session with a new gram target.
    rerender(
      <DailyStarchIndicator
        meals={[FIBER_MEAL]}
        compact
        prescription={makePrescription(2, {
          starchMealsRemaining: 2,
          gramsPerRemainingStarchMeal: 60,
        })}
      />,
    );

    // The hint must update to the new value without a page reload.
    expect(getByText('~60g ea')).toBeInTheDocument();
  });

  it('hides the gram-guidance hint when starchMealsRemaining drops to 0', () => {
    const { rerender, getByText, queryByText } = render(
      <DailyStarchIndicator
        meals={[FIBER_MEAL]}
        compact
        prescription={makePrescription(1, {
          starchMealsRemaining: 1,
          gramsPerRemainingStarchMeal: 50,
        })}
      />,
    );

    // Hint is visible while meals remain.
    expect(getByText('~50g ea')).toBeInTheDocument();

    // A starch meal is logged — remaining drops to 0.
    rerender(
      <DailyStarchIndicator
        meals={[STARCH_MEAL]}
        compact
        prescription={makePrescription(1, {
          starchMealsRemaining: 0,
          gramsPerRemainingStarchMeal: 50,
        })}
      />,
    );

    // showGramGuidance becomes false → hint must disappear.
    expect(queryByText(/~\d+g ea/)).toBeNull();
  });
});

describe('DailyStarchIndicator — compact variant prescription prop reactivity', () => {
  it('updates the compact label when starchMealsAllowed increases', () => {
    const { rerender } = render(
      <DailyStarchIndicator
        meals={[STARCH_MEAL]}
        prescription={makePrescription(2)}
      />,
    );

    expect(getStatusText()).toBe('🟢 2 Available');

    rerender(
      <DailyStarchIndicator
        meals={[FIBER_MEAL]}
        prescription={makePrescription(1)}
      />,
    );

    expect(getStatusText()).toBe('🟢 Available');
  });

  it('reflects the new slot count when a starch meal has already been consumed', () => {
    // 2 slots, 1 starch meal consumed → 1 remaining.
    const { rerender } = render(
      <DailyStarchIndicator
        meals={[STARCH_MEAL]}
        prescription={makePrescription(2)}
      />,
    );

    expect(getStatusText()).toBe('🟢 2 Available');

    rerender(
      <DailyStarchIndicator
        meals={[FIBER_MEAL]}
        prescription={makePrescription(1)}
      />,
    );

    expect(getStatusText()).toBe('🟢 Available');
  });

  it('reflects the new slot count when a starch meal has already been consumed', () => {
    // 2 slots, 1 starch meal consumed → 1 remaining.
    const { rerender } = render(
      <DailyStarchIndicator
        meals={[STARCH_MEAL]}
        prescription={makePrescription(2)}
      />,
    );

    expect(getStatusText()).toBe('🟢 2 Available');

    rerender(
      <DailyStarchIndicator
        meals={[FIBER_MEAL]}
        prescription={makePrescription(1)}
      />,
    );

    expect(getStatusText()).toBe('🟢 Available');
  });

  it('reflects the new slot count when a starch meal has already been consumed', () => {
    // 2 slots, 1 starch meal consumed → 1 remaining.
    const { rerender } = render(
      <DailyStarchIndicator
        meals={[STARCH_MEAL]}
        prescription={makePrescription(2)}
      />,
    );

    expect(getStatusText()).toBe('🟢 1 Remaining');

    // Prescription tightens to 1 slot; that 1 slot is now consumed → "Used".
    rerender(
      <DailyStarchIndicator
        meals={[STARCH_MEAL]}
        prescription={makePrescription(1)}
      />,
    );

    expect(getStatusText()).toBe('🟠 Used');
  });

  it('shows the Rest Day — Zero Starch panel when isZeroStarchDay flips to true', () => {
    const { rerender, queryByText } = render(
      <DailyStarchIndicator
        meals={[FIBER_MEAL]}
        prescription={makePrescription(0, { isZeroStarchDay: true })}
      />,
    );

    // Panel must be present at the start.
    expect(queryByText(/Rest Day — Zero Starch/)).not.toBeNull();

    // Prescription reverts (e.g. user switches back to a training day).
    rerender(
      <DailyStarchIndicator
        meals={[FIBER_MEAL]}
        prescription={makePrescription(1, { isZeroStarchDay: false })}
      />,
    );

    // The special callout panel must no longer be visible.
    expect(queryByText(/Rest Day — Zero Starch/)).toBeNull();
  });

  it('compact mode skips the Rest Day panel and shows the normal pill on a zero-starch day', () => {
    const { queryByText, container } = render(
      <DailyStarchIndicator
        meals={[FIBER_MEAL]}
        compact={true}
        prescription={makePrescription(0, { isZeroStarchDay: true })}
      />,
    );

    // Compact mode must NOT render the full Rest Day callout panel.
    expect(queryByText(/Rest Day — Zero Starch/)).toBeNull();

    // The normal compact pill should still be present.
    const pill = container.querySelector('.text-xs');
    expect(pill).not.toBeNull();
  });
});
