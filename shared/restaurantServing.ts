import { z } from "zod";
import { convertVolumeDisplay, convertWeightDisplay } from "./units";

const Item = z.object({
  food: z.string().trim().min(1).max(180),
  quantity: z.number().finite().positive().max(10000),
  unit: z.enum(["g", "oz", "ml", "cup", "tbsp", "tsp", "piece"]),
  basis: z.enum(["cooked", "raw", "as_served"]),
  note: z.string().trim().max(300).optional(),
});
const Assumption = z.object({
  label: z.string().trim().min(1).max(200),
  items: z.array(Item).min(1).max(12),
  guidance: z.string().trim().max(500).optional(),
});
const Nutrition = z.object({
  calories: z.number().finite().positive(),
  protein: z.number().finite().nonnegative(),
  carbs: z.number().finite().nonnegative(),
  fat: z.number().finite().nonnegative(),
});
export const RestaurantServingSchema = z.object({
  version: z.literal(1),
  basis: z.enum(["model_estimated", "published_menu_unadjusted"]),
  mealName: z.string().min(1),
  label: z.string().min(1).max(200),
  items: z.array(Item).max(12),
  guidance: z.string().max(500),
  nutrition: Nutrition,
});
export type RestaurantServing = z.infer<typeof RestaurantServingSchema>;
type Meal = { name: string; calories: number; protein: number; carbs: number; fat: number };

/** Freeze a same-call serving assumption, not a nutrient calculation or ingredient
 * verification. Missing quantities never become default weights. */
export function bindRestaurantServing(raw: unknown, meal: Meal): RestaurantServing | undefined {
  if (!Nutrition.safeParse(meal).success) return undefined;
  const parsed = Assumption.safeParse(raw);
  return {
    version: 1, basis: "model_estimated", mealName: meal.name,
    label: parsed.success ? parsed.data.label : "One restaurant serving; size not independently established",
    items: parsed.success ? parsed.data.items : [],
    guidance: parsed.success ? parsed.data.guidance || "Approximate portions and nutrition describe this suggested plate; confirm preparation and serving size."
      : "A measured breakdown was not supplied. Confirm serving size and preparation with the venue; these numbers remain estimates.",
    nutrition: { calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat },
  };
}

/** Reject stale portion metadata after edits, substitutions, or changed macros. */
export function currentRestaurantServing(raw: unknown, meal: Meal): RestaurantServing | undefined {
  const parsed = RestaurantServingSchema.safeParse(raw);
  if (!parsed.success || parsed.data.mealName !== meal.name) return undefined;
  if (!Nutrition.safeParse(meal).success) return undefined;
  return (["calories", "protein", "carbs", "fat"] as const)
    .every(key => parsed.data.nutrition[key] === meal[key]) ? parsed.data : undefined;
}

export function publishedRestaurantServing(meal: Meal): RestaurantServing | undefined {
  const serving = bindRestaurantServing(undefined, meal);
  return serving && { ...serving, basis: "published_menu_unadjusted",
    label: "One source-menu item; portion size not supplied",
    guidance: "Nutrition is copied from the source menu item. Requested changes have not been nutritionally recalculated; confirm the serving and preparation." };
}

export function servingSafetyText(serving?: RestaurantServing): string {
  return serving ? [serving.guidance, serving.label,
    ...serving.items.map(item => `${item.food} ${item.note || ""}`)].join(" ") : "";
}

export function displayRestaurantPortion(item: z.infer<typeof Item>): string {
  const amount = item.unit === "g" ? convertWeightDisplay(item.quantity, "imperial")
    : item.unit === "ml" ? convertVolumeDisplay(item.quantity, "imperial")
    : `${Number(item.quantity.toFixed(2))} ${item.unit === "piece" ? item.quantity === 1 ? "piece" : "pieces" : item.unit}`;
  return `about ${amount}${item.basis === "as_served" ? "" : ` ${item.basis}`}`;
}

export const RESTAURANT_SERVING_INSTRUCTIONS = `
SERVING CONTRACT: Nutrition and portions must describe the SAME single suggested plate,
including sides, sauces and oil. Never attach quantities to an unrelated generic macro
estimate or reverse-engineer them from calories. Do not claim independent calculation
or verified restaurant ingredients. When you can support coherent approximate quantities,
add "serving":{"label":"one suggested plate","items":[{"food":"actual plate component",
"quantity":number,"unit":"oz|cup|tbsp|tsp|piece|g|ml","basis":"cooked|raw|as_served",
"note":"optional preparation note"}],"guidance":"profile-appropriate serving advice"}.
These are fields, NOT default quantities. Prefer oz for proteins, cups for starches and
vegetables, tablespoons for sauces, or defined pieces. Do not convert weight to volume.
If unsupported, use serving:null; give no fabricated weights. Preserve all existing
clinical, allergy, dietary, and remaining-budget rules. Return no extra model call.
`;
