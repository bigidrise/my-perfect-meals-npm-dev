import type { Meal } from "@/components/MealCard";
import type { SavedMealRow } from "@/hooks/useSavedMeals";

export function savedMealToMeal(row: SavedMealRow): Meal {
  const d = (row.mealData || {}) as any;
  return {
    id: `fav-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    name: d?.name || d?.title || row.title,
    title: row.title,
    description: d?.description,
    ingredients: d?.ingredients ?? d?.recipe?.ingredients ?? [],
    instructions: d?.instructions ?? d?.recipe?.instructions ?? d?.steps ?? [],
    nutrition: d?.nutrition,
    imageUrl: d?.imageUrl,
    cookingTime: d?.cookingTime,
    difficulty: d?.difficulty,
    dietClassification: d?.dietClassification ?? null,
    builderType: row.sourceType,
    badges: d?.badges,
    medicalBadges: d?.medicalBadges,
  };
}
