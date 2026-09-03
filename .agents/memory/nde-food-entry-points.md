---
name: Nutrition Decision Engine — Food Entry Point Rule
description: Architecture rule and implementation pattern for the NDE — every food entry point must consult the engine before presenting to user.
---

## The Rule

> Every way food enters or leaves My Perfect Meals must ask the Nutrition Decision Engine before presenting it to the user.

This includes: AI generators, search systems (restaurant, fast food), scanners (barcode, recipe, label), imports (saved meals, favorites, weekly board), and manual entry.

**Why:** The original framing was "builders should know today's training day." The correct framing is "the platform has a shared nutrition brain." A user should never have to think about which builder they're in — the system always knows what today requires.

## Implementation Pattern

### Pre-generation (AI builders)
`enforceBeforeGenerate()` in `server/services/protocolEnvelope.ts` — Tier 5c injects daily nutrition state into every AI system prompt. All 15+ AI surfaces go through `unifiedMealPipeline.ts` which calls this.

### Post-generation validator (all AI builders)
`scanGeneratedOutput()` in `server/services/protocolEnvelope.ts` — returns `ProtocolScanResult` with `starchBudgetViolation` soft flag. Fires when `envelope.dailyNutritionState.starchyBudgetExhausted === true` AND meal text contains `STARCH_BUDGET_TERMS`. v1 = log + flag. v2 = hard block → regeneration loop.

### Scanner entry points
Response field pattern: `ndeSummary` added to API response for each scanner:
- **Barcode** (`/api/barcode/:code`): optional auth (x-auth-token or session.userId), non-blocking NDE check, returns `ndeSummary.conflicts + conflictNote + suggestions[]`
- **Recipe scanner** (`/api/inspiration/capture`): loads `UserProtocolEnvelope` after generation, returns `ndeSummary.wasAdapted + adaptedNote`. Client (`InspirationCaptureModal.tsx`) shows orange Sparkles banner when `wasAdapted=true`.

### Import entry point (saved meals)
`GET /api/saved-meals` resolves today's NDE state, annotates each meal with `dayMismatchNote` + `dayMismatchPolicy` when starch conflicts. Client (`SavedMeals.tsx`) shows amber `AlertTriangle` warning card in expanded view. Never removes meals — always informational.

## How to Apply

When adding any new food entry point:
1. Server: resolve daily nutrition state (`resolveDailyNutritionState()` or load envelope via `loadUserProtocolEnvelope()`)
2. Check: `starchPolicy === "zero"` OR `starchyBudgetExhausted`
3. Response: add `ndeSummary` object with `scheduleConfigured`, `starchPolicy`, `conflicts`, `conflictNote`
4. Client: show an amber (conflict) or orange (adapted) informational banner — never block silently

## Master Plan
`docs/c2-master-plan.md` — renamed from "C2 Daily Nutrition State Engine" to "Nutrition Decision Engine (NDE)". Priority 2 (post-gen validator) and Priority 4 (saved meal revalidation) marked shipped.
