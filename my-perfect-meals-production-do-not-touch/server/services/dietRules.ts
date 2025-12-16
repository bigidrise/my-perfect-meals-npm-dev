// server/services/dietRules.ts
// Dietary rule packs: low‑FODMAP, kosher, halal. Conservative enforcement.
import { ALLERGENS, anyMatch } from "./ontology";

export type DietContext = {
  // minimal fields we rely on from onboarding
  kosher?: boolean;
  halal?: boolean;
  lowFodmap?: boolean;
};

// High‑FODMAP red flags (coarse list; expand over time)
const HIGH_FODMAP = [
  // aromatics
  "onion","garlic","shallot","leek",
  // wheat/gluten sources (gluten already handled elsewhere; keep popular items here)
  "wheat","barley","rye","bulgur","farro","semolina","seitan",
  // legumes high-FODMAP
  "chickpea","garbanzo","lentil","kidney bean","black bean","baked beans","pinto bean",
  // fruit high-FODMAP
  "apple","pear","mango","watermelon","cherry","plum","peach",
  // sweeteners
  "honey","agave","high fructose corn syrup",
  // dairy lactose sources (hard cheeses often okay, but we keep conservative)
  "milk","soft cheese","yogurt","ice cream","cream",
  // misc
  "cauliflower","mushroom" // polyols
];

const PORK_WORDS = ["pork","bacon","ham","prosciutto","pepperoni","salami","pancetta","lardon"];
const ALCOHOL_WORDS = ["wine","beer","ale","lager","stout","rum","whiskey","bourbon","vodka","gin","brandy","liqueur","sake","soju"];

export function violatesLowFodmap(ingredientNames: string[]): string | null {
  return anyMatch(ingredientNames, HIGH_FODMAP) ? "diet:low_fodmap" : null;
}

export function violatesKosher(ingredientNames: string[]): string | null {
  // Core: no pork, no shellfish, no fish without fins/scales (we only check shellfish here), no meat+dairy mix (basic heuristic)
  if (anyMatch(ingredientNames, PORK_WORDS)) return "diet:kosher_pork";
  if (anyMatch(ingredientNames, ALLERGENS.shellfish)) return "diet:kosher_shellfish";
  const hasMeat = anyMatch(ingredientNames, ["chicken","beef","lamb","turkey","veal","goat"]);
  const hasDairy = anyMatch(ingredientNames, ALLERGENS.dairy);
  if (hasMeat && hasDairy) return "diet:kosher_meat_dairy";
  return null;
}

export function violatesHalal(ingredientNames: string[]): string | null {
  // Core: no pork, no alcohol. (We cannot validate slaughter method; we err on minimal safe constraints.)
  if (anyMatch(ingredientNames, PORK_WORDS)) return "diet:halal_pork";
  if (anyMatch(ingredientNames, ALCOHOL_WORDS)) return "diet:halal_alcohol";
  return null;
}

export function validateDietPacks(ingredientNames: string[], ctx: DietContext): string | null {
  if (ctx?.lowFodmap) {
    const v = violatesLowFodmap(ingredientNames); if (v) return v;
  }
  if (ctx?.kosher) {
    const v = violatesKosher(ingredientNames); if (v) return v;
  }
  if (ctx?.halal) {
    const v = violatesHalal(ingredientNames); if (v) return v;
  }
  return null;
}