import { z } from "zod";
import { convertVolumeDisplay, convertWeightDisplay } from "./units";
import type { AwayFromHomeRecommendation } from "./awayFromHome";

/** The established Buffet food/portion/note contract, also used by restaurants. */
export type PlateItem = NonNullable<AwayFromHomeRecommendation["buffetItems"]>[number];
const PlateItems = z.array(z.object({
  food: z.string().trim().min(1).max(180),
  portion: z.string().trim().min(1).max(180).refine(value =>
    /^(?:(?:about|approximately)\s+|~\s*)?(?:\d+(?:[./]\d+)?(?:\s+\d+\/\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])\s*(?:oz\b|ounces?\b|g\b|grams?\b|ml\b|milliliters?\b|cups?\b|tbsp\b|tablespoons?\b|tsp\b|teaspoons?\b|pieces?\b|small\b|medium\b|large\b|wedges?\b|slices?\b|patt(?:y|ies)\b|tortillas?\b|buns?\b|eggs?\b|fillets?\b)/i.test(value),
    "A practical quantity and unit or defined piece size are required").refine(value => {
      const number = value.replace(/^(?:(?:about|approximately)\s+|~\s*)/i, "").match(/^(\d+(?:\.\d+)?)(?:\/(\d+))?/);
      return !number || (Number(number[1]) > 0 && (!number[2] || Number(number[2]) > 0));
    }, "Quantities must be positive"),
  note: z.string().trim().max(300).nullish().transform(value => value ?? undefined),
})).min(1).max(12);

const Item = z.object({
  food: z.string().trim().min(1).max(180),
  quantity: z.number().finite().positive().max(10000),
  unit: z.enum(["g", "oz", "ml", "cup", "tbsp", "tsp", "piece"]),
  basis: z.enum(["cooked", "raw", "as_served"]),
  note: z.string().trim().max(300).optional(),
});
const Nutrition = z.object({
  calories: z.number().finite().positive(),
  protein: z.number().finite().nonnegative(),
  carbs: z.number().finite().nonnegative(),
  fat: z.number().finite().nonnegative(),
});
export const RestaurantServingSchema = z.object({
  version: z.literal(2),
  basis: z.enum(["model_estimated", "published_menu_unadjusted"]),
  mealName: z.string().min(1),
  status: z.enum(["complete", "model_omitted", "unknown", "published"]),
  buffetItems: z.array(z.object({ food: z.string(), portion: z.string(), note: z.string().optional() })).max(12),
  portionGuidance: z.string().max(1000),
  nutrition: Nutrition,
}).refine(value => value.status !== "complete" || PlateItems.safeParse(value.buffetItems).success,
  "A complete suggested plate needs valid food-by-food quantities");
export type RestaurantServing = z.infer<typeof RestaurantServingSchema>;
type Meal = { name: string; calories: number; protein: number; carbs: number; fat: number };

/** Freeze a same-call serving assumption, not a nutrient calculation or ingredient
 * verification. Missing quantities never become default weights. */
export function bindRestaurantServing(raw: unknown, meal: Meal): RestaurantServing | undefined {
  if (!Nutrition.safeParse(meal).success) return undefined;
  const data = raw as Record<string, unknown> | null | undefined;
  const parsed = PlateItems.safeParse(data?.buffetItems);
  const guidance = typeof data?.portionGuidance === "string" ? data.portionGuidance.trim().slice(0, 500) : "";
  const unknown = data?.portionStatus === "unknown" && typeof data?.portionReason === "string" && data.portionReason.trim();
  return {
    version: 2, basis: "model_estimated", mealName: meal.name,
    status: parsed.success ? "complete" : unknown ? "unknown" : "model_omitted",
    buffetItems: parsed.success ? parsed.data.map(item => ({ ...item, portion: practicalPortion(item.portion) })) : [],
    portionGuidance: parsed.success ? guidance || "Suggested quantities and nutrition are estimates for this entire plate, including sides and sauces."
      : unknown ? `Portion unknown: ${String(data?.portionReason).slice(0, 400)}. Limited recommendation; serving nutrition is not established.`
        : "Portion breakdown unavailable: the model did not supply valid food-by-food quantities. This is a limited recommendation, not an established plate. Confirm portions before using its nutrition estimates.",
    nutrition: { calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat },
  };
}

