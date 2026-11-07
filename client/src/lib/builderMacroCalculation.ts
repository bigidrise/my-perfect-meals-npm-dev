import { groceryCoachCatalogEnabled } from "@/lib/groceryCoachCatalogGate";
import { deriveSplitCarbs } from "@/utils/ingredientClassifier";

export const BUILDER_MACRO_KEYS = [
  "calories", "protein", "carbs", "starchyCarbs", "fibrousCarbs", "fat",
] as const;
export type BuilderMacroKey = typeof BUILDER_MACRO_KEYS[number];

export interface BuilderMacroSummary {
  calories: number;
  protein: number;
  carbs: number;
  starchyCarbs: number;
  fibrousCarbs: number;
  fat: number;
  unclassifiedCarbs: number;
  count: number;
  uncertainFields: BuilderMacroKey[];
  estimated: boolean;
  issues: string[];
}

const number = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "" ||
    (typeof value !== "number" && typeof value !== "string")) return null;
  if (typeof value === "string" && !value.trim()) return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
};

/**
 * Read-only Builder display contract:
 * - nested nutrition/macros wins over legacy top-level values, including genuine zero;
 * - stored macros are recipe totals unless explicitly labelled per-serving;
 * - display one serving, or an explicit consumedServings portion; never round before summing;
 * - retain source splits and unclassified carbs; never derive a missing category by subtraction;
 * - the existing MealCard ingredient estimator is the only fallback, labelled estimated;
 * - contradictions/invalid serving evidence remain visibly incomplete, not fabricated nutrition.
 * This does not change saved records, generation, targets, or clinical accounting.
 */
export function builderMealMacros(meal: any): BuilderMacroSummary {
  const preserveUnknownGrocery = groceryCoachCatalogEnabled && meal?.groceryCoachNutritionHandoff === true;
  const nutrition = meal?.nutrition ?? meal?.macros ?? {};
  const read = (key: string, ...aliases: string[]) => {
    for (const source of [nutrition, meal ?? {}]) {
      for (const field of [key, ...aliases]) {
        if (source[field] !== undefined) return number(source[field]);
      }
    }
    return null;
  };
  const issues: string[] = [];
  const uncertain = new Set<BuilderMacroKey>();
  const yields = [meal?.servings, meal?.meal?.servings, meal?.servingCount, meal?.totalSlices]
    .filter(value => value !== undefined && value !== null);
  const servings = yields.length ? number(yields[0]) : 1;
  const portion = number(meal?.consumedServings ?? 1);
  const basis = meal?.nutritionBasis ?? "recipe-total";
  const invalidServing = !servings || portion === null ||
    yields.some(value => number(value) !== servings) ||
    !["recipe-total", "per-serving"].includes(basis);
  if (invalidServing) {
    issues.push("Serving information needs review");
    BUILDER_MACRO_KEYS.forEach(key => uncertain.add(key));
  }
  const multiplier = invalidServing ? 0 : portion! / (basis === "per-serving" ? 1 : servings!);
  const carbs = read("carbs", "carbohydrates", "carbs_g");
  const protein = read("protein", "protein_g");
  const fat = read("fat", "fat_g");
  const calories = read("calories") ??
    (protein !== null && carbs !== null && fat !== null ? protein * 4 + carbs * 4 + fat * 9 : null);
  let starchy = read("starchyCarbs");
  let fibrous = read("fibrousCarbs");
  let estimated = false;
  const invalidSplitValue = ["starchyCarbs", "fibrousCarbs"].some(key => {
    const value = Object.prototype.hasOwnProperty.call(nutrition, key) ? nutrition[key] : meal?.[key];
    return value !== null && value !== undefined && number(value) === null;
  });
  const invalidSplit = invalidSplitValue || (carbs !== null && (
    (starchy !== null && starchy > carbs + 0.01) ||
    (fibrous !== null && fibrous > carbs + 0.01) ||
    (starchy !== null && fibrous !== null && starchy + fibrous > carbs + 0.01)
  ));
  if (invalidSplit) {
    starchy = fibrous = null;
    issues.push("Stored carbohydrate categories need review");
  } else if (!preserveUnknownGrocery && starchy === null && fibrous === null && carbs !== null &&
    Array.isArray(meal?.ingredients) && meal.ingredients.length > 0 &&
    meal.ingredients.every((ingredient: unknown) =>
      typeof ingredient === "string" || (ingredient !== null && typeof ingredient === "object"))) {
    // Use exactly the existing MealCard policy, not a new target-based ratio.
    const split = deriveSplitCarbs(meal.ingredients, carbs);
    if (split.starchyCarbs + split.fibrousCarbs > 0 || carbs === 0) {
      starchy = split.starchyCarbs;
      fibrous = split.fibrousCarbs;
      estimated = true;
    }
  }
  if (carbs === 0 && !invalidSplit && !preserveUnknownGrocery) {
    starchy ??= 0;
    fibrous ??= 0;
  }
  const source = { calories, protein, carbs, starchyCarbs: starchy, fibrousCarbs: fibrous, fat };
  const result = {} as Record<BuilderMacroKey, number>;
  for (const key of BUILDER_MACRO_KEYS) {
    if (source[key] === null) uncertain.add(key);
    result[key] = (source[key] ?? 0) * multiplier;
  }
  if (uncertain.size && !issues.length) issues.push("Some nutrition values are unknown");
  return {
    ...result, count: 1, uncertainFields: [...uncertain], estimated, issues,
    unclassifiedCarbs: carbs === null ? 0 : Math.max(0, carbs - (starchy ?? 0) - (fibrous ?? 0)) * multiplier,
  };
}

