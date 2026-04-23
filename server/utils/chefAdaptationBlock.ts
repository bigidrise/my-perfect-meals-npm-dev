/**
 * buildChefAdaptationBlock
 *
 * Returns a diet-aware CHEF ADAPTATION MODE instruction string for inclusion
 * in AI prompts. Each diet gets its own rules — zero cross-contamination.
 *
 * MUST be called AFTER the user is loaded from the database so the diet value
 * is authoritative (not guessed from request body).
 */
export function buildChefAdaptationBlock(diet: string | null): string {
  switch (diet) {
    case "carnivore":
      return `[CHEF ADAPTATION MODE — CARNIVORE: Transform this concept into a purely animal-based version using ONLY: meat, poultry, seafood, eggs, butter, heavy cream, tallow, lard, cheese, or salt. If the original structure cannot exist without plants (e.g. a fruit smoothie → make it a cream-and-egg drink; a salad → make it a meat-and-egg plate; a wrap → use an egg or meat wrapper), change the structure completely while keeping the satisfaction intent. ZERO vegetables, fruits, grains, legumes, nuts, seeds, plant oils, or plant-based seasonings. No coconut, no oat, no cashew. Only animal foods.]`;

    case "vegan":
      return `[CHEF ADAPTATION MODE — VEGAN: Transform this concept into a fully plant-based version. Remove all meat, poultry, seafood, eggs, dairy, and animal-derived products. Replace with whole food plant alternatives: legumes, tofu, tempeh, nuts, seeds, plant milks, vegetables, fruits, and grains. Preserve the flavor profile and texture intent of the original dish.]`;

    case "vegetarian":
      return `[CHEF ADAPTATION MODE — VEGETARIAN: Transform this concept to remove all meat, poultry, and seafood. Eggs and dairy are allowed. Replace animal proteins with eggs, cheese, legumes, or plant proteins. Preserve the flavor and structure of the original dish.]`;

    case "keto":
      return `[CHEF ADAPTATION MODE — KETO: Transform this concept to be strictly low-carb and high-fat (under 10g net carbs total). Replace starchy elements with cauliflower, zucchini noodles, or leafy greens. A smoothie becomes a keto shake with heavy cream, protein powder, and a small amount of low-sugar berries. Emphasize healthy fats and adequate protein. No grains, sugar, starchy vegetables, or fruit juice.]`;

    case "paleo":
      return `[CHEF ADAPTATION MODE — PALEO: Transform this concept to be paleo-compliant. Remove all grains, dairy, legumes, refined sugars, and processed foods. Use whole food proteins (meat, poultry, fish, eggs), vegetables, fruits, nuts, seeds, and healthy fats (olive oil, coconut oil, avocado). Preserve the flavor and satisfaction level of the original.]`;

    case "gluten-free":
      return `[CHEF ADAPTATION MODE — GLUTEN FREE: Transform this concept to be completely gluten-free. Replace wheat, barley, rye, and all gluten-containing ingredients with certified gluten-free alternatives (rice flour, almond flour, oat flour labeled GF, corn tortillas). Preserve texture and flavor.]`;

    case "pescatarian":
      return `[CHEF ADAPTATION MODE — PESCATARIAN: Remove all meat and poultry from this concept. Seafood, fish, eggs, and dairy are allowed. Replace land-animal proteins with fish, shrimp, scallops, or other seafood. Preserve the overall dish structure and flavor profile.]`;

    case "kosher":
      return `[CHEF ADAPTATION MODE — KOSHER: Adapt this dish to kosher standards. Apply meat-dairy separation strictly — do NOT mix meat with dairy in the same meal. If this is a dairy meal, pareve substitutions may be used where needed (coconut cream, oat cream). If this is a meat meal, use only kosher-certified meats and no dairy. No shellfish or pork.]`;

    case "halal":
      return `[CHEF ADAPTATION MODE — HALAL: Adapt this dish to halal standards. Remove pork, alcohol, and non-halal meats. Use halal-certified poultry, beef, or lamb. Preserve the flavor and structure of the original dish.]`;

    default:
      return `[CHEF ADAPTATION MODE: Adapt this dish to better match the user's dietary preferences and goals while maintaining balance, flavor, and nutritional quality.]`;
  }
}
