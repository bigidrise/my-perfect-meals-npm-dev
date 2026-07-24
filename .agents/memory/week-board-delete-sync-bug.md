---
name: WeekBoard day-mode delete sync bug
description: Root cause and fix for deleted meals reappearing after navigation in GeneralNutritionBuilder day mode.
---

## The rule

All board mutations in `GeneralNutritionBuilder.tsx` **must** go through `saveBoard()` (the local callback that calls `saveToHook`). Never call `putWeekBoard()` from `boardApi.ts` directly for delete/update operations.

**Why:** `saveBoard()` calls `clearDraft()` + `markClean()` after a successful save. `putWeekBoard()` bypasses both. If `markClean()` is never called, `skipServerSync()` (from `useMealBoardDraft`) permanently returns `true`, which:
1. Correctly blocks the 45-second poll from overwriting local state during the delete window.
2. But **also permanently blocks** any future hook board update (polls, remounts) from being applied.
3. On navigation away + back, the component remounts, initial hydration sets the stale `hookBoard` (which was never updated by `putWeekBoard`), and the subsequent refetch is blocked by `skipServerSync=true`. **That's the meal reappearing.**

**How to apply:** When adding any new board mutation (delete, update, reorder) in GeneralNutritionBuilder, always call `saveBoard(updatedBoard)` — not any function from `boardApi.ts` directly.

## Confirmed by timestamped trace

- Race condition hypothesis (poll overwriting mid-save) was **disproven**: polls fired 35s+ after both PUTs completed.
- `skipServerSync=true` persisted across 5 consecutive polls (3+ minutes) — confirmed permanently stuck.
- Draft-write warnings (`Storage write failed even after eviction`) from localStorage capacity are a secondary issue; in-memory `markClean()` is what `skipServerSync` actually checks.

## Fix applied

`GeneralNutritionBuilder.tsx` day-mode delete handler (the `onUpdated(m === null)` branch for MealCard in day mode):

```diff
- putWeekBoard(weekStartISO, updatedBoard, proClientId)
-   .then(({ week }) => { if (week) setBoard(week); })
-   .catch(...)
+ saveBoard(updatedBoard).catch(...)
```
