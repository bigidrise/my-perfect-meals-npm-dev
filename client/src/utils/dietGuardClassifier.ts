export type SupportedDiet = "vegan" | "vegetarian" | "keto" | "pescatarian";

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
  // Other animal products
  "honey", "gelatin", "lard", "tallow", "bone broth", "anchovies",
  "worcestershire", "caesar dressing",
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

export function normalizeDietPreference(raw: string | string[] | undefined | null): SupportedDiet | null {
  if (!raw || (Array.isArray(raw) && raw.length === 0)) return null;
  const lower = Array.isArray(raw)
    ? raw.join(" ").toLowerCase().trim()
    : raw.toLowerCase().trim();
  if (lower.includes("vegan") || lower.includes("plant-based") || lower.includes("plant based")) return "vegan";
  if (lower.includes("vegetarian")) return "vegetarian";
  if (lower.includes("keto")) return "keto";
  if (lower.includes("pescatarian") || lower.includes("pesco")) return "pescatarian";
  return null;
}

function hasIntentOverride(input: string): boolean {
  const lower = input.toLowerCase();
  return INTENT_OVERRIDES.some((kw) => lower.includes(kw));
}

function buildExclusionList(diet: SupportedDiet): string[] {
  switch (diet) {
    case "vegan": return VEGAN_EXCLUSIONS;
    case "vegetarian": return VEGETARIAN_EXCLUSIONS;
    case "keto": return KETO_EXCLUSIONS;
    case "pescatarian": return PESCATARIAN_EXCLUSIONS;
  }
}

export interface DietConflictResult {
  hasConflict: boolean;
  matchedTerms: string[];
}

export function detectDietConflicts(
  input: string | string[],
  diet: SupportedDiet,
): DietConflictResult {
  const text = Array.isArray(input) ? input.join(" ") : input;

  if (!text.trim()) {
    return { hasConflict: false, matchedTerms: [] };
  }

  // If user already signals dietary intent, skip conflict detection
  if (hasIntentOverride(text)) {
    return { hasConflict: false, matchedTerms: [] };
  }

  const exclusions = buildExclusionList(diet);
  const matched: string[] = [];

  for (const term of exclusions) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(text)) {
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
