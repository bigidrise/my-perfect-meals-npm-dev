import { groceryCoachCarbBreakdown } from "@shared/groceryCoachCarbs";

function amount(value: unknown): number | null {
  if (value == null || value === "" || (typeof value !== "number" && typeof value !== "string")) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

/** Read canonical recipe totals; display and log one serving consistently. */
export function mealMacroSnapshot(meal: any) {
  const nutrition = meal?.nutrition ?? meal?.macros ?? {};
  const splitValue = (key: "starchyCarbs" | "fibrousCarbs") =>
    Object.prototype.hasOwnProperty.call(nutrition, key) ? nutrition[key] : meal?.[key];
  const starchy = amount(splitValue("starchyCarbs"));
  const fibrous = amount(splitValue("fibrousCarbs"));
  const carbs = amount(nutrition.carbs ?? nutrition.carbohydrates ?? nutrition.carbs_g ?? meal?.carbs)
    ?? (starchy !== null && fibrous !== null ? starchy + fibrous : 0);
  const protein = amount(nutrition.protein ?? nutrition.protein_g ?? meal?.protein) ?? 0;
  const fat = amount(nutrition.fat ?? nutrition.fat_g ?? meal?.fat) ?? 0;
  const calories = amount(nutrition.calories ?? meal?.calories) ?? protein * 4 + carbs * 4 + fat * 9;
  const servings = Math.max(1, amount(meal?.servings ?? meal?.meal?.servings ?? meal?.servingCount) ?? 1);
  const split = groceryCoachCarbBreakdown({ carbs, starchyCarbs: starchy, fibrousCarbs: fibrous });
  return {
    calories: calories / servings, protein: protein / servings, carbs: carbs / servings, fat: fat / servings,
    starchyCarbs: split.starchyCarbs === null ? null : split.starchyCarbs / servings,
    fibrousCarbs: split.fibrousCarbs === null ? null : split.fibrousCarbs / servings,
    servings,
  };
}
