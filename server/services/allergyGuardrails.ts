// server/services/allergyGuardrails.ts
// CRITICAL SAFETY SYSTEM: Allergy and dietary restriction enforcement
// This module provides hard-block enforcement for allergies across ALL meal generators

export interface UserSafetyProfile {
  allergies: string[];
  dietaryRestrictions: string[];
  healthConditions?: string[];
  avoidIngredients?: string[];
}

export interface SafetyGuardrails {
  forbiddenIngredients: string[];
  promptBlock: string;
  summaryLine: string;
}

const normalize = (s: string) => s.trim().toLowerCase();

/**
 * PLANT MILK SAFE LIST
 * These compound phrases are NOT dairy and must not be blocked by the bare "milk" term.
 * Each prefix (e.g. "almond") may still be blocked by its OWN allergen category
 * (e.g. "almond milk" blocked for tree-nut allergy via the "almond" term, not "milk").
 */
export const PLANT_MILK_PREFIXES = [
  "almond", "soy", "oat", "coconut", "cashew", "rice", "hemp",
  "pea", "flax", "macadamia", "hazelnut", "pistachio", "walnut",
  "banana", "quinoa", "sesame", "sunflower", "tiger nut",
];

const PLANT_MILK_PATTERN = new RegExp(
  `\\b(${PLANT_MILK_PREFIXES.join("|")})[\\s-]+milk\\b`, "gi"
);

/**
 * Remove plant-milk phrases from text so bare "milk" matching doesn't false-positive.
 * Returns text with plant milks replaced by a safe placeholder.
 */
export function maskPlantMilks(text: string): string {
  return text.replace(PLANT_MILK_PATTERN, "__PLANT_MILK__");
}

export const NUT_BUTTER_PREFIXES = [
  "peanut", "almond", "cashew", "sunflower", "apple", "pumpkin",
];

const NUT_BUTTER_PATTERN = new RegExp(
  `\\b(${NUT_BUTTER_PREFIXES.join("|")})[\\s-]*butter\\b`, "gi"
);

/**
 * Remove nut-butter phrases from text so bare "butter" matching doesn't false-positive.
 * Returns text with nut butters replaced by a safe placeholder.
 */
export function maskNutButters(text: string): string {
  return text.replace(NUT_BUTTER_PATTERN, "__NUT_BUTTER__");
}


/**
 * FOOD AVOIDANCE EXPANSION MAP
 * Maps user-selected avoidance categories to specific ingredients that must be avoided.
 * "vegetables" deliberately maps ONLY to fibrous/non-starchy vegetables.
 * Starchy carbs (potatoes, sweet potatoes, corn, squash) are intentionally excluded
 * so they remain available in the starch lane for macro planning.
 */
export const AVOIDANCE_EXPANSION: Record<string, string[]> = {
  vegetables: [
    "broccoli", "spinach", "kale", "asparagus", "zucchini", "green beans",
    "brussels sprouts", "cauliflower", "cabbage", "arugula", "bok choy",
    "collard greens", "swiss chard", "watercress", "beet greens",
    "green peas", "snap peas", "snow peas", "artichoke", "artichokes",
    "leeks", "celery", "fennel", "endive", "radicchio", "romaine",
    "mixed greens", "salad greens", "microgreens",
    "lettuce", "mixed salad", "salad mix",
    "peppers", "bell pepper", "bell peppers", "red pepper", "green pepper", "yellow pepper",
    "cucumber", "cucumbers",
    "eggplant", "aubergine",
    "mushrooms", "onions",
  ],
  mushrooms: [
    "mushroom", "mushrooms", "portobello", "shiitake", "cremini", "button mushroom",
    "oyster mushroom", "king oyster", "enoki", "chanterelle", "morel",
    "porcini", "maitake", "lion's mane", "truffle", "truffles",
  ],
  onions: [
    "onion", "onions", "red onion", "white onion", "yellow onion",
    "green onion", "scallion", "scallions", "shallot", "shallots",
    "chives", "leek", "leeks",
  ],
  seafood: [
    "seafood", "fish", "salmon", "tuna", "cod", "tilapia", "shrimp", "prawn",
    "prawns", "crab", "lobster", "scallop", "scallops", "clam", "clams",
    "mussel", "mussels", "oyster", "oysters", "squid", "calamari",
    "octopus", "sardine", "sardines", "anchovy", "anchovies",
    "halibut", "mahi", "mahi-mahi", "swordfish", "trout", "bass",
    "mackerel", "snapper", "catfish", "flounder", "haddock",
  ],
  pork: [
    "pork", "bacon", "ham", "prosciutto", "pancetta", "sausage", "salami",
    "pepperoni", "chorizo", "carnitas", "pulled pork", "pork chop",
    "pork tenderloin", "pork belly", "ribs", "spare ribs", "pork loin",
    "pork shoulder", "ground pork", "Italian sausage", "bratwurst",
    "mortadella", "pork rinds", "chicharron", "lard",
  ],
  "red meat": [
    "beef", "steak", "ground beef", "bison", "lamb", "veal", "venison",
    "elk", "goat", "mutton", "ribeye", "sirloin", "filet mignon",
    "flank steak", "skirt steak", "chuck roast", "brisket",
    "short ribs", "beef ribs", "hamburger", "burger", "meatball",
    "meat sauce", "bolognese",
  ],
};

/**
 * COMPREHENSIVE ALLERGEN EXPANSION MAP
 * Maps user-selected allergies to ALL related ingredients that must be blocked
 * This is the single source of truth for allergen blocking
 */
