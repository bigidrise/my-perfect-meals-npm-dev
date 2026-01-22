export interface AllergyAlertConfig {
  title: string;
  description: string;
  variant: "warning" | "destructive" | "default";
}

const ALLERGY_KEYWORDS = [
  "allergy",
  "allergen",
  "allergens",
  "allergies",
  "safety block",
  "safety profile",
  "conflicts with your",
  "marked as unsafe",
  "blocked",
  "safetyguard",
  "dairy",
  "shellfish",
  "peanut",
  "tree nut",
  "gluten",
  "soy",
  "egg",
  "fish",
  "sesame",
];

const ALLERGEN_PATTERNS = [
  { pattern: /contains?\s+(\w+(?:\s+\w+)?)\s+which\s+conflicts/i, group: 1 },
  { pattern: /includes?\s+([^,]+)\s+which\s+conflicts/i, group: 1 },
  { pattern: /safety block:.*includes?\s+([^,]+)\s+which/i, group: 1 },
];

const ALLERGEN_TIPS: Record<string, string> = {
  dairy: "Ask for dairy-free or use coconut/almond milk alternatives",
  milk: "Request plant-based milk or skip the cheese",
  cheese: "Ask them to hold the cheese or use dairy-free alternatives",
  butter: "Request olive oil or dairy-free spread instead",
  cream: "Ask for coconut cream or skip the sauce",
  shellfish: "Try the dish with chicken, tofu, or just vegetables instead",
  shrimp: "Substitute with chicken, fish, or extra vegetables",
  crab: "Request chicken or white fish as a swap",
  lobster: "Ask for a different protein like grilled fish or chicken",
  peanut: "Request no peanuts or peanut sauce - try sesame or tahini instead",
  "peanut oil": "Ask if they can cook with vegetable or olive oil instead",
  "tree nut": "Ask them to prepare without nuts - seeds are often a safe swap",
  almond: "Request no almonds - sunflower seeds work great instead",
  cashew: "Ask to skip the cashews or use seeds instead",
  walnut: "Request no walnuts - pumpkin seeds are a tasty alternative",
  gluten: "Order it gluten-free or ask for rice/corn-based alternatives",
  wheat: "Request rice, corn tortillas, or gluten-free bread",
  bread: "Ask for a lettuce wrap or gluten-free bread option",
  pasta: "Request rice noodles or gluten-free pasta",
  soy: "Ask for no soy sauce - coconut aminos is a great substitute",
  tofu: "Swap tofu for chicken, shrimp, or extra vegetables",
  egg: "Request no egg - many dishes work great without it",
  fish: "Substitute with chicken, beef, or plant-based protein",
  salmon: "Try chicken or shrimp as an alternative",
  tuna: "Request chicken or a vegetarian option instead",
  sesame: "Ask for no sesame seeds or sesame oil",
};

function extractAllergen(errorMessage: string): string | null {
  if (!errorMessage) return null;
  
  for (const { pattern, group } of ALLERGEN_PATTERNS) {
    const match = errorMessage.match(pattern);
    if (match && match[group]) {
      return match[group].trim().toLowerCase();
    }
  }
  
  const lower = errorMessage.toLowerCase();
  for (const allergen of Object.keys(ALLERGEN_TIPS)) {
    if (lower.includes(allergen)) {
      return allergen;
    }
  }
  
  return null;
}

function getProTip(allergen: string | null): string {
  if (!allergen) {
    return "Pro tip: Ask for ingredient substitutions or try a different preparation style.";
  }
  
  const tip = ALLERGEN_TIPS[allergen.toLowerCase()];
  if (tip) {
    return `Pro tip: ${tip}`;
  }
  
  return `Pro tip: Ask for this dish without ${allergen}, or request a safe substitution.`;
}

export function isAllergyRelatedError(errorMessage: string): boolean {
  if (!errorMessage) return false;
  const lower = errorMessage.toLowerCase();
  return ALLERGY_KEYWORDS.some(keyword => lower.includes(keyword));
}

export function getAllergyAlertConfig(errorMessage: string): AllergyAlertConfig {
  if (isAllergyRelatedError(errorMessage)) {
    const allergen = extractAllergen(errorMessage);
    return {
      title: "⚠️ ALLERGY ALERT",
      description: getProTip(allergen),
      variant: "warning",
    };
  }
  
  return {
    title: "⚠️ ALLERGY ALERT",
    description: "SafetyGuard™ detected a potential concern. Try a different meal or adjust your request.",
    variant: "warning",
  };
}

export function formatAllergyAlertDescription(errorMessage: string): string {
  const allergen = extractAllergen(errorMessage);
  return getProTip(allergen);
}
