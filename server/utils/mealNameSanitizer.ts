/**
 * Meal Name Sanitizer
 *
 * Post-processes AI-generated meal names to strip concept words that
 * conflict with a user's diet. Used as a final consistency check before
 * returning any meal to the client.
 *
 * Philosophy: "The meal name must reflect what is actually on the plate."
 */

// Words that imply plant-based content — forbidden on carnivore
const CARNIVORE_CONCEPT_WORDS = [
  "salad", "bowl", "smoothie", "wrap", "sandwich", "stir fry", "stir-fry",
  "veggie", "vegetable", "vegan", "plant-based", "grain bowl", "buddha bowl",
  "power bowl", "acai", "granola", "oatmeal",
];

// Words that imply animal content — forbidden on vegan
const VEGAN_CONCEPT_WORDS = [
  "beef", "chicken", "pork", "turkey", "lamb", "bacon", "steak", "ribs",
  "salmon", "tuna", "shrimp", "lobster", "crab", "fish", "seafood",
  "cheese", "butter", "cream", "dairy", "egg", "eggs", "mayo", "whey",
  "lard", "tallow", "gelatin", "honey",
];

// Words that imply high-starch/sugary content — forbidden on keto
const KETO_HIGH_CARB_WORDS = [
  "pasta", "noodles", "rice", "bread", "sandwich", "wrap", "bagel", "pancake",
  "waffle", "muffin", "cake", "cookie", "brownie", "pie", "donuts",
  "granola", "oatmeal", "cereal", "smoothie bowl",
];

// Diet-style suffixes appended after renaming
const DIET_STYLE_LABEL: Record<string, string> = {
  carnivore: "Carnivore Style",
  vegan: "Vegan Style",
  keto: "Keto Style",
  paleo: "Paleo Style",
};

/**
 * Returns true if the meal name contains any of the flagged concept words
 * for the given diet.
 */
export function mealNameConflictsDiet(name: string, diet: string): boolean {
  const lower = name.toLowerCase();
  switch (diet) {
    case "carnivore":
      return CARNIVORE_CONCEPT_WORDS.some((w) => lower.includes(w));
    case "vegan":
      return VEGAN_CONCEPT_WORDS.some((w) => lower.includes(w));
    case "keto":
      return KETO_HIGH_CARB_WORDS.some((w) => lower.includes(w));
    default:
      return false;
  }
}

/**
 * Sanitizes a meal name by stripping misleading concept words and rebuilding
 * the name from a list of ingredients when available.
 *
 * If ingredients are provided and a conflict is detected, the name is built
 * from the top 2-3 ingredients + a diet style label.
 *
 * If no ingredients are provided, the conflicting concept word is stripped and
 * the diet style label is appended.
 *
 * @param name        Original meal name from AI
 * @param diet        User's primary diet (e.g. "carnivore")
 * @param ingredients Optional list of ingredient strings from the generated meal
 * @returns           Sanitized meal name
 */
export function sanitizeMealName(
  name: string,
  diet: string,
  ingredients?: string[]
): string {
  if (!mealNameConflictsDiet(name, diet)) return name;

  const styleLabel = DIET_STYLE_LABEL[diet];

  // Build name from top ingredients if available
  if (ingredients && ingredients.length > 0) {
    // Extract clean ingredient labels (first word or two before comma/parenthesis)
    const labels = ingredients
      .slice(0, 3)
      .map((ing) => {
        const clean = ing
          .replace(/\d+[\d./]*\s*(oz|g|lb|lbs|cup|cups|tbsp|tsp|ml|kg)\.?/gi, "")
          .replace(/\(.*?\)/g, "")
          .replace(/,.*$/, "")
          .trim();
        // Capitalize first letter
        return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
      })
      .filter(Boolean);

    if (labels.length > 0) {
      const ingredientPhrase = labels.join(", ");
      return styleLabel
        ? `${ingredientPhrase} (${styleLabel})`
        : ingredientPhrase;
    }
  }

  // Fallback: strip concept word from name and append style label
  const lower = name.toLowerCase();
  const conceptWords =
    diet === "carnivore"
      ? CARNIVORE_CONCEPT_WORDS
      : diet === "vegan"
      ? VEGAN_CONCEPT_WORDS
      : KETO_HIGH_CARB_WORDS;

  let sanitized = name;
  for (const word of conceptWords) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    sanitized = sanitized.replace(regex, "").trim().replace(/\s+/g, " ").replace(/^[-,\s]+|[-,\s]+$/g, "");
  }

  if (!sanitized) sanitized = name; // Never produce an empty name

  return styleLabel ? `${sanitized} (${styleLabel})` : sanitized;
}
