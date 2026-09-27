import { FIBROUS_KEYWORDS } from "./fibrousKeywords";
import { STARCHY_KEYWORDS } from "./starchKeywords";

/**
 * Food-source categories used by the product's Low Carb policy.
 *
 * These categories describe ingredient roles; they do not estimate grams or
 * replace the Macro Calculator's total-carbohydrate target.
 */
export type CarbohydrateSourceCategory =
  | "non_starchy_fibrous"
  | "starchy_concentrated"
  | "added_sugar"
  | "fruit"
  | "legume"
  | "dairy_source"
  | "dairy_carbohydrate"
  | "sauce_condiment"
  | "mixed_food"
  | "non_carb_ingredient"
  | "unknown";

export interface CarbohydrateSourceClassification {
  category: CarbohydrateSourceCategory;
  ingredient: string;
  /** Non-core groups need explicit nutrition/context before source-policy proof. */
  requiresExplicitEvidence: boolean;
  reason?: string;
}

const ADDED_SUGAR_PATTERN =
  /\b(sugar|sucrose|glucose|dextrose|fructose|corn syrup|high[\s-]fructose|maple syrup|agave|honey|molasses|nectar|syrup|juice concentrate|sweetened)\b/i;
const EXPLICITLY_UNSWEETENED_PATTERN =
  /\b(sugar[\s-]?free|no[\s-]+added[\s-]+sugar|unsweetened|without[\s-]+added[\s-]+sugar)\b/i;
const SAUCE_PATTERN =
  /\b(sauce|dressing|marinade|glaze|syrup|salsa|condiment|spread|dip|bbq|barbecue|buffalo sauce|teriyaki|ketchup|mustard|chutney|sriracha|hot sauce)\b/i;
const MIXED_FOOD_PATTERN =
  /\b(casserole|stew|soup|salad|bowl|sandwich|burger|pizza|pie|lasagna|meal|entrée|entree|mixed dish|stir[\s-]?fry|curry|wrap)\b/i;
const LEGUME_PATTERN =
  /\b(bean|beans|lentil|lentils|chickpea|chickpeas|garbanzo|hummus|edamame|pea|peas|split pea|fava|lupini)\b/i;
const FRUIT_PATTERN =
  /\b(apple|apricot|avocado|banana|berr(?:y|ies)|blackberr(?:y|ies)|blueberr(?:y|ies)|cherr(?:y|ies)|citrus|cranberr(?:y|ies)|date|fig|grape|grapefruit|guava|kiwi|lemon|lime|lychee|mango|melon|nectarine|orange|papaya|peach|pear|pineapple|plum|pomegranate|raspberr(?:y|ies)|strawberr(?:y|ies)|watermelon|raisin|fruit)\b/i;
const DAIRY_CARB_PATTERN =
  /\b(milk|yogurt|yoghurt|kefir|buttermilk|whey|lactose|cream|cottage cheese|ricotta|ice cream|oat milk|soy milk|almond milk|rice milk)\b/i;
const PLAIN_CHEESE_PATTERN =
  /^(?:(?:plain|unsweetened|shredded|grated|crumbled|sliced|diced|fresh)\s+)*(?:(?:mild|sharp|aged|extra sharp)\s+)?(?:cheddar|mozzarella|parmesan|parmigiano|gouda|feta|provolone|swiss|brie|camembert|blue|goat|monterey jack|colby|cream|cottage|ricotta|mascarpone|cheese)(?:\s+cheese)?(?:\s+(?:shreds?|crumbles?|slices?))?$/i;
const CHEESE_PATTERN =
  /\b(cheese|cheddar|mozzarella|parmesan|parmigiano|gouda|feta|provolone|swiss|brie|camembert|ricotta|mascarpone)\b/i;
const DISTILLED_VINEGAR_PATTERN =
  /^(?:distilled white|white|apple cider|red wine|white wine) vinegar$/i;
const ROOT_VEGETABLE_GROUP_PATTERN = /\b(root vegetables?|mixed roots?)\b/i;
const GENERIC_VEGETABLE_PATTERN =
  /^(?:(?:roasted|steamed|sauteed|sautéed|grilled|mixed|garden)\s+)?(?:vegetables|veggies)(?:\s+(?:mix|blend))?$/i;
const NON_CARB_INGREDIENT_PATTERN =
  /^(?:water|salt|black pepper|white pepper|peppercorns?|spices?|seasoning|dried herbs?|fresh herbs?|basil|cilantro|coriander|parsley|dill|oregano|thyme|rosemary|cinnamon|paprika|cumin|turmeric|cayenne pepper|chili flakes?|chilli flakes?|garlic powder|onion powder|baking soda|baking powder|yeast)$/i;

function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function includesPhrase(name: string, phrase: string): boolean {
  const escaped = phrase
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(name);
}

function matchesKeywordList(name: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => includesPhrase(name, keyword));
}

function classification(
  ingredient: string,
  category: CarbohydrateSourceCategory,
  requiresExplicitEvidence: boolean,
  reason?: string,
): CarbohydrateSourceClassification {
  return {
    ingredient,
    category,
    requiresExplicitEvidence,
    ...(reason ? { reason } : {}),
  };
}

/**
 * Classify a single ingredient name. This never derives carbohydrate grams.
 *
 * The shared keyword lists remain the source of truth for ordinary non-starchy
 * vegetables and concentrated/starchy foods. Ambiguous foods are intentionally
 * returned separately rather than guessed into the fibrous category.
 */
