import { OnboardingProfile, GeneratorOverrides, ResolvedConstraints, DietType } from '../../shared/types/profile';
import { getUserOnboardingProfile } from '../stores/onboardingStore'; // <-- implement or wire to your DB
import { mergeArraysUnique, normalizeName } from '../utils/strings';

function pickDiet(p?: OnboardingProfile, o?: GeneratorOverrides): DietType {
  if (o?.forceDiet) return o.forceDiet;
  const first = p?.preferredDiets?.[0];
  return first ?? 'balanced';
}

export async function resolveConstraints(userId: string, overrides?: GeneratorOverrides): Promise<ResolvedConstraints> {
  const p: OnboardingProfile | null = await getUserOnboardingProfile(userId);
  if (!p) throw new Error(`Missing onboarding profile for user ${userId}`);

  const diet = pickDiet(p, overrides);
  const includeIngredients = mergeArraysUnique(overrides?.includeIngredients ?? []);
  const excludeIngredients = mergeArraysUnique(
    (p?.disallowedIngredients ?? []).map(normalizeName),
    (overrides?.excludeIngredients ?? []).map(normalizeName),
    (p?.allergies ?? []).map(normalizeName) // allergies implicitly excluded
  );

  const macroTargets = (p?.caloriesTarget || p?.proteinTargetG || p?.carbsTargetG || p?.fatTargetG || overrides?.caloriesTarget)
    ? {
        calories: overrides?.caloriesTarget ?? p?.caloriesTarget,
        proteinG: p?.proteinTargetG,
        carbsG: p?.carbsTargetG,
        fatG: p?.fatTargetG,
      }
    : undefined;

  return {
    userId,
    diet,
    includeIngredients,
    excludeIngredients,
    allergies: (p?.allergies ?? []).map(normalizeName),
    conditions: p?.conditions ?? [],
    lowGlycemicMode: !!p?.lowGlycemicMode,
    sugarSubPref: p?.sugarSubPref,
    macroTargets,
    servings: overrides?.servings ?? 1,
  };
}
