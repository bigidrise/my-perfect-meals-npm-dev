/**
 * calorieEstimator.ts
 *
 * Pure, dependency-free utility functions extracted from unifiedMealPipeline.ts.
 * They are kept here so they can be unit-tested without importing the entire
 * pipeline (which has many heavyweight side-effect imports).
 *
 * These functions act as a *plausibility gate* — they are intentionally
 * approximate and catch order-of-magnitude errors, not rounding differences.
 */

// ─────────────────────────────────────────────────────────────────────────────
// estimateCaloriesFromIngredients
// ─────────────────────────────────────────────────────────────────────────────

/** Rough per-serving calorie estimate from ingredient list.
 *  Used ONLY as a plausibility gate — not as a nutrition calculator.
 *  Catches catastrophic AI-reported vs. ingredient-implied calorie mismatches.
 *  Accuracy is intentionally approximate; tolerances are loose enough to allow
 *  cooking-loss variance while catching order-of-magnitude failures. */
export function estimateCaloriesFromIngredients(
  ingredients: Array<{ name: string; quantity: string; unit: string }>,
  servings: number = 1
): number {
  const s = Math.max(1, servings);

  // qty + unit → approximate grams
  const toGrams = (qty: number, unit: string, name: string): number => {
    const u = unit.toLowerCase().trim();
    const n = name.toLowerCase();
    if (u === 'cup' || u === 'cups') {
      if (n.includes('flour') && !n.includes('almond')) return qty * 125;
      if (n.includes('almond flour') || n.includes('almond meal')) return qty * 96;
      if (n.includes('sugar') || n.includes('sweetener')) return qty * 200;
      if (n.includes('oil') || n.includes('butter') || n.includes('ghee') || n.includes('shortening')) return qty * 218;
      if (n.includes('cream') || n.includes('milk') || n.includes('water') || n.includes('juice')) return qty * 240;
      return qty * 150; // default solid
    }
    if (u === 'tbsp' || u === 'tablespoon' || u === 'tablespoons') return qty * 14;
    if (u === 'tsp' || u === 'teaspoon' || u === 'teaspoons') return qty * 5;
    if (u === 'oz' || u === 'ounce' || u === 'ounces') return qty * 28;
    if (u === 'lb' || u === 'pound' || u === 'pounds') return qty * 454;
    if (u === 'g' || u === 'gram' || u === 'grams') return qty;
    if (u === 'kg') return qty * 1000;
    if (u === 'ml' || u === 'milliliter' || u === 'milliliters') return qty;
    return qty; // fallback: assume grams
  };

  // kcal per 100g by ingredient category
  const kcalPer100g = (name: string): number => {
    const n = name.toLowerCase();
    if (/\b(oil|coconut oil|vegetable oil|olive oil|avocado oil|canola)\b/.test(n)) return 884;
    if (/\b(butter|ghee|shortening|lard|margarine)\b/.test(n)) return 720;
    if (/\b(almond flour|almond meal)\b/.test(n)) return 580;
    if (/\b(coconut flour)\b/.test(n)) return 440;
    if (/\b(flour|all.purpose|whole.wheat|wheat flour)\b/.test(n)) return 360;
    if (/\b(sugar|brown sugar|cane sugar|coconut sugar)\b/.test(n)) return 400;
    if (/\b(honey|maple syrup|agave)\b/.test(n)) return 300;
    if (/\b(heavy cream|whipping cream)\b/.test(n)) return 345;
    if (/\b(coconut cream)\b/.test(n)) return 230;
    if (/\b(coconut milk)\b/.test(n)) return 150;
    if (/\b(cream cheese)\b/.test(n)) return 350;
    if (/\b(cheese|cheddar|parmesan|mozzarella|feta|gouda)\b/.test(n)) return 380;
    if (/\b(chocolate|cocoa butter|cacao)\b/.test(n) && !/powder/.test(n)) return 550;
    if (/\b(cocoa powder|cacao powder)\b/.test(n)) return 230;
    if (/\b(peanut butter|almond butter|nut butter|tahini)\b/.test(n)) return 590;
    if (/\b(almond|cashew|walnut|pecan|macadamia|pistachio|pine nut)\b/.test(n)) return 600;
    if (/\b(oat|oats|rolled oat|granola)\b/.test(n)) return 380;
    if (/\b(rice|quinoa|couscous)\b/.test(n)) return 130;
    if (/\b(pasta|noodle|spaghetti|penne|fettuccine)\b/.test(n)) return 140;
    if (/\b(bread|tortilla|cracker|pita)\b/.test(n)) return 265;
    if (/\b(potato|sweet potato|yam)\b/.test(n)) return 85;
    if (/\b(chicken|turkey|beef|pork|lamb|fish|salmon|tuna|shrimp|cod)\b/.test(n)) return 165;
    if (/\b(egg)\b/.test(n) && !/eggplant/.test(n)) return 155;
    if (/\b(milk|yogurt|kefir|buttermilk)\b/.test(n)) return 60;
    if (/\b(fruit|apple|banana|mango|berry|strawberry|blueberry|raspberry|cherry)\b/.test(n)) return 55;
    if (/\b(avocado)\b/.test(n)) return 160;
    if (/\b(bean|lentil|chickpea|legume)\b/.test(n)) return 110;
    if (/\b(tofu|tempeh)\b/.test(n)) return 120;
    if (/\b(vegetable|broccoli|spinach|kale|carrot|onion|pepper|tomato|zucchini|mushroom|cucumber|lettuce|celery|cauliflower|asparagus)\b/.test(n)) return 25;
    return 80; // default: moderate density
  };

  let totalKcal = 0;
  for (const ing of ingredients) {
    const qty = parseFloat(ing.quantity) || 0;
    if (!qty || !ing.name) continue;
    const grams = toGrams(qty, ing.unit || '', ing.name);
    totalKcal += (grams / 100) * kcalPer100g(ing.name);
  }

  return totalKcal / s; // per-serving estimate
}