/** Reject stale portion metadata after edits, substitutions, or changed macros. */
export function currentRestaurantServing(raw: unknown, meal: Meal): RestaurantServing | undefined {
  let parsed = RestaurantServingSchema.safeParse(raw);
  // Read-only compatibility for already-saved serving metadata, not a second
  // generation contract. No database migration or replacement quantities.
  const legacy = raw as any;
  if (!parsed.success && legacy?.version === 1 && Array.isArray(legacy.items)) {
    const items = z.array(Item).safeParse(legacy.items);
    if (items.success) parsed = RestaurantServingSchema.safeParse({
      version: 2, basis: legacy.basis, mealName: legacy.mealName, nutrition: legacy.nutrition,
      status: legacy.basis === "published_menu_unadjusted" ? "published" : items.data.length ? "complete" : "model_omitted",
      buffetItems: items.data.map(item => ({ food: item.food, portion: displayRestaurantPortion(item), note: item.note })),
      portionGuidance: items.data.length ? legacy.guidance || "" : "Portion breakdown unavailable in this saved recommendation.",
    });
  }
  if (!parsed.success || parsed.data.mealName !== meal.name) return undefined;
  if (!Nutrition.safeParse(meal).success) return undefined;
  return (["calories", "protein", "carbs", "fat"] as const)
    .every(key => parsed.data.nutrition[key] === meal[key]) ? parsed.data : undefined;
}

export function publishedRestaurantServing(meal: Meal): RestaurantServing | undefined {
  const serving = bindRestaurantServing(undefined, meal);
  return serving && { ...serving, basis: "published_menu_unadjusted",
    status: "published",
    portionGuidance: "Nutrition is copied from the source menu item. Requested changes have not been nutritionally recalculated; confirm the published serving and preparation." };
}

export function servingSafetyText(serving?: RestaurantServing): string {
  return serving ? [serving.portionGuidance,
    ...serving.buffetItems.map(item => `${item.food} ${item.portion} ${item.note || ""}`)].join(" ") : "";
}

function practicalPortion(portion: string): string {
  const known = portion.match(/^(\d+(?:\.\d+)?)\s*(g|grams?|ml|milliliters?)\b(.*)$/i);
  if (!known) return portion;
  const amount = Number(known[1]);
  const converted = /^(g|grams?)$/i.test(known[2])
    ? convertWeightDisplay(amount, "imperial") : convertVolumeDisplay(amount, "imperial");
  return `about ${converted}${known[3]}`;
}

export function displayRestaurantPortion(item: z.infer<typeof Item>): string {
  const amount = item.unit === "g" ? convertWeightDisplay(item.quantity, "imperial")
    : item.unit === "ml" ? convertVolumeDisplay(item.quantity, "imperial")
    : `${Number(item.quantity.toFixed(2))} ${item.unit === "piece" ? item.quantity === 1 ? "piece" : "pieces" : item.unit}`;
  return `about ${amount}${item.basis === "as_served" ? "" : ` ${item.basis}`}`;
}

export const RESTAURANT_SERVING_INSTRUCTIONS = `
REQUIRED PLATE CONTRACT (the existing Buffet format): Nutrition and portions must describe the SAME single suggested plate,
including sides, sauces and oil. Never attach quantities to an unrelated generic macro
estimate or reverse-engineer them from calories. Do not claim independent calculation
or verified restaurant ingredients. For EACH ordinary cuisine-based meal, first construct
the suggested plate, then estimate nutrition FOR THAT ENTIRE PLATE. Return REQUIRED
"buffetItems":[{"food":"plate component","portion":"quantity + practical unit + cooked/raw basis where relevant","note":"preparation guidance"}]
and "portionGuidance":"profile-appropriate guidance for this suggested plate".
Include every meaningful component, sides, sauces, and oils in the same serving assumptions.
Do NOT return the old optional serving/items object. Use ounces for meat/fish/poultry,
cups for starches/vegetables, tablespoons for sauces and defined small/medium pieces
or wedges when appropriate. Do not default to grams. No default amounts or weight-to-volume
conversions. Ordinary tacos, burgers with sides, and buffet plates REQUIRE practical quantities;
"one restaurant serving" is NOT a plate breakdown. If genuinely unable to estimate,
return buffetItems:[], portionStatus:"unknown", portionReason explaining why.
Omitted or invalid quantities are a generation failure, not a successful serving.
Preserve all existing clinical, allergy, dietary, and remaining-budget rules.
`;
