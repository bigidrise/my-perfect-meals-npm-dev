import type { Meal } from "@/components/MealCard";

export type Reason = { label: string; tag?: "diet"|"portion"|"variety"|"time"|"staples"|"shopping"|"reset" };

export function getWeekWhy(opts: {
  diet: "any"|"vegetarian"|"vegan"; 
  quick?: boolean; 
  staples?: string[];
}): Reason[] {
  const out: Reason[] = [];
  out.push({ label: "Rotates proteins and cooking methods for variety.", tag: "variety" });
  if (opts.quick) out.push({ label: "Prefers quick recipes this week.", tag: "time" });
  if (opts.diet !== "any") out.push({ label: `Fits your ${opts.diet} diet settings.`, tag: "diet" });
  if (opts.staples?.length) out.push({ label: `Biases toward your staples: ${opts.staples.join(", ")}.`, tag: "staples" });
  out.push({ label: "Portions are scaled to your targets.", tag: "portion" });
  return out;
}

export function getMealWhy(meal: Meal, ctx: {
  diet: "any"|"vegetarian"|"vegan"; 
  proteinBand?: [number, number];
  quick?: boolean; 
  matchedStaple?: string; 
  avoided?: string[];
}): Reason[] {
  const rs: Reason[] = [];
  if (ctx.diet !== "any") rs.push({ label: `Matches your ${ctx.diet} preference.`, tag: "diet" });
  if (ctx.proteinBand) rs.push({ label: `Hits your ${meal.title ? "meal" : "slot"} protein band (${ctx.proteinBand[0]}–${ctx.proteinBand[1]}g).`, tag: "portion" });
  if (ctx.quick) rs.push({ label: "Quick to make (~15–20 min).", tag: "time" });
  if (ctx.matchedStaple) rs.push({ label: `Uses your staple: ${ctx.matchedStaple}.`, tag: "staples" });
  if (ctx.avoided?.length) rs.push({ label: `Avoids your exclusions: ${ctx.avoided.join(", ")}.`, tag: "diet" });
  return rs;
}

export const getSnackWhy = (n: number): Reason[] => ([
  { label: `You chose ${n} snack${n!==1?"s":""}/day; we spread calories to curb cravings.`, tag: "portion" }
]);

export const getShoppingListWhy = (): Reason[] => ([
  { label: "Merged duplicates and converted units to tidy amounts.", tag: "shopping" },
  { label: "Pantry items are separate—hide what you already have.", tag: "shopping" },
]);

export const getMidnightResetWhy = (tz: string): Reason[] => ([
  { label: `Daily totals reset at midnight (${tz}) to keep charts accurate.`, tag: "reset" },
]);

export const getWeeklyPlanningWhy = (): Reason[] => ([
  { label: "Ensures variety by rotating protein sources and cooking methods.", tag: "variety" },
  { label: "Streamlines grocery shopping with a complete ingredients list.", tag: "shopping" },
  { label: "Balances macros across the entire week for better nutrition.", tag: "portion" },
]);

export const getTemplateLibraryWhy = (): Reason[] => ([
  { label: "Quick picks you can add; personal planning comes from Build My Week.", tag: "variety" },
]);

export const getFridgeRescueWhy = (pantryItems: string[]): Reason[] => {
  const reasons: Reason[] = [];
  if (pantryItems.length > 0) {
    reasons.push({ label: `Uses ingredients you already have: ${pantryItems.join(", ")}.`, tag: "shopping" });
  }
  reasons.push({ label: "Suggests meals that avoid your dietary restrictions.", tag: "diet" });
  reasons.push({ label: "Helps reduce food waste by using existing pantry items.", tag: "shopping" });
  return reasons;
};