export function summarizeBuilderMeals(meals: readonly unknown[]): BuilderMacroSummary {
  const result: BuilderMacroSummary = {
    calories: 0, protein: 0, carbs: 0, starchyCarbs: 0, fibrousCarbs: 0, fat: 0,
    unclassifiedCarbs: 0, count: meals.length, uncertainFields: [], estimated: false, issues: [],
  };
  for (const meal of meals) {
    const snapshot = builderMealMacros(meal);
    for (const key of BUILDER_MACRO_KEYS) result[key] += snapshot[key];
    result.unclassifiedCarbs += snapshot.unclassifiedCarbs;
    result.uncertainFields = [...new Set([...result.uncertainFields, ...snapshot.uncertainFields])];
    result.issues = [...new Set([...result.issues, ...snapshot.issues])];
    result.estimated ||= snapshot.estimated;
  }
  return result;
}

/** Include all six meal slots AND the separate snack list, exactly once. */
export function summarizeBuilderDay(lists: Partial<Record<
  "breakfast" | "lunch" | "dinner" | "meal4" | "meal5" | "meal6" | "snacks",
  readonly unknown[]
>>): BuilderMacroSummary {
  return summarizeBuilderMeals([
    ...(lists.breakfast ?? []), ...(lists.lunch ?? []), ...(lists.dinner ?? []),
    ...(lists.meal4 ?? []), ...(lists.meal5 ?? []), ...(lists.meal6 ?? []),
    ...(lists.snacks ?? []),
  ]);
}

/** Preserve the existing day-lock slot contract, with extra meals kept explicitly. */
export function summarizeBuilderSlots(lists: Parameters<typeof summarizeBuilderDay>[0]) {
  return {
    breakfast: summarizeBuilderMeals(lists.breakfast ?? []),
    lunch: summarizeBuilderMeals(lists.lunch ?? []),
    dinner: summarizeBuilderMeals(lists.dinner ?? []),
    meal4: summarizeBuilderMeals(lists.meal4 ?? []),
    meal5: summarizeBuilderMeals(lists.meal5 ?? []),
    meal6: summarizeBuilderMeals(lists.meal6 ?? []),
    snacks: summarizeBuilderMeals(lists.snacks ?? []),
  };
}

export function formatBuilderMacro(value: number, incomplete = false): string {
  return `${incomplete ? "≥ " : ""}${Math.round((value + Number.EPSILON) * 100) / 100}`;
}

export function remainingBuilderMacro(target: number, consumed: number): number {
  return target - consumed;
}
