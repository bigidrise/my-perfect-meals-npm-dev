---
name: Performance Protocol — baseline ownership rule
description: Architecture rule governing what the Performance Protocol owns vs. what MacroCalculator owns. Critical for any future work on macroResolver or BeachBodyMealBoard.
---

## Rule

**Macro Calculator is the permanent baseline. Performance Protocol owns only adjustments.**

## Layer breakdown

- **Layer 1 — Macro Calculator** (`mpm.macroTargets.${userId}`): owns calories, protein, carbs, fat, starchyCarbs split, starchStrategy. Nothing else permanently owns these.
- **Layer 2 — Performance Protocol** (`mpm.perfProtocol.${userId}`): owns `schedule` (weekly workout types) + `sessionModifiers` (±carbs/±protein/±calories per workout type). Does NOT store baseline macros.
- **Layer 3 — Daily resolution**: `getPerformanceProtocolTargets()` = `getSelfTargets()` (MacroCalculator) + today's session modifier. Computed live every time. Nothing is stored.

## What this means in code

`getPerformanceProtocolTargets()` in `client/src/lib/macroResolver.ts`:
- Reads `mpm.perfProtocol` only for `schedule` and `config.sessionModifiers`
- The old `baselineCalories/baselineProteinG/baselineCarbsG/baselineFatG` fields in that key are DEPRECATED and ignored
- Always calls `getSelfTargets(userId)` for the baseline — never the stored snapshot

**Why:** Before this fix, the protocol stored a one-time baseline snapshot when it was first configured. When the user updated MacroCalculator, the snapshot stayed stale. `getResolvedTargets()` returned the stale snapshot (priority 1.5) and silently ignored the current MacroCalculator values (priority 2).

**How to apply:** Any code that writes to `mpm.perfProtocol` should only write `schedule` + `config.sessionModifiers`. Do not write `baselineCalories` or similar baseline fields. If found in old localStorage keys, they are harmless but ignored.

## BeachBodyMealBoard — timezone rule

`activeDayISO` (which day is "today" in the board) must use the **device's local timezone**, not hardcoded `"America/Chicago"`. The week date structure (`weekDatesList`) remains Chicago-aligned per CHICAGO CALENDAR FIX v1.0. Only the "which day is today" determination uses `Intl.DateTimeFormat().resolvedOptions().timeZone`.

**Why:** Hardcoding Chicago caused ET users to load yesterday's meals (Chicago's "today") instead of their actual local today, producing false "Both Used" starch indicators on an apparently empty board.
