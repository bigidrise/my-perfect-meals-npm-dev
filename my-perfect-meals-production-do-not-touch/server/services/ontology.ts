// server/services/ontology.ts
// Synonyms & simple matchers for allergens, bans, and food groups.
export const ALLERGENS = {
  peanut: ["peanut", "groundnut", "arachis", "peanut butter", "peanut oil"],
  treeNuts: ["almond", "walnut", "pecan", "cashew", "hazelnut", "macadamia", "pistachio", "pine nut"],
  dairy: ["milk", "cheese", "yogurt", "butter", "cream", "ghee", "whey", "casein"],
  egg: ["egg", "eggs", "albumen", "mayonnaise"],
  soy: ["soy", "soya", "tofu", "edamame", "soy sauce"],
  gluten: ["wheat", "barley", "rye", "farro", "bulgur", "semolina", "kamut", "spelt", "seitan"],
  shellfish: ["shrimp", "prawn", "crab", "lobster", "crayfish", "krill"],
  fish: ["fish", "salmon", "tuna", "cod", "tilapia", "sardine", "mackerel", "trout", "anchovy", "haddock"],
  sesame: ["sesame", "tahini"],
};

export const VEG_WORDS = [
  "broccoli", "spinach", "kale", "lettuce", "pepper", "bell pepper", "cucumber", "carrot", 
  "tomato", "onion", "garlic", "zucchini", "eggplant", "cauliflower", "cabbage", "celery", 
  "mushroom", "asparagus", "beet", "radish", "pea", "green bean", "chili"
];

export const FRUIT_WORDS = [
  "apple", "banana", "berry", "strawberry", "blueberry", "raspberry", "orange", "grapefruit", 
  "lemon", "lime", "grape", "mango", "pineapple", "peach", "pear", "plum", "cherry", "kiwi"
];

export function anyMatch(names: string[], needles: string[]): boolean {
  const lower = names.map(n => n.toLowerCase());
  return needles.some(needle => lower.some(n => n.includes(needle.toLowerCase())));
}

export function allergenViolated(ingredientNames: string[], onboarding: any): string | null {
  const o = onboarding || {};
  
  // Check user-specific allergies first
  if (o.allergies?.length) {
    for (const a of o.allergies) {
      if (anyMatch(ingredientNames, [a])) return `allergy:${a}`;
    }
  }
  
  // Check common allergens
  if (anyMatch(ingredientNames, ALLERGENS.peanut)) return "allergy:peanut";
  if (anyMatch(ingredientNames, ALLERGENS.treeNuts)) return "allergy:treeNuts";
  if (anyMatch(ingredientNames, ALLERGENS.dairy)) return "allergy:dairy";
  if (anyMatch(ingredientNames, ALLERGENS.egg)) return "allergy:egg";
  if (anyMatch(ingredientNames, ALLERGENS.soy)) return "allergy:soy";
  if (anyMatch(ingredientNames, ALLERGENS.gluten)) return "allergy:gluten";
  if (anyMatch(ingredientNames, ALLERGENS.shellfish)) return "allergy:shellfish";
  if (anyMatch(ingredientNames, ALLERGENS.fish)) return "allergy:fish";
  if (anyMatch(ingredientNames, ALLERGENS.sesame)) return "allergy:sesame";
  
  return null;
}

export function banViolated(ingredientNames: string[], onboarding: any): string | null {
  const o = onboarding || {};
  
  if (o.noVeg && anyMatch(ingredientNames, VEG_WORDS)) return "ban:veg";
  if (o.noFruit && anyMatch(ingredientNames, FRUIT_WORDS)) return "ban:fruit";
  if (o.noMeat && anyMatch(ingredientNames, ["chicken", "beef", "pork", "lamb", "turkey", "bacon", "sausage"])) return "ban:meat";
  if (o.noFish && anyMatch(ingredientNames, ALLERGENS.fish)) return "ban:fish";
  if (o.noDairy && anyMatch(ingredientNames, ALLERGENS.dairy)) return "ban:dairy";
  if (o.noEggs && anyMatch(ingredientNames, ALLERGENS.egg)) return "ban:eggs";
  
  if (Array.isArray(o.avoid) && o.avoid.length && anyMatch(ingredientNames, o.avoid)) return "ban:avoid";
  
  return null;
}