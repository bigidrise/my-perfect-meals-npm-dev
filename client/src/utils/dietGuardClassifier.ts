import {
  evaluateRelationshipRules,
} from "../../../server/services/guardrails/rules/culturalRules";

export type SupportedDiet = "vegan" | "vegetarian" | "keto" | "pescatarian" | "kosher" | "halal" | "paleo" | "gluten-free";

/**
 * CLIENT-SIDE NORMALIZATION LAYER
 *
 * Mirrors server-side normalizeForDietaryScan() in allergyGuardrails.ts.
 * Must be kept in sync with the server equivalent — any new masking rules
 * added on the server must also be added here.
 *
 * Applied to ALL user input before detectDietConflicts() runs any term matching.
 * This prevents false positives for vegan-safe compound phrases like:
 *   - "oat milk", "almond milk", "soy milk", etc.  → masked to __PLANT_MILK__
 *   - "almond butter", "peanut butter", etc.        → masked to __NUT_BUTTER__
 */
const PLANT_MILK_PATTERN = /\b(almond|soy|oat|coconut|cashew|rice|hemp|pea|flax|macadamia|hazelnut|pistachio|walnut|banana|quinoa|sesame|sunflower|tiger nut)[\s-]+milk\b/gi;
const NUT_BUTTER_PATTERN  = /\b(peanut|almond|cashew|sunflower|apple|pumpkin)[\s-]*butter\b/gi;

function normalizeForDietaryScanClient(text: string): string {
  return text
    .toLowerCase()
    .replace(PLANT_MILK_PATTERN, "__PLANT_MILK__")
    .replace(NUT_BUTTER_PATTERN,  "__NUT_BUTTER__");
}

// If user input already signals dietary intent, skip conflict detection
const INTENT_OVERRIDES = [
  "vegan", "plant-based", "plant based", "vegetarian", "dairy-free", "dairy free",
  "egg-free", "egg free", "meatless", "meat-free", "meat free",
  "impossible burger", "impossible", "beyond meat", "beyond burger",
  "tofu", "tempeh", "seitan", "tofurky", "jackfruit",
  "pescatarian", "keto-friendly", "keto friendly", "low-carb", "low carb",
  "no meat", "no dairy", "without meat", "without dairy",
];

const VEGAN_EXCLUSIONS: string[] = [
  // Meat
  "beef", "chicken", "pork", "lamb", "turkey", "duck", "veal", "bison",
  "steak", "burger", "cheeseburger", "hamburger", "cheesesteak",
  "bacon", "ham", "prosciutto", "pancetta", "sausage", "salami", "pepperoni",
  "chorizo", "ribs", "brisket", "meatball", "meat ball",
  "hot dog", "hotdog", "bratwurst", "bologna",
  "jerky", "pulled pork", "ground beef", "ground turkey", "ground pork",
  "chicken wings", "chicken breast", "chicken thigh",
  // Seafood
  "fish", "salmon", "tuna", "shrimp", "prawn", "lobster", "crab", "oyster",
  "clam", "mussel", "scallop", "tilapia", "cod", "halibut", "anchovy",
  "sardine", "mackerel", "trout", "sea bass", "mahi", "swordfish", "snapper",
  "calamari", "squid", "octopus",
  // Dairy
  "milk", "cheese", "butter", "cream", "yogurt", "ice cream", "whey",
  "ghee", "mozzarella", "cheddar", "parmesan", "feta", "brie", "gouda",
  "ricotta", "cream cheese", "sour cream", "heavy cream", "half and half",
  "condensed milk", "evaporated milk", "buttermilk",
  // Eggs
  "egg", "eggs", "omelette", "omelet", "frittata", "quiche", "deviled egg",
  "egg wash", "mayonnaise", "mayo",
  // Other animal products
  "honey", "gelatin", "lard", "suet", "tallow", "schmaltz",
  "bone broth", "anchovies", "anchovy paste",
  "worcestershire", "oyster sauce",
  "caesar dressing", "caesar salad",
];

