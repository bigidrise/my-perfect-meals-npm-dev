export type ClinicalMode =
  | "anti-inflammatory"
  | "liver-support"
  | "kidney-disease"
  | "heart-failure"
  | "liver-disease";

interface GuardrailRules {
  hardBlock: string[];
  softDiscourage: string[];
  prioritize: string[];
}

const LIVER_SUPPORT_RULES: GuardrailRules = {
  hardBlock: [
    "alcohol", "beer", "wine", "liquor", "cocktail", "cocktails",
    "deep fried", "fried chicken", "french fries", "fries",
    "soda", "sweet tea", "energy drink", "energy drinks", "juice cocktail", "juice cocktails",
    "candy", "donut", "donuts", "pastry", "pastries", "heavy syrup", "syrup",
    "processed", "fast food", "instant noodle", "instant ramen",
    "ultra processed",
  ],
  softDiscourage: [
    "bacon", "sausage", "hot dog", "hot dogs", "deli meat", "deli meats",
    "butter heavy", "cream heavy", "heavy cream",
    "salted", "jerky", "ramen",
  ],
  prioritize: [
    "spinach", "kale", "arugula", "broccoli", "cauliflower", "brussels sprouts",
    "salmon", "sardines", "sardine", "tuna", "chia", "flax", "flaxseed", "walnuts", "walnut",
    "beans", "lentils", "lentil", "oats", "oatmeal", "quinoa", "brown rice",
    "olive oil", "avocado",
  ],
};

const ANTI_INFLAMMATORY_RULES: GuardrailRules = {
  hardBlock: [],
  softDiscourage: [],
  prioritize: [
    "spinach", "kale", "arugula", "broccoli", "cauliflower", "brussels sprouts",
    "salmon", "sardines", "tuna", "chia", "flax", "walnuts",
    "beans", "lentils", "oats", "quinoa", "brown rice",
    "olive oil", "avocado", "turmeric", "ginger", "berries",
  ],
};

const KIDNEY_DISEASE_RULES: GuardrailRules = {
  hardBlock: [
    "banana", "bananas", "orange", "oranges", "potato", "potatoes", "tomato", "tomatoes",
    "spinach", "avocado", "nuts", "seeds", "chocolate", "dairy heavy", "salt heavy",
    "processed", "fast food", "soda", "energy drink",
  ],
  softDiscourage: [
    "high sodium", "salted", "jerky", "bacon", "sausage", "deli meat",
    "whole grain heavy", "beans", "lentils",
  ],
  prioritize: [
    "cauliflower", "cabbage", "green beans", "garlic", "onion",
    "apple", "blueberries", "grapes", "white rice", "egg whites",
    "chicken breast", "fish", "olive oil",
  ],
};

const HEART_FAILURE_RULES: GuardrailRules = {
  hardBlock: [
    "salt", "sodium heavy", "soy sauce", "pickles", "canned soup", "deli meat",
    "processed meat", "bacon", "sausage", "hot dog", "fast food",
    "frozen dinner", "chips", "pretzels", "salted nuts",
    "alcohol", "beer", "wine", "liquor",
  ],
  softDiscourage: [
    "butter", "cream", "cheese heavy", "full fat dairy",
    "fried", "deep fried",
  ],
  prioritize: [
    "salmon", "tuna", "sardines", "walnuts", "flaxseed",
    "oats", "barley", "quinoa", "berries", "leafy greens",
    "beans", "lentils", "sweet potato", "olive oil", "avocado",
  ],
};

