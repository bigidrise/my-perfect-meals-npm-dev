# Daily Target Authority Contract

## Rule

Any component that displays, compares against, or calculates remaining values for "Today's Macro Targets" **must resolve those targets through `getResolvedTargets()`**.

Components must not independently calculate or cache daily macro targets using `getNutritionBaseline()`.

---

## Why this matters

`getNutritionBaseline()` intentionally skips the Performance Protocol tier (see `macroResolver.ts` lines 341–353). It is correct for meal *generation* (where the generator itself enforces performance targets through the prompt/guardrail stack), but it returns the wrong values for *display* — particularly for performance athletes whose targets vary by training day type (Endurance / Power / Rest).

`getResolvedTargets()` is the full 4-layer resolver that includes:

1. ProCare targets (coach-set, highest priority)
2. Performance Protocol day-type targets (Rest / Endurance / Power)
3. Baseline macro calculator targets
4. Fallback defaults

---

## The two resolver functions

| Function | Use for | Skips |
|---|---|---|
| `getResolvedTargets(userId?)` | Any "Today's Targets" display, budget math, remaining calculations | Nothing — full stack |
| `getNutritionBaseline(userId?)` | Meal generation context, source/label checks only | Performance Protocol tier |

Both live in `client/src/lib/macroResolver.ts`.

---

## Day-type synchronization

When a screen lets the user switch days (e.g., a meal board showing Mon/Tue/Wed), the resolver must be told which day is active before `getResolvedTargets()` is called:

```ts
import { setPerfSelectedDate, getResolvedTargets } from "@/lib/macroResolver";

useEffect(() => {
  if (activeDayISO) setPerfSelectedDate(activeDayISO);
}, [activeDayISO]);
```

`setPerfSelectedDate()` writes the selected date to `localStorage` and clears the resolver cache so the next call to `getResolvedTargets()` returns day-type-correct targets.

Without this call, the resolver reads a stale date and returns the wrong day-type targets even after the user switches days.

---

## Confirmed consumers (as of July 2026)

| Component | Status |
|---|---|
| `useNutritionBudget.ts` — Budget Banner / remaining math | ✅ Uses `getResolvedTargets` |
| `BeachBodyMealBoard.tsx` — Budget Banner within board | ✅ Calls `setPerfSelectedDate(activeDayISO)` on day change |
| `my-biometrics.tsx` — Biometrics macro target display | ✅ Uses `getResolvedTargets` |
| `QuickAddMacrosModal.tsx` — Quick Add reference targets | ✅ Uses `getResolvedTargets` |
| `TrainingNutritionHub.tsx` — Training Nutrition Hub display | ✅ Uses `getResolvedTargets` + `setPerfSelectedDate` |
| `pro/PerformanceCompetitionBuilder.tsx` — Competition builder | ✅ Uses `setPerfSelectedDate` on day change |

---

## Out-of-scope systems (deliberate)

| System | Why it doesn't use the resolver |
|---|---|
| Push notifications / SMS / email | Send behavioral prompts, not live macro numbers |
| Pattern alerts (`patternAlerts.ts`) | Backward-looking streak detector using stored `dailyProteinTarget` DB column; single-value baseline is correct for multi-day averaging |
| Coach dashboards (ProCare / Studio / Physician) | Authoring tools — they *set* targets, not consume them for display |
| Meal generation prompts | Generator enforces performance targets through guardrails, not display resolver |
| Copilot scripts | Descriptive action labels only, no live target values |

---

## Adding a new "Today's Targets" surface

If you add any new component that shows or calculates against daily macro targets:

1. Import `getResolvedTargets` (not `getNutritionBaseline`) from `@/lib/macroResolver`
2. If the component is day-switchable, add the `setPerfSelectedDate(activeDayISO)` effect
3. Add the component to the "Confirmed consumers" table above