// ─────────────────────────────────────────────────────────────────────────────
// checkIngredientSanity
// ─────────────────────────────────────────────────────────────────────────────

export interface SanityIngredient {
  name: string;
  quantity: string;
  unit: string;
}

export interface SanityOption {
  name?: string;
  ingredients?: SanityIngredient[];
}

/** Dish-class-aware ingredient quantity sanity check.
 *  Returns false when any single ingredient quantity is unrealistic for the
 *  given dish class (baked, confection, or standard) and serving count.
 *  Intended to catch catastrophic AI output — not to enforce culinary precision. */
export function checkIngredientSanity(
  options: SanityOption[],
  servings: number = 1,
  description?: string
): boolean {
  const s = Math.max(1, servings);

  // Dish-class detection — calibrates thresholds to realistic culinary ratios
  const desc = (description || '').toLowerCase();
  const isBaked = /\b(cake|cookie|cookies|bread|loaf|muffin|muffins|brownie|brownies|pastry|cupcake|cupcakes|scone|scones|biscuit|biscuits|pancake|pancakes|waffle|waffles|tart|pie|danish|croissant)\b/.test(desc);
  const isConfection = /\b(truffle|fudge|candy|caramel|toffee|praline|nougat)\b/.test(desc);
  const isBakedOrConfection = isBaked || isConfection;

  for (const opt of options) {
    for (const ing of (opt.ingredients || [])) {
      const name = (ing.name || '').toLowerCase();
      const unit = (ing.unit || '').toLowerCase();
      const qty = parseFloat(ing.quantity) || 0;
      if (!qty) continue;
      const isCup = unit === 'cup' || unit === 'cups';

      // Eggs
      if (name.includes('egg') && !name.includes('eggplant') && !name.includes('noodle')) {
        if (qty > Math.max(6, 4 * s)) {
          return false;
        }
      }

      // Flour — baked goods: ≤1.5 cups/serving; standard: ≤4 cups/serving
      if (name.includes('flour') && isCup) {
        const flourLimit = isBakedOrConfection ? Math.max(1.5, 1.5 * s) : Math.max(8, 4 * s);
        if (qty > flourLimit) {
          return false;
        }
      }

      // Added fats in cups — baked: ≤0.5 cup total (≤0.25/serving); standard: ≤1 cup total
      const isFat = /\b(oil|butter|coconut oil|ghee|shortening|lard|margarine)\b/.test(name);
      if (isFat && isCup) {
        const fatLimit = isBakedOrConfection ? Math.max(0.5, 0.25 * s) : Math.max(1.0, 0.5 * s);
        if (qty > fatLimit) {
          return false;
        }
      }

      // Added sugars in cups — ≤0.25 cup/serving regardless of dish class
      const isSugar = /\b(sugar|coconut sugar|brown sugar|cane sugar)\b/.test(name);
      if (isSugar && isCup) {
        const sugarLimit = Math.max(0.5, 0.25 * s);
        if (qty > sugarLimit) {
          return false;
        }
      }

      // Heavy liquids in cups (coconut cream, heavy cream) — ≤0.5 cup/serving
      const isHeavyLiquid = /\b(coconut cream|heavy cream|condensed milk|evaporated milk)\b/.test(name);
      if (isHeavyLiquid && isCup) {
        const liquidLimit = Math.max(1.0, 0.5 * s);
        if (qty > liquidLimit) {
          return false;
        }
      }
    }
  }
  return true;
}