const VEGETARIAN_EXCLUSIONS: string[] = [
  // Meat only (dairy & eggs OK)
  "beef", "chicken", "pork", "lamb", "turkey", "duck", "veal", "bison",
  "steak", "burger", "hamburger", "cheesesteak",
  "bacon", "ham", "prosciutto", "pancetta", "sausage", "salami", "pepperoni",
  "chorizo", "ribs", "brisket", "meatball", "meat ball",
  "hot dog", "hotdog", "bratwurst", "bologna",
  "jerky", "pulled pork", "ground beef", "ground turkey", "ground pork",
  "chicken wings", "chicken breast", "chicken thigh",
  // Seafood
  "fish", "salmon", "tuna", "shrimp", "prawn", "lobster", "crab", "oyster",
  "clam", "mussel", "scallop", "tilapia", "cod", "halibut", "anchovy",
  "sardine", "mackerel", "trout", "sea bass", "mahi", "swordfish", "snapper",
  "calamari", "squid", "octopus",
  // Other non-vegetarian
  "gelatin", "lard", "tallow", "bone broth",
  "fish sauce", "oyster sauce", "anchovy paste", "worcestershire",
];

const KETO_EXCLUSIONS: string[] = [
  // High-carb grains & breads
  "bread", "white bread", "wheat bread", "sourdough", "baguette",
  "pasta", "spaghetti", "fettuccine", "linguine", "penne", "macaroni",
  "lasagna", "ravioli", "tortellini", "noodles", "ramen", "udon", "soba",
  "rice", "white rice", "brown rice", "fried rice", "risotto",
  "oats", "oatmeal", "granola", "cereal",
  "pizza", "pizza dough",
  "tortilla", "wrap", "pita", "flatbread", "naan",
  "pretzel", "bagel", "muffin", "biscuit", "cracker", "crouton",
  "pancake", "waffle", "french toast",
  "quinoa", "couscous", "barley", "bulgur",
  // High-carb vegetables
  "potato", "potatoes", "mashed potato", "french fries", "fries",
  "sweet potato", "yam", "corn", "popcorn", "cornbread",
  "peas", "chickpeas", "lentils", "beans", "black beans", "kidney beans",
  "edamame",
  // Sugar & sweets
  "sugar", "brown sugar", "syrup", "maple syrup", "honey",
  "cake", "cupcake", "cookie", "brownie", "donut", "doughnut",
  "candy", "chocolate", "chocolate bar", "ice cream", "sorbet", "sherbet",
  "pudding", "pie", "cobbler", "cheesecake",
  // Sugary drinks
  "juice", "orange juice", "apple juice", "soda", "cola", "beer",
  "sports drink", "energy drink",
];

const PESCATARIAN_EXCLUSIONS: string[] = [
  // Land meat only (fish & seafood OK)
  "beef", "chicken", "pork", "lamb", "turkey", "duck", "veal", "bison",
  "steak", "burger", "hamburger",
  "bacon", "ham", "prosciutto", "pancetta", "sausage", "salami", "pepperoni",
  "chorizo", "ribs", "brisket", "meatball", "meat ball",
  "hot dog", "hotdog", "bratwurst", "bologna",
  "jerky", "pulled pork", "ground beef", "ground turkey", "ground pork",
  "chicken wings", "chicken breast", "chicken thigh",
  "lard", "tallow",
];

const PALEO_EXCLUSIONS: string[] = [
  // All grains
  "wheat", "oats", "barley", "rye", "corn", "rice", "quinoa",
  "bread", "pasta", "noodles", "cereal", "crackers", "tortilla", "pita",
  "oatmeal", "granola", "couscous", "bulgur", "farro",
  // All dairy
  "milk", "cheese", "butter", "cream", "yogurt", "ice cream", "whey",
  "casein", "dairy", "mozzarella", "parmesan", "cheddar", "ricotta",
  "brie", "feta", "gouda", "sour cream", "cream cheese",
  // Legumes
  "beans", "black beans", "kidney beans", "pinto beans", "chickpeas",
  "lentils", "peanuts", "soy", "tofu", "tempeh", "edamame", "hummus",
  // Processed & refined sweeteners
  "refined sugar", "sugar", "cane sugar", "corn syrup", "agave", "honey",
  "canola oil", "vegetable oil", "soybean oil", "margarine",
  // White potatoes (sweet potatoes are paleo-allowed)
  "white potato", "french fries", "mashed potatoes",
];

