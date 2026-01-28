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
  ]
};

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
 * Build safety guardrails for prompts and validation
 */
export function buildSafetyGuardrails(profile: UserSafetyProfile): SafetyGuardrails {
  const allergies = profile.allergies || [];
  const restrictions = profile.dietaryRestrictions || [];
  const forbiddenIngredients = buildForbiddenIngredients(profile);
  
  const promptLines: string[] = [];
  
  if (allergies.length > 0) {
    promptLines.push(
      `🚨 CRITICAL ALLERGY SAFETY: User has life-threatening allergies to: ${allergies.join(", ")}.`
    );
    promptLines.push(
      `ABSOLUTE PROHIBITION: You must NEVER include, suggest, or use ANY of these ingredients or their derivatives: ${forbiddenIngredients.slice(0, 50).join(", ")}${forbiddenIngredients.length > 50 ? '...' : ''}.`
    );
  }
  
  if (restrictions.length > 0) {
    promptLines.push(
      `DIETARY REQUIREMENTS: User follows ${restrictions.join(", ")} diet. Strictly comply with these restrictions.`
    );
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
  
  // Check each forbidden ingredient
  for (const forbidden of forbiddenIngredients) {
    if (!forbidden) continue;
    
    // Use word boundary matching to avoid false positives
    // e.g., "shrimp" should match "shrimp" but not "shrimply"
    const pattern = new RegExp(`\\b${escapeRegex(forbidden)}\\b`, 'i');
    if (pattern.test(fullText)) {
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
  
  const violations: string[] = [];
  
  for (const forbidden of forbiddenIngredients) {
    if (!forbidden) continue;
    
    // Also normalize the forbidden term
    const normalizedForbidden = forbidden.toLowerCase().replace(/[-_]/g, ' ').trim();
    
    // Check with word boundaries (handles both original and normalized)
    const pattern = new RegExp(`\\b${escapeRegex(normalizedForbidden)}\\b`, 'i');
    if (pattern.test(normalizedRequest)) {
      violations.push(forbidden);
      continue;
    }
    
    // Also check original request for edge cases
    const originalPattern = new RegExp(`\\b${escapeRegex(forbidden)}\\b`, 'i');
    if (originalPattern.test(requestText.toLowerCase())) {
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
