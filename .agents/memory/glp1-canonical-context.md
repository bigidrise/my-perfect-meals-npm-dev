---
name: GLP-1 Canonical Context Resolver — Stage 1
description: Architecture and wiring for the platform-wide GLP-1 canonical context resolver introduced in Stage 1 of the GLP-1 system-level repair.
---

# GLP-1 Canonical Context Resolver

## The rule
"The surface changes; the person doesn't." When GLP-1 is active, every food-generating and food-recommending surface receives the same canonical GLP-1 intelligence automatically. The page does not decide whether GLP-1 exists.

## Canonical resolver
`server/services/glp1/resolveGLP1GlobalContext.ts` — `resolveGLP1GlobalContext(userId, dateISO, mealType)`

Returns `GLP1GlobalContext`:
- `isActive: boolean` — GLP-1 active from ANY source
- `activationSources: GLP1ActivationSource[]` — all sources that fired
- `performanceActive: boolean` — Performance mode also on
- `resolvedTargets: ResolvedGLP1Targets | null` — patient-specific meal targets (pass to applyGuardrails + validateMealForDiet)
- `dailyNutritionState: DailyNutritionState | null` — remaining macros today
- `compositionNote: string` — GLP-1 + Performance composition guidance

## Activation sources (3 current-state sources only)
1. `users.selectedMealBuilder === "glp1"` — user's actively selected builder
2. `users.medicalConditions` contains "glp1" — physician-managed via `PUT /api/pro/glp1-protocol/:id {enabled:true/false}` (adds/removes "glp1" from array — the canonical clinical toggle)
3. `users.specialtyConditions` contains a GLP-1 medication keyword (updateable)

**INTENTIONALLY EXCLUDED:**
- `users.preferredBuilder` — schema comment says "starting recommendation from onboarding"; NOT a current treatment indicator, could be stale
- `glp1_profile row exists` — table has no `is_active` field (`id, user_id UNIQUE, guardrails JSONB, created_at, updated_at`); row persists forever after setup with no deactivation mechanism

**Why:** Two stale sources were removed after audit confirmed they can represent historical state ("has ever been GLP-1") not current treatment state. For Premier: "GLP-1 protocol currently active" ≠ "has ever been on GLP-1."

**Future:** Add `users.glp1_protocol_active boolean` as the canonical single flag. The 3 sources establish/migrate it; every feature asks one question: "Is this person's GLP-1 protocol currently active?"

## Threading path for generated meals
`POST /api/meals/generate` (routes.ts) →
  `resolveGLP1GlobalContext()` server-side →
  `glp1Targets` added to `MealGenerationRequest` →
  `generateMealUnified()` →
    `generateFromDescriptionUnified()` (create-with-chef) → `applyGuardrails(... glp1Targets)` + `validateMealForDiet(... glp1Targets)`
    `generateSnackFromCravingUnified()` (snack-creator) → same

## applyGuardrails signature (8 params)
`applyGuardrails(basePrompt, dietType, mealType, dietPhase?, remainingMacros?, builderMode?, dailyProteinTarget?, glp1Targets?)`

## validateMealForDiet signature (5 params)
`validateMealForDiet(meal, dietType, dietPhase?, isSnack?, glp1Targets?)`

## What this fixes
Previously the resolver (`resolveGLP1MealTargets`) existed with 57 unit tests but had **zero callers** — the generator used static 400 kcal / 12 g fat / 15 g protein fallbacks regardless of the user's actual protocol state. Now the route loads personalized targets and passes them through.

## GLP-1 + Performance composition rule
When Performance is also active, the training-day prescription controls macro targets. GLP-1 volume/tolerance constraints (small portions, low fat, easy digestion, protein priority) remain FULLY ACTIVE on top. Do NOT relax GLP-1 rules based on Performance context. The `compositionNote` string is returned for injection into prompts.

## Do NOT hard-code volume reduction percentages
Any phase-specific reduction rules belong in `resolveGLP1MealTargets` registry (rule-based resolver). Do not scatter percentage numbers through feature code.

## Stages remaining (not yet implemented)
- Stage 2: Type-A generation surfaces — Craving Creator, Fridge Rescue, Weekly Meal Plan routes need `resolveGLP1GlobalContext` wired at their route level (not just inside generateMealUnified which only covers create-with-chef + snack-creator)
- Stage 3: Recommendation surfaces — Restaurant Guide fallback, Getaways, Buffet, Grocery Coach, Find Your Meals hardening
- Stage 4: Remaining surfaces + consolidate 6+ scattered GLP-1 prompt blocks into canonical layer
