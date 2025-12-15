export type MealType = "breakfast" | "lunch" | "dinner" | "snacks";

export function openMealByType(
  type: MealType,
  mealId?: string,
  templateSlug?: string
) {
  const q = new URLSearchParams();
  if (mealId) q.set("mealId", mealId);
  if (templateSlug) q.set("template", templateSlug);
  window.location.href = `/meals/${type}?${q.toString()}`;
}