export const ALLERGEN_EXPANSION: Record<string, string[]> = {
  // Shellfish - CRITICAL: Must block all crustaceans and mollusks + dishes that typically contain them
  shellfish: [
    // Crustaceans
    "shellfish", "shrimp", "shrimps", "prawn", "prawns", "crab", "crabs", "crabmeat", "crab meat",
    "lobster", "lobsters", "lobster tail", "crawfish", "crayfish", "langoustine", "langostino", "krill",
    // Mollusks
    "scallop", "scallops", "clam", "clams", "mussel", "mussels", 
    "oyster", "oysters", "squid", "calamari", "octopus", "cuttlefish",
    "abalone", "snail", "escargot", "sea urchin", "uni", "whelk", "periwinkle",
    // Common misspellings
    "shrimpp", "scrimp", "scrimps", "shrmp", "calimari",
    // Dishes that typically contain shellfish (hard block)
    "paella", "cioppino", "bouillabaisse", "gumbo", "jambalaya", "bisque", 
    "shrimp scampi", "shrimp cocktail", "crab cake", "crab cakes", "lobster roll",
    "clam chowder", "oysters rockefeller", "ceviche", "seafood boil",
    "fra diavolo", "frutti di mare", "gambas", "scampi", "tempura shrimp",
    "coconut shrimp", "popcorn shrimp", "shrimp tempura", "shrimp fried rice",
    "pad thai with shrimp", "tom yum", "laksa", "surimi"
  ],
  
  // Fish - All fish species
  fish: [
    "fish", "salmon", "tuna", "cod", "tilapia", "sardine", "sardines",
    "anchovy", "anchovies", "anchovy paste", "mackerel", "trout", "bass",
    "halibut", "snapper", "mahi", "mahi-mahi", "swordfish", "catfish",
    "flounder", "sole", "haddock", "perch", "pike", "carp", "herring",
    "fish sauce", "fish stock", "fish oil", "bonito", "dashi"
  ],
  
  // Dairy - All milk-derived products
  dairy: [
    "dairy", "milk", "whole milk", "skim milk", "2% milk", "cream",
    "heavy cream", "half and half", "half-and-half", "butter", "ghee",
    "cheese", "cheddar", "mozzarella", "parmesan", "feta", "brie",
    "camembert", "ricotta", "cottage cheese", "cream cheese", "gouda",
    "swiss cheese", "provolone", "blue cheese", "gorgonzola",
    "yogurt", "greek yogurt", "kefir", "sour cream", "creme fraiche",
    "whey", "casein", "lactose", "buttermilk", "custard", "ice cream",
    "gelato", "whipped cream", "condensed milk", "evaporated milk",
    "milk powder", "dried milk"
  ],
  
  // Also accept "milk" as alias for dairy
  milk: [
    "milk", "whole milk", "skim milk", "2% milk", "dairy", "cream",
    "butter", "cheese", "yogurt", "whey", "casein", "lactose"
  ],
  
  // Lactose Intolerance - High-lactose items only (NOT eggs, cream cheese, hard aged cheeses)
  // People with lactose intolerance can often tolerate: eggs, aged cheeses, cream cheese, lactose-free products
  "lactose intolerance": [
    "milk", "whole milk", "skim milk", "2% milk", "buttermilk",
    "ice cream", "gelato", "soft serve", "frozen yogurt",
    "yogurt", "greek yogurt", "plain yogurt", "flavored yogurt", "kefir",
    "whipped cream", "heavy cream", "half and half", "half-and-half",
    "condensed milk", "evaporated milk", "milk powder", "dried milk",
    "cottage cheese", "ricotta", "fresh mozzarella", "brie", "camembert",
    "sour cream", "creme fraiche", "custard", "pudding",
    "milk chocolate", "hot chocolate", "latte", "cappuccino", "milkshake",
    "cream sauce", "alfredo", "bechamel", "white sauce", "queso",
    "lactose", "whey protein concentrate"
  ],
  
  // Also accept without space
  lactose_intolerance: [
    "milk", "whole milk", "skim milk", "2% milk", "buttermilk",
    "ice cream", "gelato", "soft serve", "frozen yogurt",
    "yogurt", "greek yogurt", "plain yogurt", "flavored yogurt", "kefir",
    "whipped cream", "heavy cream", "half and half", "half-and-half",
    "condensed milk", "evaporated milk", "milk powder", "dried milk",
    "cottage cheese", "ricotta", "fresh mozzarella", "brie", "camembert",
    "sour cream", "creme fraiche", "custard", "pudding",
    "milk chocolate", "hot chocolate", "latte", "cappuccino", "milkshake",
    "cream sauce", "alfredo", "bechamel", "white sauce", "queso",
    "lactose", "whey protein concentrate"
  ],
  
  // Also accept just "lactose" as shorthand for lactose intolerance
  lactose: [
    "milk", "whole milk", "skim milk", "2% milk", "buttermilk",
    "ice cream", "gelato", "soft serve", "frozen yogurt",
    "yogurt", "greek yogurt", "plain yogurt", "flavored yogurt", "kefir",
    "whipped cream", "heavy cream", "half and half", "half-and-half",
    "condensed milk", "evaporated milk", "milk powder", "dried milk",
    "cottage cheese", "ricotta", "fresh mozzarella", "brie", "camembert",
    "sour cream", "creme fraiche", "custard", "pudding",
    "milk chocolate", "hot chocolate", "latte", "cappuccino", "milkshake",
    "cream sauce", "alfredo", "bechamel", "white sauce", "queso",
    "lactose", "whey protein concentrate"
  ],
  
  // Eggs
  eggs: [
    "egg", "eggs", "egg white", "egg yolk", "egg whites", "egg yolks",
    "albumin", "albumen", "mayonnaise", "mayo", "aioli", "meringue",
    "hollandaise", "bearnaise", "custard", "eggnog"
  ],
  
  // Also accept singular "egg"
  egg: [
    "egg", "eggs", "egg white", "egg yolk", "albumin", "mayonnaise", "mayo"
  ],
  
  // Peanuts (legume, not tree nut) - CRITICAL: Block all peanut products and dishes
  peanuts: [
    "peanut", "peanuts", "peanut butter", "peanut oil", "groundnut",
    "groundnuts", "arachis", "monkey nuts", "goober", "peanut flour",
    "peanut sauce", "peanut dressing", "peanut brittle", "peanut paste",
    // Common misspellings
    "penut", "penuts", "peenut", "peenuts",
    // Dishes that typically contain peanuts (hard block)
    "satay", "pad thai", "kung pao", "kung pao chicken", "gado gado",
    "peanut noodles", "thai peanut", "african peanut soup", "peanut stew",
    "dan dan noodles", "massaman curry", "indonesian satay"
  ],
  
  peanut: [
    "peanut", "peanuts", "peanut butter", "peanut oil", "groundnut",
    "peanut sauce", "satay", "pad thai", "kung pao"
  ],
  
  // Tree nuts - All tree nuts and products
  "tree nuts": [
    "tree nut", "tree nuts", "almond", "almonds", "almond butter",
    "almond milk", "almond flour", "almond extract", "walnut", "walnuts", 
    "walnut oil", "pecan", "pecans", "pecan pie",
    "cashew", "cashews", "cashew butter", "cashew milk", "cashew cream",
    "pistachio", "pistachios", "pistachio butter",
    "hazelnut", "hazelnuts", "filbert", "hazelnut spread", "nutella",
    "macadamia", "macadamia nut", "macadamia nuts",
    "brazil nut", "brazil nuts", "pine nut", "pine nuts", "pignoli", 
    "chestnut", "chestnuts", "praline", "marzipan", "nougat", "gianduja",
    // Nut-based products and dishes
    "nut butter", "nut milk", "nut flour", "nut oil", "mixed nuts",
    "baklava", "frangipane", "amaretti", "biscotti"
  ],
  
  nuts: [
    "nut", "nuts", "almond", "almonds", "walnut", "walnuts", "pecan",
    "pecans", "cashew", "cashews", "pistachio", "pistachios", "hazelnut",
    "hazelnuts", "macadamia", "brazil nut", "pine nut", "peanut", "peanuts",
    "nut butter", "nut milk", "mixed nuts"
  ],
  
  // Soy
  soy: [
    "soy", "soya", "soybean", "soybeans", "soy sauce", "soy milk",
    "tofu", "tempeh", "edamame", "miso", "miso paste", "natto",
    "soy protein", "soy lecithin", "tvp", "textured vegetable protein"
  ],
  
  // Gluten/Wheat
  gluten: [
    "gluten", "wheat", "wheat flour", "all-purpose flour", "bread flour",
    "whole wheat", "semolina", "durum", "farina", "bulgur", "couscous",
    "farro", "spelt", "kamut", "einkorn", "triticale", "barley", "rye",
    "malt", "malt extract", "brewer's yeast", "seitan", "vital wheat gluten",
    "bread", "pasta", "noodles", "crackers", "breadcrumbs", "panko",
    "flour tortilla", "pita", "naan"
  ],
  
  wheat: [
    "wheat", "wheat flour", "all-purpose flour", "bread flour", "whole wheat",
    "semolina", "durum", "farina", "bulgur", "couscous", "farro", "spelt",
    "bread", "pasta", "noodles", "crackers", "breadcrumbs"
  ],
  
  // Sesame
  sesame: [
    "sesame", "sesame seed", "sesame seeds", "sesame oil", "tahini",
    "hummus", "halva", "halvah", "sesame paste", "gomashio", "za'atar"
  ],
  
  // Mustard
  mustard: [
    "mustard", "mustard seed", "mustard seeds", "mustard powder",
    "dijon", "dijon mustard", "yellow mustard", "honey mustard"
  ],
  
  // Celery (common EU allergen)
  celery: [
    "celery", "celery salt", "celery seed", "celeriac", "celery root"
  ],
  
  // Sulfites
  sulfites: [
    "sulfite", "sulfites", "sulphite", "sulphites", "sulfur dioxide",
    "wine", "dried fruit", "dried fruits"
  ],
  
  // Corn
  corn: [
    "corn", "maize", "cornmeal", "corn flour", "cornstarch", "corn starch",
    "corn syrup", "high fructose corn syrup", "hfcs", "polenta", "grits",
    "hominy", "corn oil", "corn tortilla", "popcorn"
  ],
  
  // Nightshades (for autoimmune conditions)
  nightshades: [
    "nightshade", "tomato", "tomatoes", "potato", "potatoes",
    "pepper", "peppers", "bell pepper", "chili", "chili pepper",
    "jalapeño", "cayenne", "paprika", "eggplant", "aubergine",
    "goji berry", "goji berries", "tobacco"
  ]
};

