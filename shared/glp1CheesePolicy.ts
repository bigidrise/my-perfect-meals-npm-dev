import { parseMeasurementNumber } from "./units";
import { ingredientMeasurementUnit } from "./ingredientMeasurements";

export const GLP1_CHEESE_TERMS = [
  "cheese", "cheeses", "queso", "quesos", "requeson", "cheddar", "mozzarella",
  "parmesan", "parmesano", "swiss", "suizo", "gouda", "provolone", "feta",
  "brie", "camembert", "velveeta", "mascarpone", "ricotta", "roquefort",
  "manchego", "gruyere", "edam", "halloumi", "paneer", "cotija", "oaxaca",
] as const;
const CHEESE_PATTERN = new RegExp(`\\b(?:${GLP1_CHEESE_TERMS.join("|")})\\b`);

/** Culinary recognition only. Never an allergen, dietary, or clinical clearance. */
export function isGLP1CompositionSensitiveCheese(name: string): boolean {
  const text = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\bswiss chard\b/g, "");
  return CHEESE_PATTERN.test(text);
}

/** No count/density assumptions: slices, handfuls and package servings are not a measured recipe amount. */
export function hasMeasuredCheeseQuantity(ingredient: {
  quantity?: string; amount?: string | number; unit?: string;
}): boolean {
  const amount = parseMeasurementNumber(ingredient.quantity ?? ingredient.amount ?? "");
  return amount !== null && Number.isFinite(amount) && amount > 0 &&
    ["g", "kg", "mg", "oz", "lb", "cup", "tbsp", "tsp", "ml", "l", "fl oz"]
      .includes(ingredientMeasurementUnit(ingredient.unit ?? ""));
}

/**
 * Shared interpretation contract, not new nutrition authority. The final meal
 * still passes each consumer's existing safety and per-serving nutrition gates.
 */
export const GLP1_CHEESE_ADAPTATION_GUIDANCE = `GLP-1 CHEESE — PORTION AND COMPOSITION:
Cheese, including full-fat cheese, is not prohibited by its name or GLP-1 status alone.
Preserve the requested dish and its cheese identity. Choose an appropriate type and an exact measured quantity; lower-fat cheese is an option, not automatic clearance.
Evaluate the cheese contribution at that quantity together with ALL other ingredients, using the existing whole-meal per-serving fat allowance and protein requirements. Never raise a limit or change reported nutrition just to pass.
State whether ingredient quantities are recipe totals and divide nutrition by the actual serving count exactly once. There is no universal cheese portion, including no automatic three-ounce allowance.
Explain meaningful type or quantity adaptations briefly in the customer's language. Do not silently replace the dish or omit its requested cheese.
Allergies (including milk), dietary exclusions, explicit avoidances, verified physician directives, and independent limits still apply. Cheese recognition never overrides them.`;

export const GLP1_CHEESE_PRODUCT_GUIDANCE = `${GLP1_CHEESE_ADAPTATION_GUIDANCE}
PRODUCT EVIDENCE AND INTENDED USE:
Use the exact product/variant's supported nutrition, ingredients, allergen statements and serving basis. A brand, cheese name or low-fat claim is not evidence of compatibility.
The package serving is NOT automatically the intended recipe/eating portion. Scale supported label facts only when the planned quantity and label basis have a valid conversion; never assume slice weight or cheese volume density.
If intended quantity, whole-meal nutrition, required product facts or applicable authority is missing, say what is unknown rather than inventing an amount, threshold or compatibility claim. Offer a useful comparison without claiming verified fit.
Preserve the original recipe quantity, units, qualifiers and provenance in shopping handoffs. Changing the product does not authorize changing the recipe portion. Known conflicts remain blocked.`;
