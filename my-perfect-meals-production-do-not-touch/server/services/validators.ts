// server/services/validators.ts
import { Meal, UserOnboardingProfile } from "./mealEngineService";

export interface UnitPrefs {
  solidUnits: string[];
  liquidUnits: string[];
}

export interface ValidationFlags {
  allergiesCleared: boolean;
  medicalCleared: boolean;
  unitsStandardized: boolean;
}
export interface ValidationConfig {
  enforceLowGIForDiabetes: boolean;
  bannedUnits: string[];
}

const LOW_GI_CARBS = [
  "steel-cut oats",
  "quinoa",
  "brown rice",
  "wild rice",
  "sweet potato",
  "berries",
  "apple",
  "pear",
  "beans",
  "lentils",
  "chickpeas",
  "non-starchy vegetables",
];

const DEFAULT_CFG: ValidationConfig = {
  enforceLowGIForDiabetes: true,
  bannedUnits: ["pinch", "dash"], // force precise measures
};

/** Main validator */
export async function validateMeal(
  meal: Meal,
  profile: UserOnboardingProfile,
  cfg?: Partial<ValidationConfig>
): Promise<{ valid: boolean; flags: ValidationFlags; reasons: string[] }> {
  const conf = { ...DEFAULT_CFG, ...(cfg ?? {}) };
  const reasons: string[] = [];

  // Allergies / Avoids
  const allBans = new Set([...(profile.allergies ?? []), ...(profile.avoidIngredients ?? [])].map(norm));
  let allergiesCleared = true;
  for (const ing of meal.ingredients) {
    if (containsBanned(ing.item, allBans)) {
      allergiesCleared = false;
      reasons.push(`Banned ingredient detected: ${ing.item}`);
    }
  }

  // Medical: Diabetes GI enforcement
  let medicalCleared = true;
  if ((profile.hasDiabetesType1 || profile.hasDiabetesType2) && conf.enforceLowGIForDiabetes) {
    // crude but effective heuristic: carbs items must be from LOW_GI_CARBS or clearly low-sugar
    const carbLikeItems = meal.ingredients.filter((i) => isCarbLike(i.item));
    const badCarb = carbLikeItems.find((i) => !isLowGI(i.item));
    if (badCarb) {
      medicalCleared = false;
      reasons.push(`High-GI carb detected for diabetes profile: ${badCarb.item}`);
    }
    // Soft check on sugar
    if ((meal.nutrition?.sugar_g ?? 0) > 20) {
      medicalCleared = false;
      reasons.push(`Excess sugar: ${meal.nutrition?.sugar_g} g`);
    }
  }

  // Units enforcement
  let unitsStandardized = true;
  for (const ing of meal.ingredients) {
    if (!ing.unit || conf.bannedUnits.includes(ing.unit.toLowerCase())) {
      unitsStandardized = false;
      reasons.push(`Imprecise or banned unit: ${ing.item} (${ing.unit})`);
    }
  }

  const valid = allergiesCleared && medicalCleared && unitsStandardized;
  return {
    valid,
    flags: { allergiesCleared, medicalCleared, unitsStandardized },
    reasons,
  };
}

/** Unit rounding/normalization */
export function roundUnitsInIngredients(
  ingredients: Meal["ingredients"]
): Meal["ingredients"] {
  return ingredients.map((ing) => {
    const u = (ing.unit || "").toLowerCase();
    let amount = Number(ing.amount || 0);

    // Round common units
    if (["tbsp", "tsp"].includes(u)) {
      // quarter increments
      amount = Math.round(amount * 4) / 4;
    } else if (["cup"].includes(u)) {
      amount = Math.round(amount * 8) / 8; // 1/8 cup granularity
    } else if (["oz"].includes(u)) {
      amount = Math.round(amount * 2) / 2; // 0.5 oz
    } else if (["lb"].includes(u)) {
      amount = Math.round(amount * 20) / 20; // 0.05 lb (~0.8 oz)
    } else {
      amount = Math.round(amount * 100) / 100;
    }

    return { ...ing, amount };
  });
}

/** Helpers */
function norm(s: string) {
  return s.trim().toLowerCase();
}
function containsBanned(item: string, banned: Set<string>) {
  const n = norm(item);
  for (const b of Array.from(banned)) {
    if (n.includes(b)) return true;
  }
  return false;
}
function isCarbLike(item: string) {
  const n = norm(item);
  return ["rice", "oat", "pasta", "noodle", "bread", "tortilla", "potato", "beans", "lentil", "fruit", "banana", "apple", "pear", "berry", "quinoa"].some((k) =>
    n.includes(k)
  );
}
function isLowGI(item: string) {
  const n = norm(item);
  return LOW_GI_CARBS.some((g) => n.includes(g));
}