/**
 * DIET PRIORITY ORDER — strictest wins when multiple diets are present.
 * keto and paleo are strict (filter-first); vegan/vegetarian/pescatarian are flexible (modify-allowed).
 */
export const DIET_PRIORITY = ["vegan", "vegetarian", "pescatarian", "keto", "paleo"] as const;
export type DietMode = typeof DIET_PRIORITY[number];

/** Strict diets — invalid meals must be rejected outright, not modified */
const STRICT_DIETS: DietMode[] = ["keto", "paleo"];

/**
 * Resolve a single primary diet from a dietary restrictions array.
 * Follows priority: vegan > vegetarian > pescatarian > keto > paleo
 * Returns null if no diet mode is present.
 */
export function getPrimaryDiet(restrictions: string[]): DietMode | null {
  const normalized = (restrictions || []).map(r => r.trim().toLowerCase());
  return DIET_PRIORITY.find(d => normalized.includes(d)) ?? null;
}

/**
 * DIETARY RESTRICTION EXPANSION MAP
 * Maps dietary restrictions to ingredients that must be blocked
 */
export const RESTRICTION_EXPANSION: Record<string, string[]> = {
  vegan: [
    "meat", "beef", "steak", "pork", "bacon", "ham", "lamb", "veal",
    "chicken", "turkey", "duck", "poultry", "fish", "salmon", "tuna",
    "shellfish", "shrimp", "crab", "lobster", "egg", "eggs", "dairy",
    "milk", "cheese", "butter", "cream", "yogurt", "honey", "gelatin",
    "lard", "suet", "tallow", "bone broth", "chicken stock", "beef stock",
    "fish sauce", "anchovies", "whey", "casein"
  ],
  
  vegetarian: [
    "meat", "beef", "steak", "pork", "bacon", "ham", "lamb", "veal",
    "chicken", "turkey", "duck", "poultry", "fish", "salmon", "tuna",
    "shellfish", "shrimp", "crab", "lobster", "gelatin", "lard",
    "suet", "tallow", "bone broth", "chicken stock", "beef stock",
    "fish sauce", "anchovies"
  ],
  
  pescatarian: [
    "meat", "beef", "steak", "pork", "bacon", "ham", "lamb", "veal",
    "chicken", "turkey", "duck", "poultry", "lard", "suet", "tallow"
  ],
  
  halal: [
    "pork", "bacon", "ham", "prosciutto", "pancetta", "lard", "gelatin",
    "wine", "beer", "alcohol", "rum", "whiskey", "vodka", "brandy"
  ],
  
  kosher: [
    "pork", "bacon", "ham", "prosciutto", "pancetta", "lard",
    "shellfish", "shrimp", "crab", "lobster", "scallop", "clam",
    "oyster", "mussel", "squid", "octopus"
  ],
  
  "no red meat": [
    "beef", "steak", "ground beef", "hamburger", "brisket", "ribeye",
    "pork", "bacon", "ham", "pork chop", "lamb", "veal", "venison",
    "bison", "goat"
  ],
  
  "no pork": [
    "pork", "bacon", "ham", "prosciutto", "pancetta", "pork chop",
    "pork loin", "pork belly", "chorizo", "sausage", "lard"
  ],

  keto: [
    // All grains and grain-based foods
    "pasta", "spaghetti", "fettuccine", "penne", "linguine", "rigatoni", "lasagna",
    "ravioli", "tagliatelle", "gnocchi", "noodle", "noodles", "orzo", "macaroni",
    "rice", "white rice", "brown rice", "fried rice", "risotto",
    "bread", "toast", "baguette", "roll", "rolls", "sandwich bread", "sourdough",
    "tortilla", "tortillas", "wrap", "pita", "flatbread", "naan",
    "corn", "cornmeal", "polenta", "corn tortilla",
    "oats", "oatmeal", "granola",
    "wheat", "barley", "rye", "millet", "quinoa",
    "cereal", "crackers", "pretzels",
    // Sugars and sweeteners
    "sugar", "cane sugar", "brown sugar", "powdered sugar", "maple syrup",
    "honey", "agave", "corn syrup", "high fructose corn syrup",
    "molasses", "jam", "jelly", "syrup",
    // Starchy vegetables
    "potato", "potatoes", "sweet potato", "yam", "parsnip", "beet", "beets",
    // Legumes
    "beans", "black beans", "kidney beans", "pinto beans", "chickpeas",
    "lentils", "edamame", "soy beans",
    // Fruit juice and sugary drinks
    "fruit juice", "orange juice", "apple juice", "soda", "sweetened beverage"
  ],

  paleo: [
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
    "lentils", "peanuts", "peanut butter", "soy", "tofu", "tempeh",
    "edamame", "hummus",
    // Processed and refined sweeteners
    "refined sugar", "sugar", "cane sugar", "corn syrup", "agave", "honey",
    "artificial sweetener", "canola oil", "vegetable oil", "soybean oil",
    "margarine", "processed food", "refined flour",
    // Potatoes (white — sweet potatoes are paleo-allowed)
    "white potato", "white potatoes", "french fries", "mashed potatoes"
  ]
};

