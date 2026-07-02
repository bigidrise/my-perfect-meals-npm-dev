# Protected Components Registry

This document is the authoritative list of protected files in MyPerfectMeals.
Every agent or developer editing these files must follow the rules below.

---

## Engineering Policy — Permanent Rules

### Rule 1 — Read Before Modify (Mandatory)

Before modifying **any** file in this repository:
- Read the current HEAD version of the file.
- Never reconstruct a file from memory, an older snapshot, or a previous conversation.
- Work only from the current on-disk version.
- If the file changes during development, re-read it before committing.

### Rule 2 — Protected Files: Surgical Edits Only

Protected files contain core application logic. They may receive **only surgical edits**.

**Do not:**
- Rewrite the file
- Refactor unrelated code
- Reorder sections
- Rename existing logic
- Remove existing UI or behavior
- Perform formatting-only rewrites

**Only modify the lines necessary to satisfy the requested task.**

### Rule 3 — Regression Checklist (Mandatory)

Any commit touching a protected file must include a regression report in the commit message or PR description:

```
Modified:
✓ [describe the specific change]

Verified still present:
✓ [behavior 1]
✓ [behavior 2]
...

Removed:
None  ← or list explicitly approved removals
```

If any previously existing behavior disappears, **stop and report it** instead of committing.

### Rule 4 — Acceptance Verification

Before committing a protected file, verify all critical user-visible behaviors listed in the per-file checklist below. If any verification fails, do not commit.

### Rule 5 — Preserve Existing Behavior

Unless explicitly instructed otherwise:
- Existing functionality is considered intentional.
- Never remove or replace existing behavior while implementing a different feature.
- Any removal requires explicit approval.

### Rule 6 — Single Source of Truth Protection

Files designated as a Single Source of Truth must never have their logic duplicated elsewhere.
Consumers **read** from them. Consumers do **not** recreate calculations.

### Rule 7 — Scope Protection

Only modify files directly required for the requested task.
Do not opportunistically "clean up," refactor, or modernize unrelated code.

### Rule 8 — Commit Summary

Every completed task must end with:
- Files modified
- Files intentionally untouched
- Existing behaviors verified
- New behaviors added
- Known limitations (if any)

---

## Protected Files

### `client/src/lib/macroResolver.ts`

**Why protected:** Single source of truth for all macro targets across the app. MacroCalculator,
PerformanceNutritionHub, BeachBodyMealBoard, and every meal builder consume this. Any change
here propagates everywhere. Logic must not be duplicated in consumers.

**Acceptance checklist:**
- [ ] `getResolvedTargets()` returns correct calories/protein_g/carbs_g/fat_g for all source types (pro, performance, self, none)
- [ ] `getPerformanceProtocolTargets()` returns performance protocol targets
- [ ] `resolveDisplayCarbTargets()` applies fibrous floor correctly (min 25g)
- [ ] `splitStarchyFibrous()` floor pattern preserved
- [ ] Pro override takes priority over self targets
- [ ] Performance targets take priority over self targets when active
- [ ] Cache invalidates on `clearResolvedTargetsCache()`

---

### `client/src/pages/PerformanceNutritionHub.tsx`

**Why protected:** Primary performance nutrition UI. Contains multiple independent feature
sections (competition track, athletic track, carb cycle tab, protocols tab, pro view). Task
agents have repeatedly caused regressions by touching one section while unknowingly reverting
another section that was edited in a separate session.

**Acceptance checklist:**
- [ ] "Carbohydrates" tab label (not "Starch")
- [ ] Today's Target row — sourced from `getResolvedTargets()` (MacroCalculator), not from `todaySession`
- [ ] Today's Logged row — sourced from `useTodayMacros()`, updates via `macros:updated` event
- [ ] Today's Training card — sourced from `todaySession` (training-session-specific targets)
- [ ] Competition track section renders correctly
- [ ] Athletic track section renders correctly
- [ ] "Launch Performance Nutrition Builder" button present in both track sections
- [ ] Pro View toggle present and gated to procare/care_team/isAdmin
- [ ] No "Send to Coach" button anywhere in the file
- [ ] Setup button navigates to `/performance/setup` (not modal)
- [ ] Clinical paywall gate renders for users without `performance_nutrition` entitlement

