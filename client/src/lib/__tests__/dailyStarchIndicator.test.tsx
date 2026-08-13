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

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Read the compact pill label.
 * Compact mode renders `<span>{emoji}</span><span>{label}</span>` inside a
 * `gap-1` div — the gap is visual (CSS), not a text node, so textContent
 * concatenates without a space.  We read each child span individually and
 * join them so the assertion strings stay human-readable.
 */
function getCompactText(): string {
  const container = document.querySelector('.gap-1');
  if (!container) return '';
  const spans = Array.from(container.querySelectorAll('span'));
  return spans
    .map((s) => (s.textContent ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DailyStarchIndicator — compact variant prescription prop reactivity', () => {
  it('updates the compact label when starchMealsAllowed increases', () => {
    const { rerender } = render(
      <DailyStarchIndicator
        meals={[FIBER_MEAL]}
        compact
        prescription={makePrescription(1)}
      />,
    );

    // 1 slot, no starch meals consumed → "Available" (single-slot label).
    expect(getCompactText()).toBe('🟢 Available');

    // Prescription is refreshed mid-session, granting 2 starch slots.
    rerender(
      <DailyStarchIndicator
        meals={[FIBER_MEAL]}
        compact
        prescription={makePrescription(2)}
      />,
    );

    // The compact pill must reflect the updated allowance without a page reload.
    expect(getCompactText()).toBe('🟢 2 Available');
  });
});

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

  it('shows the Rest Day — Zero Starch panel when isZeroStarchDay flips to true', () => {
    const { rerender, queryByText } = render(
      <DailyStarchIndicator
        meals={[FIBER_MEAL]}
        prescription={makePrescription(1, { isZeroStarchDay: false })}
      />,
    );

    // Panel must be absent when isZeroStarchDay is false.
    expect(queryByText(/Rest Day — Zero Starch/)).toBeNull();

    // Prescription flips to a zero-starch day (e.g. rest day applied mid-session).
    rerender(
      <DailyStarchIndicator
        meals={[FIBER_MEAL]}
        prescription={makePrescription(0, { isZeroStarchDay: true })}
      />,
    );

    // The special callout panel must now be visible.
    expect(queryByText(/Rest Day — Zero Starch/)).not.toBeNull();
  });

  it('hides the Rest Day — Zero Starch panel when isZeroStarchDay flips back to false', () => {
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
});