const GLUTEN_FREE_EXCLUSIONS: string[] = [
  // Wheat and wheat derivatives
  "wheat", "wheat flour", "all-purpose flour", "bread flour", "whole wheat",
  "semolina", "durum", "farina", "bulgur", "couscous", "farro",
  "spelt", "kamut", "einkorn", "triticale",
  // Other gluten grains
  "barley", "rye", "malt", "malt extract",
  // Gluten protein forms
  "seitan", "vital wheat gluten",
  // Bread and baked goods
  "bread", "sourdough", "baguette", "pita", "naan", "flatbread",
  "pasta", "noodles", "macaroni", "spaghetti", "fettuccine", "lasagna",
  "crackers", "breadcrumbs", "panko", "croutons",
  "flour tortilla",
  // Soy sauce (usually contains wheat — tamari is the gluten-free substitute)
  "soy sauce",
];

export function normalizeDietPreference(raw: string | string[] | undefined | null): SupportedDiet | null {
  if (!raw || (Array.isArray(raw) && raw.length === 0)) return null;
  const lower = Array.isArray(raw)
    ? raw.join(" ").toLowerCase().trim()
    : raw.toLowerCase().trim();
  if (lower.includes("vegan") || lower.includes("plant-based") || lower.includes("plant based")) return "vegan";
  if (lower.includes("vegetarian")) return "vegetarian";
  if (lower.includes("keto")) return "keto";
  if (lower.includes("pescatarian") || lower.includes("pesco")) return "pescatarian";
  if (lower.includes("kosher")) return "kosher";
  if (lower.includes("halal")) return "halal";
  if (lower.includes("paleo")) return "paleo";
  if (lower.includes("gluten-free") || lower.includes("gluten free") || lower.includes("celiac")) return "gluten-free";
  return null;
}

function hasIntentOverride(input: string): boolean {
  const lower = input.toLowerCase();
  return INTENT_OVERRIDES.some((kw) => lower.includes(kw));
}

function buildExclusionList(diet: SupportedDiet): string[] | null {
  switch (diet) {
    case "vegan": return VEGAN_EXCLUSIONS;
    case "vegetarian": return VEGETARIAN_EXCLUSIONS;
    case "keto": return KETO_EXCLUSIONS;
    case "pescatarian": return PESCATARIAN_EXCLUSIONS;
    case "paleo": return PALEO_EXCLUSIONS;
    case "gluten-free": return GLUTEN_FREE_EXCLUSIONS;
    case "kosher":
    case "halal":
      return null;
  }
}

export interface DietConflictResult {
  hasConflict: boolean;
  matchedTerms: string[];
  isAdaptable?: boolean;
  suggestedSubstitute?: string;
  conflictMessage?: string;
}

export function detectDietConflicts(
  input: string | string[],
  diet: SupportedDiet,
): DietConflictResult {
  const text = Array.isArray(input) ? input.join(" ") : input;

  if (!text.trim()) {
    return { hasConflict: false, matchedTerms: [] };
  }

  // Kosher and halal route through the shared cultural rules engine —
  // evaluateRelationshipRules from culturalRules.ts is the single source of truth
  // for which conflicts are adaptable vs hard-blocked.
  if (diet === "kosher" || diet === "halal") {
    const violations = evaluateRelationshipRules(
      text,
      [],     // no pre-parsed ingredient list at precheck time
      text,   // use the raw input as dishName too; rules check dishNameContains against it
      [diet],
    );

    if (violations.length === 0) {
      return { hasConflict: false, matchedTerms: [] };
    }

    const first = violations[0];
    return {
      hasConflict: true,
      matchedTerms: [first.matchedOn],
      isAdaptable: first.rule.isAdaptable,
      suggestedSubstitute: first.rule.effect.suggestedSubstitute,
      conflictMessage: first.rule.effect.message,
    };
  }

  // Standard dietary exclusion list path (vegan, vegetarian, keto, pescatarian, paleo, gluten-free)
  if (hasIntentOverride(text)) {
    return { hasConflict: false, matchedTerms: [] };
  }

  const exclusions = buildExclusionList(diet);
  if (!exclusions) return { hasConflict: false, matchedTerms: [] };

  // Normalize BEFORE any term matching — masks plant milks and nut butters
  // so compound vegan-safe phrases never trigger bare-term false positives.
  const normalizedText = normalizeForDietaryScanClient(text);

  const matched: string[] = [];

  for (const term of exclusions) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(normalizedText)) {
      matched.push(term);
    }
  }

  // Deduplicate and cap at 5 for display
  const unique = [...new Set(matched)].slice(0, 5);

  return {
    hasConflict: unique.length > 0,
    matchedTerms: unique,
  };
}
