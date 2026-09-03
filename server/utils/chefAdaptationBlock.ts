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
      return `[CHEF ADAPTATION MODE — CARNIVORE: Transform this concept into a purely animal-based version. Use ONLY: meat, poultry, seafood, eggs, butter, heavy cream, tallow, lard, cheese, or salt. ZERO plant-based ingredients — no vegetables, fruits, grains, legumes, nuts, seeds, plant oils, coconut, oat, or cashew.

STRUCTURE PRESERVATION RULES:
- If the original request was a smoothie, shake, or drink: KEEP IT AS A DRINK. Do NOT convert it to a meal.
- If the original was a salad: make it a meat-and-egg plate.
- If the original was a wrap: use an egg or meat wrapper.
- Preserve the satisfaction intent of the original structure where possible.

SMOOTHIE / DRINK QUALITY RULES (apply whenever the result is a beverage):
- The result MUST be smooth, drinkable, and emulsified — it must resemble a shake or drink, not a paste or melted fat.
- PRIMARY BASES (use these as the foundation): egg yolks, whole eggs, heavy cream.
- SECONDARY ADD-INS (small amounts only): butter (1 tbsp max), light cheese.
- DO NOT use tallow, lard, or rendered fat as the primary ingredient of a drink — these are cooking fats, not beverage bases.
- DO NOT blend straight butter alone — small amounts may be added for richness, not as the main component.
- The result must have a texture a person would actually drink willingly.

MACRO BALANCE RULES (critical — apply to every drink result):
- Calorie target: 400–800 kcal per serving. Do NOT exceed 800 kcal in a single drink.
- Fat target: 30g–70g per serving. Do NOT exceed 70g fat in a single drink.
- Protein floor: minimum 30g–50g protein per drink.
- If fat would exceed 70g, reduce cream or butter quantity first — protein must not drop below 30g.
- The ratio must feel like a functional daily drink, not a liquid fat bomb.

INGREDIENT BALANCE:
- Eggs and egg whites are the primary protein anchor — use 2–4 whole eggs, or a mix of whole eggs and egg whites.
- Heavy cream supports texture — use in moderate amounts (2–3 oz maximum), not as the dominant ingredient.
- Butter is a finishing touch only — 1 tablespoon maximum. Do not use butter as a significant calorie source.
- Do not build a drink that is mostly cream or liquid fat with minimal protein.

VARIATION REQUIREMENT (when generating multiple options):
- Each option must use a noticeably different ingredient emphasis. Do NOT repeat the same base combination.
- Include at least one lighter, more practical option — lower calorie and more drinkable than the others.
- Option variety examples: one egg-forward with more protein, one cream-forward with moderate fat, one lighter and simpler version.
- Avoid generating three versions that all feel like heavy cream bombs.

PORTION REALISM:
- The serving must reflect a realistic single drink (8–14 oz blended volume).
- If the calorie count would exceed 800 kcal, reduce ingredient quantities — do not compensate by adding more ingredients.
- Ask: "Would a real person on carnivore drink this regularly?" If no, reduce until the answer is yes.

NAMING RULES:
- Name the result based on what it actually is, not what was requested.
- Good examples: "Whipped Egg and Cream Smoothie", "Carnivore Egg White Protein Shake", "Salted Yolk and Cream Drink".
- Bad examples: "Beef Tallow Smoothie", "Butter Smoothie", "Carnivore Berry Smoothie".

FINAL CHECK: The output must pass — drinkable texture, fat under 70g, protein over 30g, calories under 800, and at least one option that feels lighter and practical for daily use.]`;

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
