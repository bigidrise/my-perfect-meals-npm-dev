export type ClinicalMode = "anti-inflammatory" | "liver-support";

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

export function getGuardrails(dietType: string): GuardrailRules {
  if (dietType === "liver-support") return LIVER_SUPPORT_RULES;
  if (dietType === "anti-inflammatory") return ANTI_INFLAMMATORY_RULES;
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
  if (dietType !== "liver-support") return basePrompt;

  const rules = getGuardrails(dietType);

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
