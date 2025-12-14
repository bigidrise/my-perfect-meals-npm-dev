import type { MealTemplateBase, Ingredient, IngredientRole, GoalTag } from "@/data/models";
import type { MacroTargets } from "@/utils/computeTargets";
import { INGREDIENT_MACROS } from "@/data/ingredients.nutrition";
import { veggieCupsPerMeal } from "@/utils/computeTargets";

export interface ScalingOptions {
  targets: MacroTargets;
  servings: number;
  preserveRatios?: boolean;
}

export interface ScaledTemplate extends MealTemplateBase {
  currentServings: number;
  scaledIngredients: Ingredient[];
  adjustedNutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

// Helper to get ingredients by role
function getIngredientsByRole(ingredients: Ingredient[], role: IngredientRole): Ingredient[] {
  return ingredients.filter(ing => ing.role === role);
}

// Helper to estimate protein content from ingredients
function estimateProteinGrams(ingredients: Ingredient[]): number {
  let totalProtein = 0;
  
  for (const ing of ingredients) {
    const nutrition = INGREDIENT_MACROS[ing.name.toLowerCase()];
    if (nutrition) {
      // Convert quantity to grams if needed
      let gramsAmount = ing.quantity;
      if (ing.unit === "ml" && ing.name.includes("egg white")) {
        gramsAmount = ing.quantity; // ml to g roughly 1:1 for egg whites
      } else if (ing.unit === "ml") {
        gramsAmount = ing.quantity; // Assume 1:1 for liquids
      }
      
      totalProtein += (nutrition.protein * gramsAmount) / 100;
    }
  }
  
  return totalProtein;
}

// Helper to estimate carb content from starchy ingredients
function estimateCarbGrams(ingredients: Ingredient[]): number {
  let totalCarbs = 0;
  
  for (const ing of ingredients) {
    const nutrition = INGREDIENT_MACROS[ing.name.toLowerCase()];
    if (nutrition) {
      let gramsAmount = ing.quantity;
      if (ing.unit === "ml") {
        gramsAmount = ing.quantity;
      }
      
      totalCarbs += (nutrition.carbs * gramsAmount) / 100;
    }
  }
  
  return totalCarbs;
}

// Scale ingredients to hit nutrition targets
export function scaleTemplateToTargets(
  template: MealTemplateBase,
  options: ScalingOptions
): ScaledTemplate {
  const { targets, servings } = options;
  
  // Get ingredients by role
  const proteinIngredients = getIngredientsByRole(template.ingredients, "protein");
  const carbIngredients = getIngredientsByRole(template.ingredients, "carb");
  const vegIngredients = getIngredientsByRole(template.ingredients, "veg");
  const otherIngredients = template.ingredients.filter(ing => 
    !["protein", "carb", "veg"].includes(ing.role || "other")
  );

  let scaledIngredients: Ingredient[] = [...template.ingredients];

  // Step 1: Scale protein ingredients to hit protein target per meal
  if (proteinIngredients.length > 0) {
    const currentProtein = estimateProteinGrams(proteinIngredients);
    const targetProtein = targets.proteinPerMeal_g;
    
    if (currentProtein > 0) {
      const proteinScaleFactor = targetProtein / currentProtein;
      
      scaledIngredients = scaledIngredients.map(ing => {
        if (ing.role === "protein") {
          return {
            ...ing,
            quantity: Math.round(ing.quantity * proteinScaleFactor * 10) / 10
          };
        }
        return ing;
      });
    }
  }

  // Step 2: Clamp starchy carbs to per-meal carb window
  if (carbIngredients.length > 0) {
    const updatedCarbIngredients = scaledIngredients.filter(ing => ing.role === "carb");
    const currentCarbs = estimateCarbGrams(updatedCarbIngredients);
    const targetCarbsMin = targets.starchyCarbsPerMeal_g_min;
    const targetCarbsMax = targets.starchyCarbsPerMeal_g_max;
    
    if (currentCarbs > 0) {
      let carbScaleFactor = 1;
      
      if (currentCarbs > targetCarbsMax) {
        carbScaleFactor = targetCarbsMax / currentCarbs;
      } else if (currentCarbs < targetCarbsMin) {
        carbScaleFactor = targetCarbsMin / currentCarbs;
      }
      
      scaledIngredients = scaledIngredients.map(ing => {
        if (ing.role === "carb") {
          return {
            ...ing,
            quantity: Math.round(ing.quantity * carbScaleFactor * 10) / 10
          };
        }
        return ing;
      });
    }
  }

  // Step 3: Ensure 2-3 cups vegetables per meal
  if (vegIngredients.length > 0) {
    const { min: vegCupsMin, max: vegCupsMax } = veggieCupsPerMeal(targets);
    const CUPS_TO_GRAMS_DEFAULT = 80; // ~80g per cup fibrous veg
    
    const currentVegWeight = vegIngredients.reduce((sum, ing) => {
      if (ing.unit === "g") return sum + ing.quantity;
      return sum + 50; // Default assumption for non-gram veg
    }, 0);
    
    const minGrams = vegCupsMin * CUPS_TO_GRAMS_DEFAULT; // 2 cups = 160g
    const maxGrams = vegCupsMax * CUPS_TO_GRAMS_DEFAULT; // 3 cups = 240g
    
    let targetGrams = currentVegWeight;
    if (currentVegWeight < minGrams) {
      targetGrams = minGrams; // Scale up to minimum 160g
    } else if (currentVegWeight > maxGrams) {
      targetGrams = maxGrams; // Scale down to maximum 240g
    }
    
    if (targetGrams !== currentVegWeight && currentVegWeight > 0) {
      const vegScaleFactor = targetGrams / currentVegWeight;
      
      scaledIngredients = scaledIngredients.map(ing => {
        if (ing.role === "veg") {
          return {
            ...ing,
            quantity: Math.round(ing.quantity * vegScaleFactor * 10) / 10
          };
        }
        return ing;
      });
    }
  }

  // Step 4: Apply serving multiplier
  if (servings !== 1) {
    scaledIngredients = scaledIngredients.map(ing => ({
      ...ing,
      quantity: Math.round(ing.quantity * servings * 10) / 10
    }));
  }

  // Calculate adjusted nutrition
  let adjustedNutrition = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  };

