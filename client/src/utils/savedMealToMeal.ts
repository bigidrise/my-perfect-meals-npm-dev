import type { Meal } from "@/types/meal";
import type { SavedMealRow } from "@/hooks/useSavedMeals";
import type { DiabeticMemoryContext } from "@/lib/diabeticMemory";

export function savedMealToMeal(row: SavedMealRow): Meal {
  const d = (row.mealData || {}) as any;

  const savedMemory = isStoredDiabeticMemory(d.diabeticMemory)
    ? d.diabeticMemory
    : undefined;
  const diabeticMemory =
    savedMemory?.version === 2 ||
    (row.savedFromDiabeticBuilder && savedMemory?.version === 1)
      ? savedMemory
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

function isStoredDiabeticMemory(value: unknown): value is DiabeticMemoryContext {
  if (!value || typeof value !== "object") return false;
  const memory = value as Record<string, unknown>;
  const hasCommonFields =
    typeof memory.glucoseContext === "string" &&
    typeof memory.protocolTypeLabel === "string" &&
    typeof memory.generatedAt === "string" &&
    memory.source === "diabetic-builder";
  if (!hasCommonFields) return false;
  if (memory.version === 1) return typeof memory.generatedBglMgdl === "number";
  if (memory.version !== 2) return false;

  return (
    (memory.generatedBglMgdl === null || typeof memory.generatedBglMgdl === "number") &&
    typeof memory.bglBucket === "string" &&
    typeof memory.recommendedBglRange === "string" &&
    (memory.readingRecordedAt === null || typeof memory.readingRecordedAt === "string") &&
    (memory.readingSource === null || memory.readingSource === "LOG" || memory.readingSource === "SETTINGS") &&
    (memory.glucoseState === "LOW" || memory.glucoseState === "IN_RANGE" ||
      memory.glucoseState === "HIGH" || memory.glucoseState === "STALE" ||
      memory.glucoseState === "NONE") &&
    memory.policyVersion === "diabetic-generation-v2"
  );
}
