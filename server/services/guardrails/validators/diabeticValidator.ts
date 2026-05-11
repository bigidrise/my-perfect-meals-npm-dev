/**
 * Diabetic Diet Validator
 *
 * Post-generation validation to ensure AI output complies with diabetic rules.
 * Scans ingredient lists and rejects violations.
 * Accepts glucose state — low glucose bypasses restrictions on fast-acting carbs.
 */

import { diabeticRules } from "../rules/diabeticRules";
import { ValidationResult, GeneratedMeal } from "../types";

export type GlucoseState = "low" | "low-normal" | "in-range" | "elevated" | "high-risk";

export interface DiabeticValidationContext {
  glucoseState?: GlucoseState;
}

// Ingredients allowed during hypoglycemia (low glucose state) or low-normal range.
// Covers all items in LOW_RANGE_OPTIONS that could be on the static block list,
// plus other fast-acting carbs clinically appropriate for glucose recovery.
// Rule: recovery speed > dietary purity when glucose is low.
const HYPO_TREATMENT_INGREDIENTS = [
  // Fast-acting fruits (all LOW_RANGE_OPTIONS fruit items + common hypo treats)
  "banana", "bananas", "pineapple", "grapes", "grape", "watermelon", "melon",
  "mango", "mangoes", "oranges", "orange", "raisins", "dried fruit",
  // Juices
  "fruit juice", "orange juice", "apple juice", "grape juice",
  // Fast-acting carbs appropriate for recovery
  "dates", "corn", "white rice", "white bread",
  // Moderate-GI carbs in LOW_RANGE_OPTIONS
  "oatmeal", "brown rice", "whole grain bread", "sweet potato",
];

export function validateDiabeticMeal(
  meal: GeneratedMeal,
  context: DiabeticValidationContext = {}
): ValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  const isLowGlucose = context.glucoseState === "low" || context.glucoseState === "low-normal";

  const ingredientStrings = extractIngredientStrings(meal);

  for (const ingredient of ingredientStrings) {
    const lowerIngredient = ingredient.toLowerCase();

    for (const blocked of diabeticRules.blockedIngredients) {
      if (lowerIngredient.includes(blocked.toLowerCase())) {
        if (isSafeVariant(lowerIngredient, blocked)) continue;

        // Low glucose bypass — hypo-treatment ingredients are appropriate right now
        if (isLowGlucose && isHypoTreatmentIngredient(blocked)) continue;

        violations.push(`Blocked ingredient detected: "${blocked}" in "${ingredient}"`);
      }
    }
  }

  const hasProtein = ingredientStrings.some(ing =>
    diabeticRules.preferredIngredients.some(pref =>
      ing.toLowerCase().includes(pref.toLowerCase()) && isProteinIngredient(pref)
    )
  );

  const hasVegetables = ingredientStrings.some(ing =>
    diabeticRules.preferredIngredients.some(pref =>
      ing.toLowerCase().includes(pref.toLowerCase()) && isVegetableIngredient(pref)
    )
  );

  if (!hasProtein && !isLowGlucose) {
    warnings.push("Consider adding lean protein for blood sugar stability");
  }

  if (!hasVegetables && !isLowGlucose) {
    warnings.push("Consider adding non-starchy vegetables for fiber");
  }

  if (meal.macros) {
    const carbLimit = context.glucoseState === "high-risk" ? 15
      : context.glucoseState === "elevated" ? 25
      : context.glucoseState === "low" ? 45
      : 60;

    const isHighRiskState = context.glucoseState === "high-risk" || context.glucoseState === "elevated";

    if (meal.macros.carbs && meal.macros.carbs > carbLimit && !isLowGlucose) {
      if (isHighRiskState) {
        // At elevated or high-risk glucose, carb excess is a hard violation — not a suggestion.
        violations.push(`Carbohydrate content (${meal.macros.carbs}g) exceeds the ${carbLimit}g hard limit for glucose state "${context.glucoseState}". This meal must be rejected and replaced.`);
      } else {
        warnings.push(`High carbohydrate content (${meal.macros.carbs}g) - consider reducing`);
      }
    }

    if (meal.macros.fiber && meal.macros.fiber < 3 && !isLowGlucose) {
      warnings.push("Low fiber content - consider adding more vegetables");
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
    warnings,
    dietType: "diabetic",
  };
}

function isHypoTreatmentIngredient(blocked: string): boolean {
  return HYPO_TREATMENT_INGREDIENTS.some(h => h.toLowerCase() === blocked.toLowerCase());
}

function extractIngredientStrings(meal: GeneratedMeal): string[] {
  const ingredients: string[] = [];

  if (meal.ingredients) {
    for (const ing of meal.ingredients) {
      if (typeof ing === "string") {
        ingredients.push(ing);
      } else if (ing && typeof ing === "object") {
        if (ing.item) ingredients.push(ing.item);
        if (ing.name) ingredients.push(ing.name);
      }
    }
  }

  if (meal.name) ingredients.push(meal.name);
  if (meal.description) ingredients.push(meal.description);

  return ingredients;
}

function isSafeVariant(ingredient: string, blocked: string): boolean {
  const safePatterns: Record<string, string[]> = {
    "sugar": ["sugar-free", "no sugar", "zero sugar", "unsweetened"],
    "chocolate": ["dark chocolate", "cacao", "cocoa powder"],
    "yogurt": ["plain greek yogurt", "unsweetened yogurt", "plain yogurt"],
    "ketchup": ["sugar-free ketchup", "no-sugar ketchup"],
    "bbq sauce": ["sugar-free bbq", "no-sugar bbq"],
    "teriyaki": ["sugar-free teriyaki"],
    "rice": ["cauliflower rice", "brown rice"],
    "pasta": ["chickpea pasta", "lentil pasta", "zucchini noodles", "protein pasta"],
    "tortilla": ["low-carb tortilla", "almond flour tortilla"],
    "bread": ["low-carb bread", "keto bread", "almond flour bread"],
  };

  const patterns = safePatterns[blocked.toLowerCase()];
  if (patterns) {
    return patterns.some(safe => ingredient.includes(safe));
  }
  return false;
}

function isProteinIngredient(ingredient: string): boolean {
  const proteins = [
    "chicken", "turkey", "salmon", "cod", "tilapia", "shrimp",
    "eggs", "beef", "pork", "fish", "tofu", "tempeh"
  ];
  return proteins.some(p => ingredient.toLowerCase().includes(p));
}

function isVegetableIngredient(ingredient: string): boolean {
  const vegetables = [
    "broccoli", "spinach", "kale", "zucchini", "asparagus",
    "cauliflower", "green beans", "brussels", "cabbage", "pepper",
    "cucumber", "celery", "mushroom", "eggplant", "lettuce", "arugula"
  ];
  return vegetables.some(v => ingredient.toLowerCase().includes(v));
}
