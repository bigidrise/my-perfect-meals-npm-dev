import { classifyFoodIdentity } from "@shared/foodIdentity";
import type { MyPerfectMenuConcept, MyPerfectMenuSnackType } from "@shared/myPerfectMenu";
import { validateDishIdentity, type GeneratedMealLike } from "../dishAdaptation/dishIdentityValidator";

const NON_DESSERT_NAMES = /\b(salad|sandwich|soup|wrap|taco|fries)\b/i;

export function matchesSnackType(
  identity: MyPerfectMenuConcept["foodIdentity"],
  type: MyPerfectMenuSnackType,
): boolean {
  return type === "dessert"
    ? identity?.foodRole === "dessert" && identity.polarity === "sweet" &&
      identity.formatFamily !== "general_sweet" && identity.formatFamily !== "general_snack"
    : identity?.foodRole === "general_snack";
}

export function completedSnackMatchesConcept(
  concept: MyPerfectMenuConcept,
  meal: GeneratedMealLike,
): boolean {
  if (!concept.snackType || !matchesSnackType(concept.foodIdentity, concept.snackType) ||
      !meal.name?.trim()) return false;
  const dish = validateDishIdentity(concept.title, meal);
  if (!dish.passed) return false;
  const finalIdentity = classifyFoodIdentity(meal.name);
  if (concept.snackType === "food") return finalIdentity.foodRole !== "dessert";
  if (NON_DESSERT_NAMES.test(meal.name)) return false;
  // Recognized dessert formats must remain in the same family. For a named
  // dessert outside the classifier's vocabulary, require the original title
  // to survive the dish-identity check; never accept a recognized food swap.
  if (finalIdentity.foodRole === "dessert") {
    return finalIdentity.formatFamily === concept.foodIdentity?.formatFamily;
  }
  return classifyFoodIdentity(concept.title).foodRole !== "dessert";
}

/**
 * A name-vocabulary miss is not proof of a different dish across languages.
 * This grants no acceptance: the caller MUST obtain a successful independent
 * full-recipe identity review. Explicit form changes remain hard rejections.
 */
export function canIndependentlyReviewSnack(
  concept: MyPerfectMenuConcept,
  meal: GeneratedMealLike,
): boolean {
  if (!concept.snackType || !matchesSnackType(concept.foodIdentity, concept.snackType) ||
      !meal.name?.trim() || !meal.ingredients?.some(ingredient =>
        typeof ingredient === "string"
          ? !!ingredient.trim()
          : !!(ingredient.name ?? ingredient.item)?.trim())) return false;
  const instructions = meal.instructions;
  if (!(typeof instructions === "string"
    ? instructions.trim()
    : instructions?.some(step => typeof step === "string" && step.trim()))) return false;
  const dish = validateDishIdentity(concept.title, meal);
  if (dish.formMismatch) return false;
  const completed = classifyFoodIdentity(meal.name);
  // Retain the existing known food/family rejections. Canonical concept
  // metadata, rather than the language of its title, owns the selected family.
  if (concept.snackType === "food" && completed.foodRole === "dessert") return false;
  if (concept.snackType === "dessert" && (
    NON_DESSERT_NAMES.test(meal.name) ||
    (completed.foodRole === "dessert" && completed.formatFamily !== concept.foodIdentity?.formatFamily)
  )) return false;
  // Only the independent reviewer can resolve the remaining lexical ambiguity.
  return true;
}