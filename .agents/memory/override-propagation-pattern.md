---
name: Override propagation pattern — /api/meals/generate
description: How a Safety PIN override token must flow from runEnforcement all the way through to scanGeneratedOutput in the unified pipeline.
---

## The pattern

`EnforcementResult` does not carry `overriddenAllergen`. The allergen lives in the in-memory token store in `safetyPinService.ts`. The token is atomically claimed (and deleted) by `enforceSafetyProfile` inside `runEnforcement` — so it cannot be read after enforcement completes.

**Fix: peek before enforcement.**

Call `peekOverrideTokenAllergen(token, userId)` (non-consuming read) before `runEnforcement`. Store the result as `_unifiedOverriddenAllergens`. Pass it to `generateMealUnified` as `overriddenAllergens`. The pipeline threads it to `scanGeneratedOutput` in both the create-with-chef and snack-creator builders.

**Why:** Without the peek, the allergen is consumed by enforcement and is unavailable for post-generation suppression. The pre-gen check passes but the post-gen scan re-blocks the same allergen the PIN just authorized.

**How to apply:** Any new builder type added to `generateMealUnified` must also receive `overriddenAllergens` and pass it to its `scanGeneratedOutput` call.

## Files touched
- `server/services/safetyPinService.ts` — `peekOverrideTokenAllergen()` export
- `server/routes.ts` — peek before `runEnforcement`, pass to `generateMealUnified`
- `server/services/unifiedMealPipeline.ts` — `overriddenAllergens` on `MealGenerationRequest`, threaded to `generateFromDescriptionUnified` and `generateSnackFromCravingUnified`

## Compare with craving-creator
The craving-creator route uses `enforceSafetyProfile` directly (not `runEnforcement`) and reads `safetyCheck.overriddenAllergen` from the result. That path works differently — no peek needed. The unified `/api/meals/generate` route uses `runEnforcement`, which is why the peek pattern is required there.