const LIVER_DISEASE_RULES: GuardrailRules = {
  hardBlock: [
    "alcohol", "beer", "wine", "liquor", "cocktail",
    "deep fried", "fried chicken", "french fries",
    "soda", "energy drink", "sweet tea",
    "candy", "donut", "pastry", "heavy syrup",
    "processed", "fast food", "ultra processed",
    "raw shellfish", "raw oysters",
  ],
  softDiscourage: [
    "bacon", "sausage", "deli meat", "hot dog",
    "butter heavy", "heavy cream", "high fat",
    "salted", "jerky", "ramen",
    "red meat", "organ meat",
  ],
  prioritize: [
    "spinach", "kale", "arugula", "broccoli", "cauliflower",
    "salmon", "sardines", "tuna", "chia", "flax", "walnuts",
    "beans", "lentils", "oats", "quinoa", "brown rice",
    "olive oil", "avocado", "coffee", "green tea",
  ],
};

export function getGuardrails(dietType: string): GuardrailRules {
  if (dietType === "liver-support") return LIVER_SUPPORT_RULES;
  if (dietType === "anti-inflammatory") return ANTI_INFLAMMATORY_RULES;
  if (dietType === "kidney-disease") return KIDNEY_DISEASE_RULES;
  if (dietType === "heart-failure") return HEART_FAILURE_RULES;
  if (dietType === "liver-disease") return LIVER_DISEASE_RULES;
  return { hardBlock: [], softDiscourage: [], prioritize: [] };
}

function textMatchesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function getMealText(meal: { title?: string; name?: string; ingredients?: Array<{ item?: string; name?: string }> }): string {
  const parts: string[] = [];
  if (meal.title) parts.push(meal.title);
  if (meal.name) parts.push(meal.name);
  if (meal.ingredients) {
    for (const ing of meal.ingredients) {
      if (ing.item) parts.push(ing.item);
      if (ing.name) parts.push(ing.name);
    }
  }
  return parts.join(" ");
}

export function isMealAllowed(dietType: string, meal: { title?: string; name?: string; ingredients?: Array<{ item?: string; name?: string }> }): boolean {
  const rules = getGuardrails(dietType);
  if (rules.hardBlock.length === 0) return true;
  const text = getMealText(meal);
  return !textMatchesAny(text, rules.hardBlock);
}

export function filterPremadesByGuardrails<T extends { title?: string; name?: string; ingredients?: Array<{ item?: string; name?: string }> }>(
  dietType: string,
  meals: T[],
): T[] {
  const rules = getGuardrails(dietType);
  if (rules.hardBlock.length === 0) return meals;
  return meals.filter((meal) => isMealAllowed(dietType, meal));
}

