import type { Meal } from "@/types/meal";

export type PickerMealCardData = {
  id?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  ingredients: Array<{ name: string; amount: string }>;
  instructions: string[];
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  labels?: string[];
  badges: string[];
};

export type MealCardSlot = "breakfast" | "lunch" | "dinner" | "snacks";

export function getMealCardSlot(slotLabel: string): MealCardSlot {
  const normalized = slotLabel.toLowerCase();
  if (normalized.includes("breakfast")) return "breakfast";
  if (normalized.includes("lunch")) return "lunch";
  if (normalized.includes("dinner")) return "dinner";
  return "snacks";
}

export function toMealCardMeal(meal: PickerMealCardData): Meal {
  return {
    id: meal.id ?? `picker-${meal.name}`,
    title: meal.name,
    name: meal.name,
    description: meal.description,
    imageUrl: meal.imageUrl,
    ingredients: meal.ingredients.map(({ name, amount }) => ({ item: name, amount })),
    instructions: meal.instructions,
    nutrition: {
      calories: meal.calories ?? 0,
      protein: meal.protein ?? 0,
      carbs: meal.carbs ?? 0,
      fat: meal.fats ?? 0,
    },
    badges: meal.badges,
  };
}

export function fromMealCardMeal<T extends PickerMealCardData>(
  updatedMeal: Meal,
  currentMeal: T,
): T {
  const ingredients = Array.isArray(updatedMeal.ingredients)
    ? updatedMeal.ingredients.map((ingredient) => {
        if (typeof ingredient === "string") {
          return { name: ingredient, amount: "" };
        }
        return {
          name: String(ingredient?.name ?? ingredient?.item ?? "").trim(),
          amount: String(ingredient?.amount ?? ingredient?.quantity ?? ingredient?.qty ?? "").trim(),
        };
      })
    : currentMeal.ingredients;
  const instructions = Array.isArray(updatedMeal.instructions)
    ? updatedMeal.instructions
        .map((instruction) => String(instruction?.instruction ?? instruction?.text ?? instruction ?? "").trim())
        .filter(Boolean)
    : currentMeal.instructions;

  return {
    ...currentMeal,
    id: updatedMeal.id,
    name: updatedMeal.title ?? updatedMeal.name ?? currentMeal.name,
    description: updatedMeal.description ?? currentMeal.description,
    imageUrl: updatedMeal.imageUrl ?? currentMeal.imageUrl,
    ingredients,
    instructions,
    calories: updatedMeal.nutrition?.calories ?? currentMeal.calories,
    protein: updatedMeal.nutrition?.protein ?? currentMeal.protein,
    carbs: updatedMeal.nutrition?.carbs ?? currentMeal.carbs,
    fats: updatedMeal.nutrition?.fat ?? currentMeal.fats,
    badges: updatedMeal.badges ?? currentMeal.badges,
  } as T;
}