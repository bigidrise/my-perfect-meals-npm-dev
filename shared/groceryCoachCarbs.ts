/** Recipe estimates, not dietary fiber or a prescribed daily carb ratio. */
export const GROCERY_COACH_CARB_PROMPT = `
CARBOHYDRATE BREAKDOWN:
All macros are totals for the complete recipe, across all meal.servings, not per-serving values. Keep meal.servings consistent with the ingredient quantities and requested serving count; the UI divides recipe totals to display and log one serving.
Include macros.starchyCarbs and macros.fibrousCarbs (grams, number or null).
Estimate these from the actual ingredient quantities, on the SAME serving basis as macros.carbs.
Fibrous carbs are carbohydrate grams from non-starchy vegetables (such as spinach, broccoli, asparagus, zucchini, and cauliflower rice), NOT dietary fiber grams. Fruit is not fibrous carbs in this app.
Starchy carbs include grains, bread, pasta, potatoes, legumes, and sugary carbohydrate sources.
Never use an ingredient-count ratio, a fixed percentage, dietary fiber, or a daily target to invent this breakdown.
Use null if a category cannot be estimated. Zero means the recipe genuinely contains none.
Each category must be nonnegative and no greater than total carbs; their combined grams must not exceed total carbs. Do not assign unclassified carbohydrates by subtraction.
Recalculate both categories whenever ingredients or quantities change.`;

export function groceryCoachCarbBreakdown(macros: {
  carbs?: unknown; starchyCarbs?: unknown; fibrousCarbs?: unknown;
} | null | undefined): { starchyCarbs: number | null; fibrousCarbs: number | null } {
  const valid = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0;
  const carbs = macros?.carbs;
  if (!valid(carbs)) return { starchyCarbs: null, fibrousCarbs: null };
  const starchyCarbs = valid(macros?.starchyCarbs) && macros.starchyCarbs <= carbs ? macros.starchyCarbs : null;
  const fibrousCarbs = valid(macros?.fibrousCarbs) && macros.fibrousCarbs <= carbs ? macros.fibrousCarbs : null;
  if (starchyCarbs !== null && fibrousCarbs !== null && starchyCarbs + fibrousCarbs > carbs + 0.01) {
    return { starchyCarbs: null, fibrousCarbs: null };
  }
  return { starchyCarbs, fibrousCarbs };
}
