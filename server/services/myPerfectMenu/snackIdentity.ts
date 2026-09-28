import { classifyFoodIdentity } from "@shared/foodIdentity";
import type { MyPerfectMenuConcept, MyPerfectMenuSnackType } from "@shared/myPerfectMenu";
import { validateDishIdentity, type GeneratedMealLike } from "../dishAdaptation/dishIdentityValidator";

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
  if (/\b(salad|sandwich|soup|wrap|taco|fries)\b/i.test(meal.name)) return false;
  // Recognized dessert formats must remain in the same family. For a named
  // dessert outside the classifier's vocabulary, require the original title
  // to survive the dish-identity check; never accept a recognized food swap.
  if (finalIdentity.foodRole === "dessert") {
    return finalIdentity.formatFamily === concept.foodIdentity?.formatFamily;
  }
  return classifyFoodIdentity(concept.title).foodRole !== "dessert";
}