/**
 * Build a CRITICAL DIETARY RULE prompt block for injection into AI generators.
 * Uses word-boundary–safe forbidden lists from RESTRICTION_EXPANSION.
 * Priority: vegan > vegetarian > pescatarian > keto > paleo (strictest wins).
 * Keto and paleo are STRICT diets — invalid meals are rejected outright, not modified.
 * Returns an empty string when no diet mode applies.
 */
export function buildDietPromptBlock(restrictions: string[]): string {
  const diet = getPrimaryDiet(restrictions);
  if (!diet) return "";

  const forbidden = RESTRICTION_EXPANSION[diet] || [];
  const isStrict = STRICT_DIETS.includes(diet);

  const baseBlock = [
    `CRITICAL DIETARY RULE:`,
    `This user strictly follows a ${diet.toUpperCase()} diet. This is NON-NEGOTIABLE.`,
    `STRICTLY FORBIDDEN — NEVER include ANY of these ingredients or derivatives:`,
    forbidden.join(", ") + ".",
    `Meals that contain any forbidden ingredient are INVALID and must not be generated.`,
  ];

  if (isStrict) {
    // Strict diets: filter-first, no modifications of invalid meals
    baseBlock.push(
      `STRICT DIET ENFORCEMENT:`,
      `Do NOT attempt to modify a non-compliant meal into compliance (e.g., do not suggest "remove the pasta" for a pasta dish).`,
      `If a dish fundamentally violates this diet, reject it entirely and choose a different, naturally compliant meal.`,
      `Only return meals that are inherently compliant without requiring modifications to the core dish.`,
    );
    if (diet === "keto") {
      baseBlock.push(
        `KETO TONE RULE: Never describe carbohydrates as beneficial. Focus on protein, healthy fats, satiety, and stable blood sugar. Avoid phrases like "provides energy from carbs" or "carbs for fuel."`,
      );
    } else if (diet === "paleo") {
      baseBlock.push(
        `PALEO TONE RULE: Never describe grains, dairy, or legumes as beneficial. Focus on whole-food protein, natural fats, vegetable variety, and sustained energy. Avoid phrases like "good source of grains" or "provides dairy protein."`,
      );
    }
  } else {
    // Flexible diets: compliant alternatives are acceptable
    baseBlock.push(
      `If a craving seems to conflict with this diet (e.g., asking for a burger while vegan),`,
      `create a compliant alternative (e.g., a vegan black-bean burger) — never violate the diet.`,
    );
  }

  return baseBlock.join("\n");
}

// ─── DIET × BEVERAGE CATEGORY INTELLIGENCE ──────────────────────────────────

export type ConflictLevel = 'none' | 'caution' | 'redirect';

export interface DietCategoryStrategy {
  conflictLevel: ConflictLevel;
  effectiveCategory: string;   // what the AI should generate (may differ for redirect)
  requestedCategory: string;   // what the user originally selected
  coachingBlock: string;       // injected into AI prompt — framed as optimization, never restriction
}

// High-conflict pairs: category is fundamentally incompatible with diet.
// AI silently generates effectiveCategory instead.
const DIET_REDIRECT_MAP: Record<string, Record<string, string>> = {
  keto:  { milkshake: 'protein-shake' },
  paleo: { milkshake: 'smoothie' },
};

// Caution pairs: same category is kept, but AI prompt gets constraint block.
const DIET_CAUTION_MAP: Record<string, string[]> = {
  keto:  ['smoothie', 'frozen', 'cocktail', 'mocktail'],
  paleo: ['smoothie', 'frozen', 'cocktail', 'coffee'],
  vegan: ['milkshake', 'protein-shake', 'coffee', 'frozen'],
};

function buildRedirectPromptBlock(diet: string, requestedCategory: string, effectiveCategory: string): string {
  const effectiveLabel = effectiveCategory.replace(/-/g, ' ');
  const requestedLabel = requestedCategory.replace(/-/g, ' ');
  return [
    `DRINK OPTIMIZATION:`,
    `The user is looking for a ${requestedLabel} experience. Based on their ${diet} lifestyle, a ${effectiveLabel} is the best-fitting option that delivers a similar level of enjoyment and satisfaction.`,
    `Generate a ${effectiveLabel} that matches the flavor satisfaction and indulgence they were looking for.`,
    `Present the result as curated and optimized for them specifically — do NOT mention that their original selection was unavailable or restricted.`,
    `Frame this as the ideal choice for their goals.`,
  ].join('\n');
}

