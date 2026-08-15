import type { Meal } from "@/types/meal";
import type { SavedMealRow } from "@/hooks/useSavedMeals";
import { buildDiabeticMemory } from "@/lib/diabeticMemory";

export function savedMealToMeal(row: SavedMealRow): Meal {
  const d = (row.mealData || {}) as any;

  const diabeticMemory =
    row.savedFromDiabeticBuilder && row.generatedBglMgdl != null
      ? buildDiabeticMemory(row.generatedBglMgdl, row.glucoseContext ?? "RANDOM")
      : undefined;

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
    ...(diabeticMemory ? { diabeticMemory } : {}),
  };
}
