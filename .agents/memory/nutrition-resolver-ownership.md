---
name: Nutrition Resolver Ownership — Component Rule
description: Architectural rule that shared UI components must never call nutrition resolvers; workflow pages own resolution and pass targets as props.
---

## The Rule

Shared presentation components (RemainingMacrosFooter, DailyTargetsCard, DailyStarchIndicator) NEVER call `getResolvedTargets()` or `getNutritionBaseline()` internally. They receive resolved targets as explicit props (`targetsOverride`, `strategyOverride`).

**Why:** These components are mounted inside every builder — Weekly, BeachBody, GLP-1, Diabetic, Anti-Inflammatory, General Nutrition, and Performance. If a component resolves internally it silently picks up the Performance-modified targets (from `mpm:performance:*` localStorage keys) for every user that ever visited the Performance hub, contaminating all baseline builders with performance macros.

**How to apply:**
- `DailyTargetsCard` — always pass `targetsOverride` from the page-level hook
- `RemainingMacrosFooter` — always pass `targetsOverride` (the prop is required; the component has no internal fallback)
- `DailyStarchIndicator` — always pass `strategyOverride` (defaults to `'one'` if omitted, never resolves)

## Resolver split by builder type

| Builder type | Hook to use | Resolver |
|---|---|---|
| Baseline (Weekly, GLP-1, Diabetic, Anti-Inflammatory, General, BeachBody) | `useBaselineNutrition(userId)` | `getNutritionBaseline()` |
| Performance (PerformanceCompetitionBuilder, PerformanceNutritionHub, AthleteMealPickerDrawer) | `usePerformanceNutrition(userId)` | `getResolvedTargets()` |

Both hooks live in `client/src/hooks/useBaselineNutrition.ts` and subscribe to `mpm:targetsUpdated` so they re-render reactively when targets change.

## Pattern

```tsx
// ✅ CORRECT — resolve once at the workflow page
const nutritionTargets = useBaselineNutrition(effectiveUserId);
// ... later in JSX:
<DailyTargetsCard targetsOverride={nutritionTargets} />
<RemainingMacrosFooter targetsOverride={nutritionTargets} consumedOverride={consumed} />
<DailyStarchIndicator strategyOverride={nutritionTargets.starchStrategy} />

// ❌ WRONG — resolver inside a shared component
function DailyTargetsCard({ userId }) {
  const resolved = getResolvedTargets(userId); // contaminates ALL builders
}
```
