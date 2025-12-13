/**
 * Diabetic Diet Validator
 * 
 * Post-generation validation to ensure AI output complies with diabetic rules.
 * Scans ingredient lists and rejects violations.
 */

import { diabeticRules } from "../rules/diabeticRules";
import { ValidationResult, GeneratedMeal } from "../types";

export function validateDiabeticMeal(meal: GeneratedMeal): ValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  
  // Extract all ingredients from the meal
  const ingredientStrings = extractIngredientStrings(meal);
  
  // Check for blocked ingredients
  for (const ingredient of ingredientStrings) {
    const lowerIngredient = ingredient.toLowerCase();
    
    for (const blocked of diabeticRules.blockedIngredients) {
      if (lowerIngredient.includes(blocked.toLowerCase())) {
        // Check if it's a safe variant
        if (isSafeVariant(lowerIngredient, blocked)) {
          continue;
        }
        violations.push(`Blocked ingredient detected: "${blocked}" in "${ingredient}"`);
      }
    }
  }
  
  // Check for preferred ingredients (generate warnings if missing key ones)
  const hasProtein = ingredientStrings.some(ing => 
    diabeticRules.preferredIngredients.some(pref => 
      ing.toLowerCase().includes(pref.toLowerCase()) && 
      isProteinIngredient(pref)
    )
  );
  
  const hasVegetables = ingredientStrings.some(ing =>
    diabeticRules.preferredIngredients.some(pref =>
      ing.toLowerCase().includes(pref.toLowerCase()) &&
      isVegetableIngredient(pref)
    )
  );
  
  if (!hasProtein) {
    warnings.push("Consider adding lean protein for blood sugar stability");
  }
  
  if (!hasVegetables) {
    warnings.push("Consider adding non-starchy vegetables for fiber");
  }
  
  // Check macro guidance if available
  if (meal.macros) {
    // High carb warning (diabetic meals should be carb-controlled)
    if (meal.macros.carbs && meal.macros.carbs > 60) {
      warnings.push(`High carbohydrate content (${meal.macros.carbs}g) - consider reducing`);
    }
    
    // Low fiber warning
    if (meal.macros.fiber && meal.macros.fiber < 3) {
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

function extractIngredientStrings(meal: GeneratedMeal): string[] {
  const ingredients: string[] = [];
  
  if (meal.ingredients) {
    for (const ing of meal.ingredients) {
      if (typeof ing === "string") {
        ingredients.push(ing);
      } else if (ing && typeof ing === "object") {
        // Handle ingredient objects with item/name properties
        if (ing.item) ingredients.push(ing.item);
        if (ing.name) ingredients.push(ing.name);
      }
    }
  }
  
  // Also check the meal name and description for problematic terms
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
