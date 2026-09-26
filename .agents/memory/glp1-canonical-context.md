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

## Development authority boundary
An actively selected GLP-1 Builder or an explicitly current, relationship-verified provider claim or current medication claim may activate GLP-1 meal behavior. Old medical/specialty condition arrays, previous medication use, paused personal support, and mere profile existence cannot prove current authority. Do not infer clinician provenance from an old array entry.

**Why:** The legacy condition value was written by onboarding, profile settings, and clinicians alike; it survived Builder changes and medication discontinuation, causing unrelated Builders to inherit GLP-1 validation.

**How to apply:** Use the same current-status decision for generation, final validation, prescriptions, envelope, coaching, and recommendations; preserve old information as history, not a live switch. Existing ambiguous users require individual review before a production cutover. The correction is Development-only until deliberately reviewed and released; the published app still uses the older policy.

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

## My Perfect Menu preflight boundary
Shot history is maintenance data and must never gate meal generation. Current appetite and meal-relevant tolerance use the canonical Hub check-in and resolver, may run inline before generation, and must preserve Hub-only fields when updating.

**Why:** Shot dose/date/location do not currently alter meal generation, while appetite, GI tolerance, eating/fluid ability, hydration risk, and governed escalation do. Sending users to the Hub for routine shot maintenance discarded menu continuity.

**How to apply:** Keep shot reminders non-blocking. Save inline tolerance through the canonical Hub path, fail closed until the current record loads, re-resolve context, resume the selected category, and refresh ideas only when the food-context fingerprint changes.

## Do NOT hard-code volume reduction percentages
Any phase-specific reduction rules belong in `resolveGLP1MealTargets` registry (rule-based resolver). Do not scatter percentage numbers through feature code.

## #791 — Craving Creator + Fridge Rescue wired (complete)

### Craving Creator
- `generateCravingMealUnified` now accepts `glp1Targets?: ResolvedGLP1Targets`
- When active: `applyGuardrails("", 'glp1', mealType, ..., glp1Targets)` builds the GLP-1 guidance block and it's injected into the craving prompt before the OpenAI call
- Post-gen: `validateMealForDiet(rawMeal, 'glp1', undefined, false, glp1Targets)` validates fat ceiling + calorie ceiling + protein floor; result logged with meal name + macro numbers
- `generateMealUnified` craving switch case now passes `request.glp1Targets`

### Fridge Rescue (POST /api/meals/fridge-rescue)
- After `getActiveNutritionContext`, route now calls `resolveGLP1GlobalContext` and builds a GLP-1 guidance block via `applyGuardrails`
- Block appended to `combinedBuilderBlock` → flows into `generateFridgeRescueMeals({ ..., builderBlock })`
- Protocol enforcement (`filterMealsByProtocol`) already runs post-gen — GLP-1 guidance now also reaches the prompt layer


## Weekly Meal Plan wired (/api/ai/generate-meal-plan)
- `resolveGLP1GlobalContext` called once per plan generation (after userProfile fetch)
- When active: `applyGuardrails("", 'glp1', 'lunch', ..., resolvedTargets)` builds GLP-1 block
- Block appended to `personalizedPrompt` for every slot in the plan
- Log: `💊 [WEEKLY PLAN/GLP-1] Personalized targets: Xkcal / Xg prot / Xg fat-ceiling [phase: Y] [sources: Z]`
- Note: `/api/generate-weekly-plan` (line 7144) is a stub with hardcoded meals — NOT the real plan generator; the real one is `/api/ai/generate-meal-plan` at line 1738

## Visual indicator (ProtocolStatusBadge) — COMPLETE
- `client/src/components/ProtocolStatusBadge.tsx` — shared component; zero render when inactive
- Fetches `GET /api/nutrition/active-protocol` (new server endpoint inside `registerRoutes()`)
- Endpoint calls `resolveGLP1GlobalContext` + reads `user.performanceModeEnabled` — server-resolved, NOT client `selectedMealBuilder`
- Shows: "GLP-1 Support Active" (orange) | "Performance + GLP-1 Support" (orange) | "Performance Active" (emerald)
- Renders in: `craving-creator.tsx` (after header controls) and `fridge-rescue.tsx` (after hub intro)
- `staleTime: 120_000` — stable within session, won't hammer the resolver

## Stages remaining
- Stage 4: Sushi Creator, Recipe Maker, Recipe Scan + consolidate 6 scattered GLP-1 prompt blocks (task #793)
- GLP-1 + Performance composition proof — need a test user with both active to see the server log trace side-by-side
- Visual indicator placement on Restaurant Guide, Find Meals, Getaways, Buffet (those are recommendation surfaces, badge is not yet placed there)