// Per-diet, per-category constraint blocks — optimization framing, not restriction
const CAUTION_PROMPT_BLOCKS: Record<string, Record<string, string>> = {
  keto: {
    smoothie:  `SMOOTHIE OPTIMIZATION FOR KETO:\n- Use low-sugar fruits only: strawberries, blueberries, raspberries, blackberries (no banana, mango, pineapple, grape)\n- No fruit juice bases — use unsweetened almond milk, coconut milk, or water\n- Emphasize healthy fats: avocado, coconut cream, almond butter\n- Add protein: protein powder (whey or plant-based), full-fat Greek yogurt\n- No added sugar, honey, agave, or sweetened bases\n- Each serving should be under 10g net carbs`,
    frozen:    `FROZEN DRINK OPTIMIZATION FOR KETO:\n- No sugar-based syrups, fruit juice, or sweetened mixers\n- Use heavy cream or coconut cream for richness and texture\n- Flavor with unsweetened cocoa, vanilla extract, cinnamon, or low-carb fruits (berries)\n- Sweeten only with stevia or erythritol if needed — no honey, agave, or sugar`,
    cocktail:  `COCKTAIL OPTIMIZATION FOR KETO:\n- No sugary mixers, fruit juice, simple syrup, grenadine, or triple sec\n- Use spirits naturally (vodka, gin, tequila, whiskey, rum) — these are keto-friendly\n- Mix with soda water, sparkling water, fresh citrus juice (small amounts), or bitters\n- Garnish with citrus peel, fresh herbs, or a few berries`,
    mocktail:  `MOCKTAIL OPTIMIZATION FOR KETO:\n- No sugar syrups, fruit juice, agave, or honey\n- Build flavor with sparkling water, fresh citrus, herbs (mint, basil, rosemary), cucumber, and bitters\n- A small amount of low-sugar kombucha can add complexity\n- Keep net carbs under 5g per serving`,
  },
  paleo: {
    smoothie:  `SMOOTHIE OPTIMIZATION FOR PALEO:\n- No dairy milk — use coconut milk, almond milk, or cashew milk\n- STRICTLY NO honey, agave, refined sugar, or any processed sweetener — these are not paleo-compliant\n- Use controlled fruit portions for natural sweetness: small amounts of berries preferred; banana only in very small quantities\n- DO NOT make this fruit-heavy — balance fruit with fats and protein to keep macros structured\n- STRICTLY NO whey protein, casein, or any dairy-derived protein powder — use collagen powder, egg white protein, or nut butter instead\n- No legume-based ingredients (no soy milk, no peanut butter)\n- Target moderate protein (15g+) and controlled carbs — this should feel intentional and performance-aware, not like a basic fruit drink\n- The result should feel premium and designed: rich texture, satisfying, and clearly built for someone who trains and eats with purpose`,
    frozen:    `FROZEN DRINK OPTIMIZATION FOR PALEO:\n- No dairy or refined sugar\n- STRICTLY NO honey, agave, syrups, or processed sweeteners\n- STRICTLY NO whey or any dairy-derived protein\n- Use coconut cream or coconut milk as the base for richness and creaminess\n- Sweeten only with whole fruit in controlled portions — keep carbs in check\n- This should feel indulgent and crafted, not like a generic blended fruit drink`,
    cocktail:  `COCKTAIL OPTIMIZATION FOR PALEO:\n- No sugary mixers, heavy juice bases, honey, or agave\n- Wine and quality distilled spirits are generally paleo-acceptable\n- Mix with sparkling water, fresh citrus juice, or herbs\n- Avoid grain-based beers or malt-based drinks`,
    coffee:    `COFFEE DRINK OPTIMIZATION FOR PALEO:\n- Use coconut milk, almond milk, or cashew milk — no dairy cream or cow's milk\n- STRICTLY NO refined sugar, honey, or artificial sweeteners\n- A small amount of coconut sugar or medjool date is acceptable if sweetness is needed\n- Cinnamon, vanilla, and raw cacao are excellent paleo-friendly additions`,
  },
  vegan: {
    milkshake:       `MILKSHAKE OPTIMIZATION FOR VEGAN:\n- Use oat milk, almond milk, coconut milk, or cashew milk as the base\n- Use dairy-free ice cream or frozen banana for creaminess and body\n- No honey — sweeten with maple syrup, agave, or ripe banana\n- No animal-derived thickeners, gelatin, or additives`,
    'protein-shake': `PROTEIN SHAKE OPTIMIZATION FOR VEGAN:\n- Use plant-based protein powder only: pea protein, hemp protein, or brown rice protein\n- No whey, casein, or any dairy-derived protein\n- Base with plant milk or water\n- No honey — sweeten naturally with dates, banana, or a touch of maple syrup`,
    coffee:          `COFFEE DRINK OPTIMIZATION FOR VEGAN:\n- Use oat milk, almond milk, soy milk, or coconut milk — no dairy cream or cow's milk\n- No honey — sweeten with maple syrup, coconut sugar, or leave unsweetened\n- Confirm any syrups used are vegan-certified (some contain dairy derivatives)`,
    frozen:          `FROZEN DRINK OPTIMIZATION FOR VEGAN:\n- No dairy — use coconut cream, oat milk, or almond milk\n- No honey, gelatin, or animal-derived additives\n- Use fruit, cacao, or plant-based flavoring for character and sweetness`,
  },
};

/**
 * Resolves the best generation strategy when a user's diet conflicts with their selected
 * beverage category. Returns conflict level, effective category for generation, and a
 * coaching block to inject into the AI prompt.
 *
 * Tone: always framed as optimization and personalization — never as restriction or correction.
 * Users should feel guided, not corrected.
 */
