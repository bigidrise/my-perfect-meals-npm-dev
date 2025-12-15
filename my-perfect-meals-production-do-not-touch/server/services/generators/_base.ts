import { resolveConstraints, } from '../profileResolver';
import type { GeneratorOverrides, ResolvedConstraints } from '../../../shared/types/profile';
import { computeMedicalBadges } from '../medicalBadges';

export interface Meal {
  title: string;
  ingredients: { name: string; qty?: number; unit?: string; }[];
  instructions: string[];
  nutrition?: { calories?: number; proteinG?: number; carbsG?: number; fatG?: number; };
  badges?: string[];
}

export interface GenerationResult {
  constraints: ResolvedConstraints;
  meals: Meal[];
}

export type GeneratorFn = (c: ResolvedConstraints) => Promise<Meal[]>;

/**
 * Hard gate: every generator MUST pass through this wrapper.
 * - Resolves onboarding + overrides → constraints
 * - Calls the specific generator with those constraints
 * - Validates/output-stamps medical badges
 */
export async function runWithOnboarding(
  userId: string,
  generator: GeneratorFn,
  overrides?: GeneratorOverrides
): Promise<GenerationResult> {
  const constraints = await resolveConstraints(userId, overrides);
  if (!constraints) throw new Error('Constraints resolution failed');

  const meals = await generator(constraints);

  // Attach badges consistently
  for (const m of meals) {
    const ingredients = m.ingredients.map(i => i.name);
    const badges = computeMedicalBadges(constraints, ingredients);
    m.badges = badges;
  }

  // Minimal compliance checks — fail fast if violated
  const blocked = new Set(constraints.excludeIngredients.map(s=>s.toLowerCase()));
  for (const m of meals) {
    for (const ing of m.ingredients) {
      const n = ing.name.toLowerCase();
      if (blocked.has(n)) {
        throw new Error(`Compliance breach: "${n}" is excluded/allergen for user ${constraints.userId}`);
      }
    }
  }

  return { constraints, meals };
}
