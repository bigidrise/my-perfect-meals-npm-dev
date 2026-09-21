export function resolveNutritionSummaryCardData<T>(
  source: "self" | "provided",
  provided: T | null | undefined,
  self: T | null | undefined,
): T | null | undefined {
  return source === "provided" ? provided : (provided ?? self);
}