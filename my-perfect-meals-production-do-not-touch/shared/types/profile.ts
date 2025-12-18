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
