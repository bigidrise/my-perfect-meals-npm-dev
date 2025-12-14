#!/bin/bash
# scripts/setup-onboarding-enforcement.sh
# Purpose: enforce onboarding-driven meal generation across ALL generators
set -euo pipefail

echo "==> Creating shared types"
mkdir -p shared/types
cat > shared/types/profile.ts <<'TS'
export type DietType =
  | 'balanced' | 'keto' | 'low_carb' | 'low_fat' | 'mediterranean'
  | 'paleo' | 'vegan' | 'vegetarian' | 'pescatarian' | 'gluten_free'
  | 'dairy_free' | 'custom';

export type Condition =
  | 'type1_diabetes' | 'type2_diabetes' | 'celiac' | 'crohns'
  | 'hypertension' | 'pregnancy' | 'lactose_intolerance' | 'shellfish_allergy'
  | 'peanut_allergy' | 'nut_allergy' | 'egg_allergy' | 'soy_allergy';

export type SweetenerPreference = 'none' | 'stevia' | 'monk_fruit' | 'sucralose' | 'aspartame' | 'erythritol' | 'all';

export interface OnboardingProfile {
  userId: string;
  caloriesTarget?: number;
  proteinTargetG?: number;
  carbsTargetG?: number;
  fatTargetG?: number;
  preferredDiets: DietType[];           // user default diet preferences
  disallowedIngredients: string[];      // full text names
  allergies: string[];                  // free text + common tags
  conditions: Condition[];              // normalized conditions
  lowGlycemicMode?: boolean;            // for diabetes flow
  bodyType?: 'endomorph' | 'mesomorph' | 'ectomorph';
  sugarSubPref?: SweetenerPreference;
}

export interface GeneratorOverrides {
  // Temporary modifications chosen in a specific flow (e.g., AI Meal Creator step 1)
  forceDiet?: DietType | null;
  includeIngredients?: string[];    // explicit inclusions (e.g., chicken, salmon)
  excludeIngredients?: string[];    // extra exclusions for this run
  servings?: number;                // scaling per run
  caloriesTarget?: number;          // per-run target override
}

export interface ResolvedConstraints {
  userId: string;
  diet: DietType;
  includeIngredients: string[];
  excludeIngredients: string[];
  allergies: string[];
  conditions: Condition[];
  lowGlycemicMode: boolean;
  sugarSubPref?: SweetenerPreference;
  macroTargets?: { calories?: number; proteinG?: number; carbsG?: number; fatG?: number; };
  servings: number;
}
TS

echo "==> Creating server services"
mkdir -p server/services
cat > server/services/profileResolver.ts <<'TS'
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
TS

cat > server/services/medicalBadges.ts <<'TS'
import { ResolvedConstraints } from '../../shared/types/profile';

export type MedicalBadge =
  | 'type1_safe' | 'type2_safe' | 'gluten_free' | 'dairy_free'
  | 'low_glycemic' | 'shellfish_free' | 'peanut_free' | 'nut_free' | 'soy_free';

export function computeMedicalBadges(constraints: ResolvedConstraints, ingredients: string[]): MedicalBadge[] {
  const set = new Set<MedicalBadge>();

  const names = ingredients.map(s => s.toLowerCase());
  const has = (kw: string) => names.some(n => n.includes(kw));

  // Allergens
  if (!has('gluten') && !has('wheat')) set.add('gluten_free');
  if (!has('milk') && !has('cheese') && !has('butter') && !has('cream')) set.add('dairy_free');
  if (!has('shellfish') && !has('shrimp') && !has('crab') && !has('lobster')) set.add('shellfish_free');
  if (!has('peanut')) set.add('peanut_free');
  if (!has('almond') && !has('walnut') && !has('pecan') && !has('cashew') && !has('hazelnut')) set.add('nut_free');
  if (!has('soy')) set.add('soy_free');

  // Conditions
  if (constraints.lowGlycemicMode) set.add('low_glycemic');
  if (constraints.conditions.includes('type1_diabetes')) set.add('type1_safe');
  if (constraints.conditions.includes('type2_diabetes')) set.add('type2_safe');

  return Array.from(set);
}
TS

mkdir -p server/services/generators
cat > server/services/generators/_base.ts <<'TS'
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
TS

echo "==> Utilities"
mkdir -p server/utils
cat > server/utils/strings.ts <<'TS'
export function normalizeName(s: string): string {
  return s.trim().toLowerCase();
}
export function mergeArraysUnique<T>(...arrs: T[][]): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const arr of arrs) {
    for (const v of arr) {
      const k = typeof v === 'string' ? v.toLowerCase() : JSON.stringify(v);
      if (!seen.has(k)) { seen.add(k); out.push(v); }
    }
  }
  return out;
}
TS

echo "==> Stubbing onboarding store (replace with real DB calls)"
mkdir -p server/stores
cat > server/stores/onboardingStore.ts <<'TS'
import type { OnboardingProfile } from '../../shared/types/profile';

// TODO: Replace with Drizzle/DB query: SELECT * FROM onboarding_profiles WHERE user_id = $1
export async function getUserOnboardingProfile(userId: string): Promise<OnboardingProfile | null> {
  // Placeholder to prove the pipeline works. Replace ASAP with real fetch.
  return {
    userId,
    caloriesTarget: 1800,
    proteinTargetG: 130,
    carbsTargetG: 150,
    fatTargetG: 60,
    preferredDiets: ['balanced'],
    disallowedIngredients: ['shellfish'],
    allergies: ['peanut'],
    conditions: ['type1_diabetes'],
    lowGlycemicMode: true,
    sugarSubPref: 'stevia',
  };
}
TS

echo "✅ Onboarding enforcement installed. Ensure ALL generators call runWithOnboarding()."