  // Estimate nutrition from scaled ingredients
  for (const ing of scaledIngredients) {
    const nutrition = INGREDIENT_MACROS[ing.name.toLowerCase()];
    if (nutrition) {
      let gramsAmount = ing.quantity;
      if (ing.unit === "ml") {
        gramsAmount = ing.quantity; // Rough conversion
      }
      
      const factor = gramsAmount / 100;
      adjustedNutrition.calories += nutrition.calories * factor;
      adjustedNutrition.protein += nutrition.protein * factor;
      adjustedNutrition.carbs += nutrition.carbs * factor;
      adjustedNutrition.fat += nutrition.fat * factor;
    }
  }

  // Round nutrition values
  adjustedNutrition = {
    calories: Math.round(adjustedNutrition.calories),
    protein: Math.round(adjustedNutrition.protein),
    carbs: Math.round(adjustedNutrition.carbs),
    fat: Math.round(adjustedNutrition.fat)
  };

  return {
    ...template,
    currentServings: servings,
    scaledIngredients,
    adjustedNutrition
  };
}

// Filter templates by goal tag
export function filterTemplatesByGoal(
  templates: MealTemplateBase[],
  goalTag: GoalTag
): MealTemplateBase[] {
  return templates.filter(template => template.goalTag === goalTag);
}

// Get appropriate archetype for goal and diet preferences
export function getArchetypeForGoal(
  goalTag: GoalTag,
  dietPreference?: string,
  medicalFlags?: string[]
): string {
  // Handle medical requirements first
  if (medicalFlags?.includes("diabetic")) {
    return "Diabetic";
  }
  
  if (dietPreference) {
    return dietPreference;
  }
  
  // Default archetype based on goal
  switch (goalTag) {
    case "loss":
      return "HP/LC"; // High protein, low carb for weight loss
    case "gain":
      return "HP/HC"; // High protein, high carb for weight gain
    case "maintenance":
    default:
      return "Balanced"; // Balanced macros for maintenance
  }
}