---

### `client/src/pages/BeachBodyMealBoard.tsx`

**Why protected:** Performance meal builder — connects `performanceSessionContext` to the
meal generation pipeline. Fetches `/api/performance/today` to build training-session context.
Changes here affect what AI context is injected into every performance meal generation call.

**Acceptance checklist:**
- [ ] Fetches `/api/performance/today` on mount
- [ ] Builds `performanceSessionContext` memo (sessionType, sessionLabel, reasoning, starchyCarbs_g, fibrousCarbs_g)
- [ ] Passes `performanceSessionContext` to `CreateWithChefModal`
- [ ] Weekly board display intact
- [ ] Meal cards render with correct macro data

---

### `client/src/pages/MacroCalculator.tsx`

**Why protected:** User-facing macro target setter. Changes here affect `macroResolver.ts`
output for all users who set their own targets (source = 'self').

**Acceptance checklist:**
- [ ] Starchy/fibrous carb split uses `splitStarchyFibrous()` floor pattern (min 25g fibrous)
- [ ] Saves to `dailyLimits` via `saveSelfTargets()`
- [ ] `clearResolvedTargetsCache()` called after save
- [ ] Display matches what hub and meal builder show

---

### `server/services/protocolEnvelope.ts`

**Why protected:** All AI generation flows run through this. It enforces the 4-layer constraint
hierarchy: (1) Medical, (2) Dietary Identity, (3) Cultural/Cuisine, (4) Behavioral. Changes
here affect every single meal generation call in the app.

**Acceptance checklist:**
- [ ] 4-layer hierarchy enforced in correct order
- [ ] Medical constraints (allergies, oncology, clinical protocols) are never overridden by lower layers
- [ ] `performanceSessionContext` injected after guardrails (not before)
- [ ] `UserProtocolEnvelope` type remains consistent with consumers

---

### `server/services/unifiedMealPipeline.ts`

**Why protected:** Central meal generation dispatcher. All builder types (Create a Dish,
Chef's Kitchen, Performance Builder, Fridge Rescue, etc.) flow through this. Changes here
can silently break any builder.

**Acceptance checklist:**
- [ ] `performanceSessionContext` threaded from `GenerationOptions` → `generateFromDescriptionUnified`
- [ ] Performance coaching context block injected into AI prompt for performance sessions
- [ ] General builders (non-performance) are unaffected by performance context
- [ ] `generateMealUnified` dispatches correctly by builder type

---

### `server/routes/performanceNutrition.ts`

**Why protected:** Defines the performance protocol API endpoints consumed by the hub and
meal builder. Field naming here must stay consistent with frontend expectations.

**API contract (do not break):**
- `GET /api/performance/today` → `{ configured, sessionType, sessionLabel, calories, proteinG, carbsG, fatG, description }`
- `GET /api/performance/carb-cycle` → carb cycle state and engine data
- `POST /api/performance/carb-cycle/override` → override carb target for today

---

## Single Sources of Truth

| Source of Truth | File | Consumers |
|---|---|---|
| User macro targets | `client/src/lib/macroResolver.ts` → `getResolvedTargets()` | MacroCalculator, PerformanceNutritionHub, BeachBodyMealBoard, meal builders |
| Carb split floor logic | `macroResolver.ts` → `splitStarchyFibrous()` | All starchy/fibrous carb displays |
| AI constraint hierarchy | `server/services/protocolEnvelope.ts` | All meal generation endpoints |
| Performance session targets | `server/routes/performanceNutrition.ts` `/today` | BeachBodyMealBoard, PerformanceNutritionHub Today's Training card |

---

## How to Add a New Protected File

1. Add an entry to this document with: why it's protected, and its acceptance checklist.
2. Update the Single Sources of Truth table if applicable.
3. Note any consumers that depend on its public interface.
