---
name: GLP-1 Target Resolver
description: Architecture for the personalized GLP-1 meal target resolver — how targets flow from user DB records to prompts and validators.
---

## Core Files

- `server/services/glp1/resolveGLP1MealTargets.ts` — pure resolver function, no DB calls
- `server/services/glp1/glp1TargetLoader.ts` — async DB loader (fetches users + glp1_profile, calls resolver)
- `server/services/glp1/__tests__/resolveGLP1MealTargets.test.ts` — 57 deterministic tests

## Integration Points

- `applyGuardrails()` in `server/services/guardrails/index.ts` — 8th optional param: `glp1Targets?: ResolvedGLP1Targets`
- `validateMealForDiet()` same file — 5th optional param: `glp1Targets?: ResolvedGLP1Targets`
- `buildGLP1Prompt()` and `buildGLP1SnackPrompt()` in `glp1PromptBuilder.ts` — accept `resolvedTargets?`
- `validateGLP1Meal()` and `validateGLP1Snack()` in `glp1Validator.ts` — accept `resolvedTargets?`

## What the Resolver Does

```
remainingCalories ÷ plannedMealsRemaining
× treatmentPhaseMultiplier   (intro 0.82, maintenance 1.0, muscle_preserve 1.08)
× appetiteMultiplier         (suppressed 0.80, reduced 0.90, normal 1.0, increased 1.05)
× trainingMultiplier         (none 1.0, light 1.05, moderate 1.10, heavy 1.18, elite 1.28)
× muscleMultiplier           (priority +5%)
= resolvedMealCalories  [clamped 200–900 kcal]
```

Fat ceiling = min(fatBudgetPerMeal, guardrails.fatMaxG) — provider guardrail always wins
Protein target = max(proteinBudgetPerMeal, guardrails.proteinMinG) — floor always met

## Baseline Fallback

`usedBaseline = true` when user has no `dailyCalorieTarget`. Values:
- 400 kcal/meal, 150 kcal/snack, 25g protein target, 15g fat ceiling

## Treatment Phase Detection

Inferred from guardrails (not a stored field):
- `proteinMinG >= 40` → muscle_preserve
- `fatMaxG <= 10` → intro
- Otherwise → maintenance

## Personalized vs. Baseline Logging

Server logs show: `[GLP-1 Resolver] user=N meal=X cal=Y protein=Zg fat-ceiling=Wg phase=P baseline=false`
Guardrails case logs: `🛡️ Guardrails: Applied GLP-1 rules for lunch [PERSONALIZED: 480kcal / 15g fat / 38g protein — phase: maintenance]`

**Why:** Static 400 kcal / 12g fat applied identically to a sedentary intro patient and a 250-lb cyclist was clinically wrong. The resolver makes targets patient-specific before the AI sees them.

**How to apply:** Call `loadGLP1ResolvedTargets(userId, options)` at the route level where user context is available. Pass the result as the 8th arg to `applyGuardrails` and 5th arg to `validateMealForDiet`. Surfaces that do not call the loader yet still fall back gracefully to static baselines.
