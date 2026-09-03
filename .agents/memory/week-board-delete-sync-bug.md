---
name: WeekBoard day-mode delete sync bug
description: Root cause and fix for deleted meals reappearing after navigation in GeneralNutritionBuilder day mode. VALIDATED.
---

## The rule

All board mutations in `GeneralNutritionBuilder.tsx` **must** go through `saveBoard()` (the local callback that calls `saveToHook`). Never call `putWeekBoard()` from `boardApi.ts` directly for delete/update operations.

**Why:** `saveBoard()` calls `clearDraft()` + `markClean()` after a successful save. `putWeekBoard()` bypasses both. If `markClean()` is never called, `skipServerSync()` (from `useMealBoardDraft`) permanently returns `true`, which:
1. Correctly blocks the 45-second poll from overwriting local state during the delete window.
2. But **also permanently blocks** any future hook board update (polls, remounts) from being applied.
3. On navigation away + back, the component remounts, initial hydration sets the stale `hookBoard` (which was never updated by `putWeekBoard`), and the subsequent refetch is blocked by `skipServerSync=true`. **That's the meal reappearing.**

**How to apply:** When adding any new board mutation (delete, update, reorder) in GeneralNutritionBuilder, always call `saveBoard(updatedBoard)` — not any function from `boardApi.ts` directly.

## Confirmed by instrumented traces

**Poll race condition hypothesis was DISPROVEN:** polls fired 35s+ after both PUTs completed — no timing overlap.

**`skipServerSync=true` persisted for 3+ minutes (5 consecutive polls)** when using `putWeekBoard` path — confirmed permanently stuck.

**Fix validated by trace:**
```
INITIAL hydration — hookBoard meals=4   (board loaded from DB)
SaveBoard markClean() called            (new saveBoard path fires after delete)
SyncEffect skipServerSync=false         (applying hookBoard meals=3)
```
- `markClean()` resets `skipServerSync` to false immediately after save
- `hookBoard` is updated to the post-delete board (3 meals) via `saveToHook`
- On remount, `boardRef.current` resets to null, initial hydration uses the correct `hookBoard`
- Draft is cleared via `clearDraft()`, so no stale draft can restore the deleted meal

**Draft-write warnings** (`Storage write failed even after eviction`) are a separate localStorage capacity issue — in-memory `markClean()` is what `skipServerSync` actually checks.

## Fix applied

`GeneralNutritionBuilder.tsx` day-mode delete handler (the `onUpdated(m === null)` branch for MealCard in day mode):

```diff
- putWeekBoard(weekStartISO, updatedBoard, proClientId)
-   .then(({ week }) => { if (week) setBoard(week); })
-   .catch(...)
+ saveBoard(updatedBoard).catch(...)
```