export function classifyCarbohydrateSource(
  ingredientName: string,
): CarbohydrateSourceClassification {
  const ingredient = typeof ingredientName === "string" ? ingredientName.trim() : "";
  const name = normalizeName(ingredient);
  if (!name) {
    return classification(ingredient, "unknown", true, "Ingredient name is missing.");
  }

  if (EXPLICITLY_UNSWEETENED_PATTERN.test(name)) {
    if (SAUCE_PATTERN.test(name)) {
      return classification(
        ingredient,
        "sauce_condiment",
        true,
        "A sauce still needs its ingredient or nutrition evidence; an unsweetened label alone does not classify its carbohydrate sources.",
      );
    }
  } else if (ADDED_SUGAR_PATTERN.test(name)) {
    return classification(
      ingredient,
      "added_sugar",
      true,
      "Added or concentrated sugar is separate from non-starchy/fibrous sources and may need adaptation.",
    );
  }

  if (MIXED_FOOD_PATTERN.test(name)) {
    return classification(
      ingredient,
      "mixed_food",
      true,
      "A mixed dish name does not identify the source or amount of each carbohydrate-containing component.",
    );
  }

  if (SAUCE_PATTERN.test(name)) {
    return classification(
      ingredient,
      "sauce_condiment",
      true,
      "Sauce and condiment carbohydrate content requires ingredient or nutrition evidence.",
    );
  }

  // A named, plain cheese is an explicit dairy ingredient class. It is neither
  // a fibrous vegetable nor a member of the 70/30 carbohydrate-source split.
  // Sweetened/flavored/processed or otherwise underspecified cheese products
  // continue to require explicit nutrition/context below.
  if (PLAIN_CHEESE_PATTERN.test(name)) {
    return classification(ingredient, "dairy_source", false);
  }

  if (CHEESE_PATTERN.test(name)) {
    return classification(
      ingredient,
      "dairy_carbohydrate",
      true,
      "This dairy product is not an explicitly named plain cheese; its ingredients or nutrition need review.",
    );
  }

  if (LEGUME_PATTERN.test(name)) {
    return classification(
      ingredient,
      "legume",
      true,
      "Legumes require explicit source-context classification rather than being treated as fibrous vegetables.",
    );
  }

  if (DISTILLED_VINEGAR_PATTERN.test(name)) {
    return classification(ingredient, "non_carb_ingredient", false);
  }

  if (FRUIT_PATTERN.test(name)) {
    return classification(
      ingredient,
      "fruit",
      true,
      "Fruit is distinct from non-starchy vegetables and needs explicit source-context classification.",
    );
  }

  if (DAIRY_CARB_PATTERN.test(name)) {
    return classification(
      ingredient,
      "dairy_carbohydrate",
      true,
      "Dairy and plant-milk carbohydrate varies by product and requires explicit evidence.",
    );
  }

  if (ROOT_VEGETABLE_GROUP_PATTERN.test(name)) {
    return classification(
      ingredient,
      "unknown",
      true,
      "A generic root-vegetable label does not identify the specific food.",
    );
  }

  if (GENERIC_VEGETABLE_PATTERN.test(name)) {
    return classification(
      ingredient,
      "unknown",
      true,
      "A generic or mixed-vegetable label does not identify which vegetables are present.",
    );
  }

  if (NON_CARB_INGREDIENT_PATTERN.test(name)) {
    return classification(ingredient, "non_carb_ingredient", false);
  }

  // Phrase-level vegetable overrides must precede the starch keyword list:
  // cauliflower rice, zucchini noodles and similar preparations remain
  // non-starchy vegetables despite a starchy-sounding preparation name.
  if (matchesKeywordList(name, FIBROUS_KEYWORDS)) {
    return classification(ingredient, "non_starchy_fibrous", false);
  }

  if (matchesKeywordList(name, STARCHY_KEYWORDS)) {
    return classification(ingredient, "starchy_concentrated", false);
  }

  return classification(
    ingredient,
    "unknown",
    true,
    "This food is not covered by the current explicit source classifications.",
  );
}

/**
 * Describes source allocation without changing the macro target or equating
 * non-starchy/fibrous food sources with dietary-fiber grams.
 */
export function buildLowCarbSourceGuidance(): string {
  return [
    "LOW CARB SOURCE POLICY: Keep the Macro Calculator's established total-carbohydrate target unchanged; Low Carb does not recalculate it.",
    "Shape carbohydrate-containing foods toward a daily source allocation of 70% non-starchy/fibrous food sources and 30% starchy/concentrated food sources.",
    "This is a food-source allocation, not a dietary-fiber gram target. Never calculate or display the 70% as grams of fiber.",
    "Use the available day and meal allocation context. Do not force an exact 70/30 ratio into each individual meal or recipe.",
    "Use non-starchy/fibrous classifications for vegetables such as cauliflower, broccoli, leafy greens, zucchini, asparagus, and peppers; their naturally occurring carbohydrate alone is not a reason to reject the dish.",
    "Treat grains, rice, pasta, bread, tortillas, potatoes, and other explicitly classified concentrated/starchy ingredients as starchy/concentrated sources.",
    "Keep plain, unflavored cheese in its explicit dairy source class, outside the 70/30 carbohydrate-source allocation; do not count it as non-starchy/fibrous.",
    "Keep added/concentrated sugars distinct from both source groups. Inspect sauces and mixed foods; a sauce is resolved only when its recipe components are explicitly available and classifiable. Adapt a conflicting component while preserving the requested food when reasonably possible.",
    "Do not guess classifications, carbohydrate grams, or compliance from an ingredient name. If a food or nutrition evidence is ambiguous, request explicit evidence or review rather than claiming verification.",
  ].join("\n");
}