export function applyGuardrailsToPrompt(dietType: string, basePrompt: string): string {
  const rules = getGuardrails(dietType);

  if (dietType === "liver-support") {
    const guardrailBlock = `
LIVER SUPPORT CLINICAL GUARDRAILS (MANDATORY):
These constraints are medically required. Do not override.

HARD BLOCKED — Never include these in any meal:
- No alcohol of any kind (beer, wine, liquor, cocktails)
- No deep fried foods (fried chicken, french fries, fried anything)
- No high added sugar (candy, donuts, pastries, heavy syrup, soda, sweet tea, energy drinks, juice cocktails)
- No ultra-processed foods (fast food, instant noodles, processed junk)

STRONGLY DISCOURAGED — Avoid unless specifically requested:
- Processed meats (bacon, sausage, hot dogs, deli meat)
- Heavy butter/cream-based dishes
- High sodium foods (jerky, heavily salted items, ramen)

PRIORITIZE — Include these ingredients when possible:
- Leafy greens: ${rules.prioritize.filter(k => ["spinach", "kale", "arugula"].includes(k)).join(", ")}
- Cruciferous vegetables: ${rules.prioritize.filter(k => ["broccoli", "cauliflower", "brussels sprouts"].includes(k)).join(", ")}
- Omega-3 rich: ${rules.prioritize.filter(k => ["salmon", "sardines", "tuna", "chia", "flax", "flaxseed", "walnuts", "walnut"].includes(k)).join(", ")}
- Legumes & whole grains: ${rules.prioritize.filter(k => ["beans", "lentils", "lentil", "oats", "oatmeal", "quinoa", "brown rice"].includes(k)).join(", ")}
- Healthy fats: olive oil, avocado

These guardrails apply to meal composition only. Do NOT override the user's macro targets.
`;
    return basePrompt + "\n" + guardrailBlock;
  }

  if (dietType === "kidney-disease") {
    const guardrailBlock = `
KIDNEY DISEASE CLINICAL GUARDRAILS (MANDATORY):
These constraints are medically required for renal diet compliance. Do not override.

HARD BLOCKED — Never include:
- High-potassium foods: bananas, oranges, potatoes, tomatoes, spinach, avocado
- High-phosphorus foods: nuts, seeds, chocolate, dairy-heavy dishes
- High-sodium processed foods: fast food, soda, energy drinks

STRONGLY DISCOURAGED:
- Salted or cured meats (bacon, sausage, jerky, deli meat)
- Large portions of whole grains, beans, or lentils
- High-sodium condiments

PRIORITIZE:
- Low-potassium vegetables: cauliflower, cabbage, green beans, garlic, onion
- Low-potassium fruits: apples, blueberries, grapes
- Lean proteins: egg whites, chicken breast, white fish
- Simple carbs when needed: white rice
- Healthy fats: olive oil

These guardrails apply to meal composition only. Do NOT override macro targets.
`;
    return basePrompt + "\n" + guardrailBlock;
  }

  if (dietType === "heart-failure") {
    const guardrailBlock = `
HEART FAILURE CLINICAL GUARDRAILS (MANDATORY):
These constraints are medically required for cardiac diet compliance. Do not override.

HARD BLOCKED — Never include:
- High-sodium foods: table salt, soy sauce, pickles, canned soups, deli meats, chips, pretzels, salted nuts, frozen dinners, fast food
- Alcohol of any kind (beer, wine, liquor)
- Processed and cured meats (bacon, sausage, hot dogs)

STRONGLY DISCOURAGED:
- Butter-heavy or cream-heavy dishes
- Full-fat dairy in large amounts
- Deep-fried foods

PRIORITIZE — Heart-healthy foods:
- Omega-3 rich: salmon, tuna, sardines, walnuts, flaxseed
- Whole grains: oats, barley, quinoa
- Antioxidants: berries, leafy greens
- Legumes: beans, lentils
- Complex carbs: sweet potato
- Healthy fats: olive oil, avocado

These guardrails apply to meal composition only. Do NOT override macro targets.
`;
    return basePrompt + "\n" + guardrailBlock;
  }

  if (dietType === "liver-disease") {
    const guardrailBlock = `
LIVER DISEASE CLINICAL GUARDRAILS (MANDATORY):
These constraints are medically required for hepatic diet compliance. Do not override.

HARD BLOCKED — Never include:
- Alcohol of any kind (beer, wine, liquor, cocktails)
- Raw shellfish or raw oysters (infection risk)
- Deep fried foods
- High added sugar (candy, donuts, pastries, soda, sweet tea, energy drinks)
- Ultra-processed foods (fast food, instant noodles)

STRONGLY DISCOURAGED:
- Processed meats (bacon, sausage, hot dogs, deli meat)
- Organ meats (liver, kidney)
- Heavy butter or cream-based dishes
- High-fat red meat
- High-sodium foods (jerky, ramen)

PRIORITIZE:
- Cruciferous vegetables: broccoli, cauliflower
- Leafy greens: spinach, kale, arugula
- Omega-3 rich: salmon, sardines, tuna, chia, flax, walnuts
- Legumes and whole grains: beans, lentils, oats, quinoa, brown rice
- Healthy fats: olive oil, avocado
- Liver-supportive: coffee, green tea

These guardrails apply to meal composition only. Do NOT override macro targets.
`;
    return basePrompt + "\n" + guardrailBlock;
  }

  return basePrompt;
}