export function resolveDietCategoryStrategy(
  restrictions: string[],
  category: string,
): DietCategoryStrategy {
  const diet = getPrimaryDiet(restrictions);
  const base: DietCategoryStrategy = {
    conflictLevel: 'none',
    effectiveCategory: category,
    requestedCategory: category,
    coachingBlock: '',
  };

  if (!diet) return base;

  // Redirect: category is fundamentally incompatible — generate different category silently
  const redirectTarget = DIET_REDIRECT_MAP[diet]?.[category];
  if (redirectTarget) {
    return {
      conflictLevel: 'redirect',
      effectiveCategory: redirectTarget,
      requestedCategory: category,
      coachingBlock: buildRedirectPromptBlock(diet, category, redirectTarget),
    };
  }

  // Caution: same category allowed but needs constraint injection
  const cautionCategories = DIET_CAUTION_MAP[diet] || [];
  if (cautionCategories.includes(category)) {
    const cautionBlock = CAUTION_PROMPT_BLOCKS[diet]?.[category] || '';
    return {
      conflictLevel: 'caution',
      effectiveCategory: category,
      requestedCategory: category,
      coachingBlock: cautionBlock,
    };
  }

  return base;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check whether generated text violates the user's primary dietary constraint.
 * Uses word-boundary matching to avoid false positives (eggplant ≠ egg, almond milk ≠ milk).
 * Returns { violates, reasons } so callers can log the violation.
 */
export function violatesDietaryConstraints(
  text: string,
  restrictions: string[]
): { violates: boolean; reasons: string[] } {
  const diet = getPrimaryDiet(restrictions);
  if (!diet) return { violates: false, reasons: [] };

  const forbidden = RESTRICTION_EXPANSION[diet] || [];
  const lower = text.toLowerCase();
  // Mask plant milks and nut butters before bare-word checks
  const milkMasked = maskPlantMilks(lower);
  const butterMasked = maskNutButters(lower);

  const reasons: string[] = [];
  for (const term of forbidden) {
    if (!term) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\b`, "i");
    const textToScan =
      term === "milk" ? milkMasked :
      term === "butter" ? butterMasked :
      lower;
    if (pattern.test(textToScan)) {
      reasons.push(term);
    }
  }

  return { violates: reasons.length > 0, reasons };
}

/**
 * Build forbidden ingredients list from user's allergies and restrictions
 */
export function buildForbiddenIngredients(profile: UserSafetyProfile): string[] {
  const forbidden = new Set<string>();
  
  // Expand allergies
  for (const allergy of profile.allergies || []) {
    const key = normalize(allergy);
    const expanded = ALLERGEN_EXPANSION[key];
    if (expanded) {
      expanded.forEach(ing => forbidden.add(normalize(ing)));
    } else {
      // If no expansion found, add the allergy itself as forbidden
      forbidden.add(key);
    }
  }
  
  // Expand dietary restrictions
  for (const restriction of profile.dietaryRestrictions || []) {
    const key = normalize(restriction);
    const expanded = RESTRICTION_EXPANSION[key];
    if (expanded) {
      expanded.forEach(ing => forbidden.add(normalize(ing)));
    }
  }
  
  // Add explicit avoid ingredients
  for (const avoid of profile.avoidIngredients || []) {
    forbidden.add(normalize(avoid));
  }
  
  return Array.from(forbidden);
}

/**
 * PROMPT-SAFE TERM MAP
 * When sending forbidden terms to the AI, replace ambiguous single words with
 * precise descriptions so the AI does not over-block unrelated ingredients.
 * The scanner layer (maskNutButters / maskPlantMilks) handles post-gen validation;
 * this map handles the AI guidance layer.
 */
const PROMPT_TERM_CLARIFICATIONS: Record<string, string> = {
  butter: "dairy butter (cow's milk butter — NOT nut or seed butters)",
  milk:   "dairy milk (cow's milk — NOT plant-based milks such as almond milk, oat milk, soy milk, or coconut milk)",
  cream:  "dairy cream (cow's milk cream — NOT coconut cream or oat cream)",
};

/**
 * Convert the raw forbidden list into AI-readable language.
 * Replaces vague bare terms with precise descriptions so the AI
 * understands EXACTLY what is forbidden without over-blocking.
 */
function humanizeForPrompt(forbiddenIngredients: string[]): string[] {
  return forbiddenIngredients.map(term => {
    const clarified = PROMPT_TERM_CLARIFICATIONS[term.toLowerCase()];
    return clarified ?? term;
  });
}

/**
 * Build a clarification block to inject when dairy (or milk) is in the allergy list.
 * This is the single most important line for preventing nut-butter false positives.
 */
function buildDairyClarificationBlock(allergies: string[]): string | null {
  const hasDairy = allergies.some(a =>
    ["dairy", "milk", "lactose", "lactose intolerance"].includes(a.toLowerCase())
  );
  if (!hasDairy) return null;

  return [
    "IMPORTANT CLARIFICATION — DAIRY vs NUT/SEED BUTTERS:",
    "  • \"Butter\" in this allergy list refers ONLY to dairy butter (made from cow's milk).",
    "  • Peanut butter, almond butter, cashew butter, sunflower butter, and all other nut/seed butters are NOT dairy. They are safe to include UNLESS the user also has a nut allergy.",
    "  • Plant-based milks (almond milk, oat milk, coconut milk, soy milk, rice milk) are NOT dairy. They are safe to include UNLESS the user also has an allergy to that specific plant.",
    "  • Coconut cream, oat cream, and cashew cream are NOT dairy. They are safe substitutes.",
    "ALLOWED EXAMPLES (dairy allergy only, no nut allergy): peanut butter, almond butter, cashew butter, sunflower butter, oat milk, almond milk, coconut milk, coconut cream.",
  ].join("\n");
}

export function buildSafetyGuardrails(profile: UserSafetyProfile): SafetyGuardrails {
  const allergies = profile.allergies || [];
  const restrictions = profile.dietaryRestrictions || [];
  const forbiddenIngredients = buildForbiddenIngredients(profile);
  
  const promptLines: string[] = [];
  
  if (allergies.length > 0) {
    promptLines.push(
      `🚨 CRITICAL ALLERGY SAFETY: User has life-threatening allergies to: ${allergies.join(", ")}.`
    );

    const humanizedList = humanizeForPrompt(forbiddenIngredients.slice(0, 50));
    promptLines.push(
      `ABSOLUTE PROHIBITION: You must NEVER include, suggest, or use ANY of these ingredients or their derivatives: ${humanizedList.join(", ")}${forbiddenIngredients.length > 50 ? '...' : ''}.`
    );

    const dairyClarification = buildDairyClarificationBlock(allergies);
    if (dairyClarification) {
      promptLines.push(dairyClarification);
    }
  }
  
  if (restrictions.length > 0) {
    // Use hard CRITICAL language for recognized diet modes (vegan/vegetarian/pescatarian)
    const dietBlock = buildDietPromptBlock(restrictions);
    if (dietBlock) {
      promptLines.push(dietBlock);
    } else {
      // Generic fallback for other restrictions (halal, kosher, no_pork, etc.)
      promptLines.push(
        `DIETARY REQUIREMENTS: User follows ${restrictions.join(", ")} diet. Strictly comply with these restrictions.`
      );
    }
  }
  
  promptLines.push(
    `If a requested ingredient conflicts with these safety rules, substitute with a safe alternative. NEVER include forbidden ingredients under any circumstances.`
  );
  
  return {
    forbiddenIngredients,
    promptBlock: promptLines.join("\n"),
    summaryLine: `Safety: allergies=[${allergies.join("|")}], restrictions=[${restrictions.join("|")}], forbidden=${forbiddenIngredients.length} items`
  };
}

/**
 * CRITICAL: Scan generated meal for forbidden ingredients
 * Returns array of violations found
 */
export function scanForViolations(
  meal: { 
    name?: string; 
    ingredients?: Array<{name: string} | string>; 
    instructions?: string[];
    description?: string;
  },
  forbiddenIngredients: string[]
): string[] {
  const violations: string[] = [];
  
  // Build text to scan from all meal components
  const textParts: string[] = [];
  
  if (meal.name) textParts.push(meal.name);
  if (meal.description) textParts.push(meal.description);
  
  if (meal.ingredients) {
    for (const ing of meal.ingredients) {
      const name = typeof ing === 'string' ? ing : ing.name;
      textParts.push(name);
    }
  }
  
  if (meal.instructions) {
    textParts.push(...meal.instructions);
  }
  
  const fullText = textParts.join(" ").toLowerCase();
  const maskedTextNormalized = fullText.replace(/[-_]/g, ' ');
  const milkMasked = maskPlantMilks(maskedTextNormalized);
  const butterMasked = maskNutButters(maskedTextNormalized);
  
  // Check each forbidden ingredient
  for (const forbidden of forbiddenIngredients) {
    if (!forbidden) continue;
    
    // Use word boundary matching to avoid false positives
    // e.g., "shrimp" should match "shrimp" but not "shrimply"
    const pattern = new RegExp(`\\b${escapeRegex(forbidden)}\\b`, 'i');
    
    // For bare "milk", scan masked text so plant milks don't false-positive
    // For bare "butter", scan masked text so nut butters don't false-positive
    let textToScan = fullText;
    if (forbidden === "milk") textToScan = milkMasked;
    else if (forbidden === "butter") textToScan = butterMasked;
    
    if (pattern.test(textToScan)) {
      violations.push(forbidden);
    }
  }
  
  return Array.from(new Set(violations)); // Dedupe
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * MAIN VALIDATION FUNCTION
 * Use this in ALL meal generators after generation
 */
export function validateMealSafety(
  meal: { 
    name?: string; 
    ingredients?: Array<{name: string} | string>; 
    instructions?: string[];
    description?: string;
  },
  profile: UserSafetyProfile
): { safe: boolean; violations: string[]; message: string } {
  const guardrails = buildSafetyGuardrails(profile);
  const violations = scanForViolations(meal, guardrails.forbiddenIngredients);
  
  if (violations.length > 0) {
    return {
      safe: false,
      violations,
      message: `SAFETY VIOLATION: Meal contains forbidden ingredients: ${violations.join(", ")}`
    };
  }
  
  return {
    safe: true,
    violations: [],
    message: "Meal passed safety validation"
  };
}

/**
 * Get user safety profile from user object
 */
export function extractSafetyProfile(user: any): UserSafetyProfile {
  return {
    allergies: user?.allergies || [],
    dietaryRestrictions: user?.dietaryRestrictions || [],
    healthConditions: user?.healthConditions || [],
    avoidIngredients: user?.dislikedFoods || user?.avoidIngredients || []
  };
}

/**
 * PRE-GENERATION CHECK: Block requests that explicitly ask for forbidden ingredients
 * This runs BEFORE AI generation to prevent even attempting to create unsafe meals
 * Returns null if safe to proceed, or violation details if blocked
 */
export function preCheckRequest(
  requestText: string,
  profile: UserSafetyProfile
): { blocked: boolean; violations: string[]; message: string } {
  const forbiddenIngredients = buildForbiddenIngredients(profile);
  
  // Normalize request text: replace hyphens/underscores with spaces, handle compound words
  const normalizedRequest = requestText
    .toLowerCase()
    .replace(/[-_]/g, ' ')  // Handle compound words like "shrimp-taco" -> "shrimp taco"
    .replace(/['']/g, '')   // Remove apostrophes
    .replace(/\s+/g, ' ')   // Normalize whitespace
    .trim();
  
  // Mask plant milks and nut butters so bare "milk"/"butter" don't false-positive
  const milkMaskedRequest = maskPlantMilks(normalizedRequest);
  const milkMaskedOriginal = maskPlantMilks(requestText.toLowerCase());
  const butterMaskedRequest = maskNutButters(normalizedRequest);
  const butterMaskedOriginal = maskNutButters(requestText.toLowerCase());
  
  const violations: string[] = [];
  
  for (const forbidden of forbiddenIngredients) {
    if (!forbidden) continue;
    
    // Also normalize the forbidden term
    const normalizedForbidden = forbidden.toLowerCase().replace(/[-_]/g, ' ').trim();
    
    // For bare "milk", use masked text to avoid plant-milk false positives
    // For bare "butter", use masked text to avoid nut-butter false positives
    const isBareMilk = (normalizedForbidden === "milk");
    const isBareButter = (normalizedForbidden === "butter");
    let textToCheck = normalizedRequest;
    let origToCheck = requestText.toLowerCase();
    if (isBareMilk) { textToCheck = milkMaskedRequest; origToCheck = milkMaskedOriginal; }
    else if (isBareButter) { textToCheck = butterMaskedRequest; origToCheck = butterMaskedOriginal; }
    
    // Check with word boundaries (handles both original and normalized)
    const pattern = new RegExp(`\\b${escapeRegex(normalizedForbidden)}\\b`, 'i');
    if (pattern.test(textToCheck)) {
      violations.push(forbidden);
      continue;
    }
    
    // Also check original request for edge cases
    const originalPattern = new RegExp(`\\b${escapeRegex(forbidden)}\\b`, 'i');
    if (originalPattern.test(origToCheck)) {
      violations.push(forbidden);
    }
  }
  
  // Dedupe violations
  const uniqueViolations = Array.from(new Set(violations));
  
  if (uniqueViolations.length > 0) {
    return {
      blocked: true,
      violations: uniqueViolations,
      message: `Safety block: Your request includes ${uniqueViolations.join(", ")} which conflicts with your allergy/dietary profile. For your safety, this meal cannot be generated.`
    };
  }
  
  return {
    blocked: false,
    violations: [],
    message: ""
  };
}

/**
 * Get a safe substitute suggestion for blocked ingredients
 */
export function getSafeSubstitute(blockedIngredient: string): string {
  const substitutes: Record<string, string> = {
    shrimp: "chicken or tofu",
    crab: "jackfruit or hearts of palm",
    lobster: "mushrooms or cauliflower",
    scallop: "king oyster mushrooms",
    fish: "chicken or tempeh",
    salmon: "marinated tofu or jackfruit",
    tuna: "chickpeas",
    egg: "flax egg or silken tofu",
    eggs: "flax eggs or silken tofu",
    milk: "oat milk or almond milk",
    cheese: "nutritional yeast or vegan cheese",
    butter: "coconut oil or vegan butter",
    cream: "coconut cream",
    yogurt: "coconut yogurt",
    peanut: "sunflower seed butter",
    peanuts: "sunflower seeds",
    almond: "pumpkin seeds",
    walnut: "sunflower seeds",
    beef: "portobello mushrooms or seitan",
    pork: "jackfruit or tempeh",
    chicken: "tofu or seitan",
    gluten: "rice flour or almond flour",
    wheat: "rice or quinoa",
    soy: "coconut aminos or hemp seeds"
  };
  
  const key = blockedIngredient.toLowerCase();
  return substitutes[key] || "a suitable alternative";
}

/**
 * Log safety enforcement for auditing
 */
export function logSafetyEnforcement(
  userId: string,
  mealName: string,
  violations: string[],
  action: 'blocked' | 'regenerated' | 'passed'
) {
  const timestamp = new Date().toISOString();
  const emoji = action === 'blocked' ? '🚫' : action === 'regenerated' ? '🔄' : '✅';
  
  console.log(
    `${emoji} [SAFETY] ${timestamp} | User: ${userId} | Meal: "${mealName}" | ` +
    `Action: ${action.toUpperCase()}${violations.length > 0 ? ` | Violations: ${violations.join(", ")}` : ''}`
  );
}

// ─── VEGAN / VEGETARIAN / PESCATARIAN SUBSTITUTION MAP ───────────────────────

/**
 * Maps each commonly forbidden vegan ingredient to its best plant-based
 * replacement. Used in the post-generation substitution pass before triggering
 * an AI regeneration retry.
 *
 * Keys must be lowercase and match ingredient names as they appear in recipes.
 */
export const VEGAN_SUBSTITUTION_MAP: Record<string, string> = {
  // Sweeteners
  'honey':                  'agave syrup',
  'raw honey':              'agave syrup',
  'honey drizzle':          'maple syrup drizzle',
  'honey glaze':            'maple syrup glaze',

  // Dairy — fats
  'butter':                 'plant-based butter',
  'unsalted butter':        'plant-based butter',
  'salted butter':          'plant-based butter',
  'clarified butter':       'coconut oil',
  'ghee':                   'coconut oil',

  // Dairy — milks and cream
  'milk':                   'oat milk',
  'whole milk':             'oat milk',
  'skim milk':              'oat milk',
  '2% milk':                'oat milk',
  'heavy cream':            'coconut cream',
  'heavy whipping cream':   'coconut cream',
  'half and half':          'oat milk creamer',
  'half & half':            'oat milk creamer',
  'cream':                  'coconut cream',
  'condensed milk':         'coconut condensed milk',
  'evaporated milk':        'coconut evaporated milk',
  'buttermilk':             'plant-based buttermilk',
  'sour cream':             'cashew sour cream',

  // Dairy — cheese / yogurt
  'cheese':                 'nutritional yeast',
  'parmesan':               'nutritional yeast',
  'parmesan cheese':        'nutritional yeast',
  'mozzarella':             'vegan mozzarella',
  'cheddar':                'vegan cheddar',
  'feta':                   'vegan feta',
  'cream cheese':           'cashew cream cheese',
  'ricotta':                'tofu ricotta',
  'yogurt':                 'coconut yogurt',
  'greek yogurt':           'coconut yogurt',

  // Dairy — proteins
  'whey':                   'pea protein',
  'whey protein':           'pea protein powder',
  'whey isolate':           'pea protein powder',
  'casein':                 'pea protein',
  'casein protein':         'pea protein powder',

  // Eggs
  'egg':                    'flax egg',
  'eggs':                   'flax eggs',
  'egg white':              'aquafaba',
  'egg whites':             'aquafaba',
  'egg yolk':               'silken tofu',
  'egg yolks':              'silken tofu',

  // Gelling / thickening agents
  'gelatin':                'agar-agar',
  'collagen peptides':      'agar-agar',
  'beef collagen':          'agar-agar',
  'chicken collagen':       'agar-agar',

  // Animal fats
  'lard':                   'coconut oil',
  'suet':                   'plant-based shortening',
  'tallow':                 'coconut oil',
  'schmaltz':               'olive oil',
  'duck fat':               'olive oil',

  // Stocks and broths
  'chicken stock':          'vegetable broth',
  'chicken broth':          'vegetable broth',
  'beef stock':             'vegetable broth',
  'beef broth':             'vegetable broth',
  'bone broth':             'vegetable broth',
  'fish stock':             'seaweed-based broth',
  'fish sauce':             'soy sauce with nori',

  // Condiments / flavour agents
  'anchovies':              'capers',
  'anchovy paste':          'miso paste',
  'worcestershire sauce':   'vegan worcestershire sauce',
  'mayonnaise':             'vegan mayonnaise',
  'mayo':                   'vegan mayonnaise',
};

/**
 * Per-diet substitution map selection.
 * Vegetarian and pescatarian only share a subset of the vegan map.
 */
const VEGETARIAN_SUBSTITUTION_MAP: Record<string, string> = {
  'gelatin':        'agar-agar',
  'lard':           'plant-based shortening',
  'suet':           'plant-based shortening',
  'tallow':         'coconut oil',
  'chicken stock':  'vegetable broth',
  'chicken broth':  'vegetable broth',
  'beef stock':     'vegetable broth',
  'beef broth':     'vegetable broth',
  'bone broth':     'vegetable broth',
  'anchovies':      'capers',
  'fish sauce':     'soy sauce',
  'fish stock':     'vegetable broth',
};

const PESCATARIAN_SUBSTITUTION_MAP: Record<string, string> = {
  'lard':           'olive oil',
  'suet':           'plant-based shortening',
  'tallow':         'coconut oil',
  'chicken stock':  'vegetable broth',
  'chicken broth':  'vegetable broth',
  'beef stock':     'vegetable broth',
  'beef broth':     'vegetable broth',
  'bone broth':     'vegetable broth',
};

type DietaryMode = 'vegan' | 'vegetarian' | 'pescatarian';

function getSubstitutionMap(diet: DietaryMode): Record<string, string> {
  if (diet === 'vegetarian') return VEGETARIAN_SUBSTITUTION_MAP;
  if (diet === 'pescatarian') return PESCATARIAN_SUBSTITUTION_MAP;
  return VEGAN_SUBSTITUTION_MAP;
}

export interface SubstitutionResult {
  ingredients: Array<{ name: string; quantity: string; unit: string }>;
  substitutionsApplied: Array<{ original: string; replacement: string }>;
}

/**
 * Apply diet-appropriate ingredient substitutions to a meal's ingredient list.
 * Returns the updated ingredient list and a log of what was swapped.
 * Only performs exact-match substitutions to avoid unintended flavor changes.
 *
 * IMPORTANT: Call this at most ONCE before triggering an AI regeneration.
 */
export function applyDietarySubstitutions(
  ingredients: Array<{ name: string; quantity: string; unit: string }>,
  diet: DietaryMode,
): SubstitutionResult {
  const map = getSubstitutionMap(diet);
  const substitutionsApplied: Array<{ original: string; replacement: string }> = [];

  const updated = ingredients.map(ing => {
    const key = ing.name.toLowerCase().trim();
    const replacement = map[key];
    if (replacement) {
      substitutionsApplied.push({ original: ing.name, replacement });
      return { ...ing, name: replacement };
    }
    return ing;
  });

  return { ingredients: updated, substitutionsApplied };
}
