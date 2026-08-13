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

describe('DailyStarchIndicator — prescription prop reactivity', () => {
  it('updates the displayed slot count when starchMealsAllowed increases', () => {
    const { rerender } = render(
      <DailyStarchIndicator
        meals={[FIBER_MEAL]}
        prescription={makePrescription(1)}
      />,
    );

    // 1 slot, nothing consumed → single "Available" label.
    expect(getStatusText()).toBe('🟢 Available');

    // Prescription refresh grants 2 starch slots.
    rerender(
      <DailyStarchIndicator
        meals={[FIBER_MEAL]}
        prescription={makePrescription(2)}
      />,
    );

    // The component must re-render with the new slot count.
    expect(getStatusText()).toBe('🟢 2 Available');
  });

  it('updates the displayed slot count when starchMealsAllowed decreases', () => {
    const { rerender } = render(
      <DailyStarchIndicator
        meals={[FIBER_MEAL]}
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
});
