/**
 * calorieEstimator.test.ts
 *
 * Unit tests for the two nutrition-plausibility gate functions extracted from
 * the chef pipeline:
 *
 *   estimateCaloriesFromIngredients — rough per-serving estimate used to
 *     compare against LLM-reported calories (catches order-of-magnitude errors).
 *
 *   checkIngredientSanity — dish-class-aware quantity check that flags
 *     unrealistic ingredient amounts before reaching the user.
 *
 * Test philosophy:
 *   - Cover 5-10 real-recipe archetypes (oil-heavy, protein-heavy, veg-forward,
 *     baked goods, confections, high-fat snacks, standard dinners).
 *   - Confirm the original motivating failure case (2 cups coconut oil for a
 *     2-serving cake) is caught.
 *   - Confirm legitimate edge cases do NOT trigger false positives.
 *   - Verify the LOW=0.35 / HIGH=2.5 thresholds as used in the pipeline.
 */

import {
  estimateCaloriesFromIngredients,
  checkIngredientSanity,
} from '../services/calorieEstimator';

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

type Ing = { name: string; quantity: string; unit: string };

function ing(name: string, quantity: string | number, unit: string): Ing {
  return { name, quantity: String(quantity), unit };
}

/**
 * Mirrors the pipeline's plausibility check.
 * Returns 'PASS' | 'LOW' | 'HIGH'
 */
function plausibilityOutcome(
  reported: number,
  ingredients: Ing[],
  servings = 1
): 'PASS' | 'LOW' | 'HIGH' {
  const est = estimateCaloriesFromIngredients(ingredients, servings);
  if (est === 0) return 'PASS'; // can't gate on a zero estimate
  const ratio = reported / est;
  const LOW = 0.35;
  const HIGH = 2.5;
  if (ratio < LOW) return 'LOW';  // reported < 35% of estimate → under-reporting
  if (ratio > HIGH) return 'HIGH'; // reported > 250% of estimate → over-reporting
  return 'PASS';
}

// ─────────────────────────────────────────────────────────────────────────────
// estimateCaloriesFromIngredients
// ─────────────────────────────────────────────────────────────────────────────

describe('estimateCaloriesFromIngredients', () => {

  // ── Unit conversion sanity ─────────────────────────────────────────────────

  test('returns 0 for empty ingredient list', () => {
    expect(estimateCaloriesFromIngredients([], 1)).toBe(0);
  });

  test('handles ingredients with zero quantity gracefully', () => {
    const ings = [ing('olive oil', 0, 'tbsp'), ing('chicken', '0', 'oz')];
    expect(estimateCaloriesFromIngredients(ings, 1)).toBe(0);
  });

  test('tbsp oil contributes expected calories (~120 kcal for 1 tbsp)', () => {
    // 1 tbsp = 14 g; oil = 884 kcal/100g → 14 * 8.84 ≈ 123.8
    const ings = [ing('olive oil', 1, 'tbsp')];
    const est = estimateCaloriesFromIngredients(ings, 1);
    expect(est).toBeGreaterThan(100);
    expect(est).toBeLessThan(150);
  });

  test('scales by servings correctly: 2 servings halves per-serving estimate', () => {
    const ings = [ing('chicken breast', 8, 'oz')]; // same ingredient
    const single = estimateCaloriesFromIngredients(ings, 1);
    const double = estimateCaloriesFromIngredients(ings, 2);
    expect(double).toBeCloseTo(single / 2, 0);
  });

  // ── Oil-heavy recipe (original failure case) ───────────────────────────────

  test('FAIL: 2 cups coconut oil in a 2-serving cake → catastrophically high estimate', () => {
    // 2 cups coconut oil + basic cake ingredients, 2 servings
    // coconut oil: 2 cups × 218 g/cup × 884 kcal/100g ÷ 2 servings ≈ 1930 kcal/serving
    const ings = [
      ing('coconut oil', 2, 'cups'),
      ing('all-purpose flour', 1.5, 'cups'),
      ing('sugar', 0.5, 'cups'),
      ing('eggs', 3, 'whole'),
      ing('vanilla extract', 1, 'tsp'),
    ];
    const reported = 800; // what the LLM claimed
    expect(plausibilityOutcome(reported, ings, 2)).toBe('LOW');
  });

  test('PASS: realistic coconut oil cake (0.25 cup fat, 2 servings) plausibility gate passes', () => {
    const ings = [
      ing('coconut oil', 0.25, 'cups'),  // ~475 kcal from fat
      ing('all-purpose flour', 1.5, 'cups'), // ~675 kcal
      ing('sugar', 0.5, 'cups'),         // ~400 kcal
      ing('eggs', 3, 'whole'),
      ing('vanilla extract', 1, 'tsp'),
    ];
    // Total ≈ ~1870 kcal recipe / 2 servings ≈ 935 kcal/serving
    // Reported 700 kcal → ratio 0.75 → should PASS
    expect(plausibilityOutcome(700, ings, 2)).toBe('PASS');
  });

  // ── Protein-heavy recipe ───────────────────────────────────────────────────

  test('PASS: chicken breast + rice dinner is plausible at reported ~520 kcal', () => {
    // 6 oz chicken (165 kcal/100g) + 1 cup rice (cooked) + 1 tbsp olive oil
    const ings = [
      ing('chicken breast', 6, 'oz'),   // 170g × 1.65 ≈ 280 kcal
      ing('rice', 1, 'cups'),           // 150g × 1.30 ≈ 195 kcal
      ing('olive oil', 1, 'tbsp'),      // 14g × 8.84 ≈ 124 kcal
      ing('broccoli', 1, 'cups'),       // 150g × 0.25 ≈ 38 kcal
    ];
    // Estimated ≈ 637 kcal; reported 520 → ratio 0.82 → PASS
    expect(plausibilityOutcome(520, ings, 1)).toBe('PASS');
  });

  test('FAIL: protein-heavy recipe with wildly over-reported calories is caught', () => {
    // Same recipe as above but LLM reports 2000 kcal for a 520-kcal dish
    const ings = [
      ing('chicken breast', 6, 'oz'),
      ing('rice', 1, 'cups'),
      ing('olive oil', 1, 'tbsp'),
      ing('broccoli', 1, 'cups'),
    ];
    // estimated ≈ 637; reported 2000 → ratio ≈ 3.14 → HIGH
    expect(plausibilityOutcome(2000, ings, 1)).toBe('HIGH');
  });

  // ── Vegetable-forward recipe ───────────────────────────────────────────────

  test('PASS: veg stir-fry with light oil is plausible at reported ~200 kcal', () => {
    const ings = [
      ing('broccoli', 2, 'cups'),       // 300g × 0.25 ≈ 75 kcal
      ing('spinach', 2, 'cups'),        // 300g × 0.25 ≈ 75 kcal
      ing('carrot', 1, 'cups'),         // 150g × 0.25 ≈ 38 kcal
      ing('olive oil', 1, 'tbsp'),      // ≈ 124 kcal
      ing('tofu', 100, 'g'),            // 120 kcal
    ];
    // Estimated ≈ 432 kcal; reported 200 → ratio 0.46 → PASS (above 0.35)
    expect(plausibilityOutcome(200, ings, 1)).toBe('PASS');
  });

  test('FAIL: veg salad with near-zero reported calories is caught when estimate is significant', () => {
    // Oil-dressed salad: olive oil alone is ~370 kcal for 3 tbsp
    const ings = [
      ing('olive oil', 3, 'tbsp'),      // ≈ 371 kcal
      ing('lettuce', 2, 'cups'),
      ing('tomato', 1, 'cups'),
      ing('cucumber', 1, 'cups'),
    ];
    // Estimated ≈ ~450 kcal; reported 10 → ratio 0.02 → LOW
    expect(plausibilityOutcome(10, ings, 1)).toBe('LOW');
  });

  // ── Baked goods / dessert ─────────────────────────────────────────────────

  test('PASS: standard butter cake recipe per serving is plausible at 350 kcal', () => {
    // 12-serving cake: 2 cups flour, 1 cup butter, 1.5 cups sugar, 4 eggs
    const ings = [
      ing('all-purpose flour', 2, 'cups'),  // 250g × 3.60 = 900 kcal
      ing('butter', 1, 'cups'),             // 218g × 7.20 = 1570 kcal
      ing('sugar', 1.5, 'cups'),            // 300g × 4.00 = 1200 kcal
      ing('eggs', 4, 'whole'),              // ~4×75g×1.55 ≈ 465 kcal
      ing('vanilla extract', 1, 'tsp'),
    ];
    // Total ≈ 4135 kcal / 12 servings ≈ 345 kcal/serving
    // Reported 350 → ratio ≈ 1.01 → PASS
    expect(plausibilityOutcome(350, ings, 12)).toBe('PASS');
  });

  test('PASS: almond flour muffins — legitimate high-fat recipe does not false-positive', () => {
    // 6 muffins: 2 cups almond flour, 0.25 cup coconut oil, 0.25 cup honey
    const ings = [
      ing('almond flour', 2, 'cups'),   // 192g × 5.80 = 1114 kcal
      ing('coconut oil', 0.25, 'cups'), // 54.5g × 8.84 = 482 kcal
      ing('honey', 0.25, 'cups'),       // 60g × 3.00 = 180 kcal
      ing('eggs', 3, 'whole'),          // ≈ 349 kcal
    ];
    // Total ≈ 2125 kcal / 6 muffins ≈ 354 kcal/muffin
    // Reported 320 → ratio ≈ 0.90 → PASS
    expect(plausibilityOutcome(320, ings, 6)).toBe('PASS');
  });

  // ── High-fat snack ────────────────────────────────────────────────────────

  test('PASS: nut butter and oat energy balls at ~180 kcal each passes gate', () => {
    // 12 balls: 1 cup peanut butter, 2 cups oats, 0.25 cup honey
    const ings = [
      ing('peanut butter', 1, 'cups'),  // 218g × 5.90 ≈ 1286 kcal
      ing('oats', 2, 'cups'),           // 300g × 3.80 ≈ 1140 kcal
      ing('honey', 0.25, 'cups'),       // 60g × 3.00 ≈ 180 kcal
    ];
    // Total ≈ 2606 / 12 ≈ 217 kcal/ball
    // Reported 180 → ratio ≈ 0.83 → PASS
    expect(plausibilityOutcome(180, ings, 12)).toBe('PASS');
  });

  // ── Gram-based ingredients ────────────────────────────────────────────────

  test('gram-based salmon fillet estimates correctly', () => {
    const ings = [
      ing('salmon', 150, 'g'),   // 150g × 1.65 ≈ 248 kcal
      ing('olive oil', 1, 'tbsp'), // ≈ 124 kcal
    ];
    const est = estimateCaloriesFromIngredients(ings, 1);
    expect(est).toBeGreaterThan(300);
    expect(est).toBeLessThan(450);
  });

  test('lb-based beef recipe contributes proportionally more calories than oz-based', () => {
    const oz = estimateCaloriesFromIngredients([ing('beef', 8, 'oz')], 1);
    const lb = estimateCaloriesFromIngredients([ing('beef', 0.5, 'lb')], 1);
    // 8 oz = 0.5 lb, so they should be equal
    expect(Math.abs(oz - lb)).toBeLessThan(5);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// checkIngredientSanity
// ─────────────────────────────────────────────────────────────────────────────

describe('checkIngredientSanity', () => {

  // ── The original motivating failure ──────────────────────────────────────

  test('FAIL: 2 cups coconut oil in a 2-serving cake is caught', () => {
    const options = [{
      name: 'Coconut Oil Cake',
      ingredients: [
        ing('coconut oil', 2, 'cups'),
        ing('all-purpose flour', 1.5, 'cups'),
        ing('sugar', 0.5, 'cup'),
        ing('eggs', 3, 'whole'),
      ],
    }];
    expect(checkIngredientSanity(options, 2, 'chocolate coconut oil cake')).toBe(false);
  });

  // ── Baked-class thresholds ────────────────────────────────────────────────

  test('FAIL: more than 0.5 cup butter in a single-serving brownie', () => {
    const options = [{
      name: 'Brownie',
      ingredients: [ing('butter', 1, 'cups')],
    }];
    expect(checkIngredientSanity(options, 1, 'chocolate brownie')).toBe(false);
  });

  test('PASS: 0.5 cup butter in a 2-serving cake passes (≤0.25 cup/serving)', () => {
    const options = [{
      name: 'Birthday Cake',
      ingredients: [
        ing('butter', 0.5, 'cups'),
        ing('all-purpose flour', 1, 'cups'),
        ing('sugar', 0.25, 'cups'),
        ing('eggs', 2, 'whole'),
      ],
    }];
    expect(checkIngredientSanity(options, 2, 'birthday cake')).toBe(true);
  });

  test('FAIL: excess flour in a 1-serving muffin (>1.5 cups)', () => {
    const options = [{
      name: 'Muffin',
      ingredients: [ing('all-purpose flour', 3, 'cups')],
    }];
    expect(checkIngredientSanity(options, 1, 'blueberry muffin')).toBe(false);
  });

  test('PASS: 1.5 cups flour for a 1-serving pancake batch passes exactly at the limit', () => {
    const options = [{
      name: 'Pancakes',
      ingredients: [
        ing('all-purpose flour', 1.5, 'cups'),
        ing('butter', 0.25, 'cups'),
        ing('sugar', 0.25, 'cups'),
        ing('eggs', 2, 'whole'),
      ],
    }];
    expect(checkIngredientSanity(options, 1, 'buttermilk pancakes')).toBe(true);
  });

  // ── Standard (non-baked) class thresholds ─────────────────────────────────

  test('PASS: 1 cup olive oil in a standard 2-serving pasta dish does not trigger', () => {
    // Standard class limit = max(1.0, 0.5 * 2) = 1.0 cup → 1 cup is at limit
    const options = [{
      name: 'Pasta',
      ingredients: [
        ing('olive oil', 1, 'cups'),
        ing('pasta', 200, 'g'),
        ing('garlic', 4, 'whole'),
      ],
    }];
    // For non-baked, fatLimit = max(1.0, 0.5 * 2) = 1.0 → 1.0 is NOT > 1.0
    expect(checkIngredientSanity(options, 2, 'pasta aglio e olio')).toBe(true);
  });

  test('FAIL: 2 cups olive oil in a standard 1-serving dish is caught', () => {
    // Standard limit: max(1.0, 0.5 * 1) = 1.0 cup; 2 cups > 1.0
    const options = [{
      name: 'Stir Fry',
      ingredients: [
        ing('vegetable oil', 2, 'cups'),
        ing('chicken breast', 150, 'g'),
        ing('broccoli', 1, 'cups'),
      ],
    }];
    expect(checkIngredientSanity(options, 1, 'chicken stir fry')).toBe(false);
  });

  // ── Egg limits ────────────────────────────────────────────────────────────

  test('FAIL: 10 eggs for 1 serving is caught', () => {
    const options = [{
      name: 'Scrambled Eggs',
      ingredients: [ing('eggs', 10, 'whole')],
    }];
    expect(checkIngredientSanity(options, 1, 'scrambled eggs')).toBe(false);
  });

  test('PASS: 4 eggs for 1 serving passes (within the max(6, 4*1)=6 limit)', () => {
    const options = [{
      name: 'Omelette',
      ingredients: [
        ing('eggs', 4, 'whole'),
        ing('cheese', 30, 'g'),
      ],
    }];
    expect(checkIngredientSanity(options, 1, 'cheese omelette')).toBe(true);
  });

  test('PASS: 12 eggs for 3 servings passes (within max(6, 4*3)=12 limit)', () => {
    const options = [{
      name: 'Frittata',
      ingredients: [ing('eggs', 12, 'whole')],
    }];
    expect(checkIngredientSanity(options, 3, 'vegetable frittata')).toBe(true);
  });

  // ── Sugar limits ─────────────────────────────────────────────────────────

  test('FAIL: 1 cup sugar for a 1-serving dessert is caught', () => {
    // limit = max(0.5, 0.25 * 1) = 0.5 cup; 1 cup > 0.5
    const options = [{
      name: 'Sweet Cake',
      ingredients: [ing('sugar', 1, 'cups')],
    }];
    expect(checkIngredientSanity(options, 1, 'vanilla cake')).toBe(false);
  });

  test('PASS: 0.5 cup sugar for 2 servings passes exactly at limit', () => {
    // limit = max(0.5, 0.25 * 2) = 0.5; 0.5 is NOT > 0.5
    const options = [{
      name: 'Cookies',
      ingredients: [
        ing('brown sugar', 0.5, 'cups'),
        ing('butter', 0.25, 'cups'),
        ing('all-purpose flour', 1, 'cups'),
      ],
    }];
    expect(checkIngredientSanity(options, 2, 'chocolate chip cookies')).toBe(true);
  });

  // ── Heavy liquids ─────────────────────────────────────────────────────────

  test('FAIL: 2 cups heavy cream for 1-serving dish is caught', () => {
    const options = [{
      name: 'Cream Soup',
      ingredients: [ing('heavy cream', 2, 'cups')],
    }];
    expect(checkIngredientSanity(options, 1, 'cream soup')).toBe(false);
  });

  test('PASS: 1 cup heavy cream for 2-serving soup passes', () => {
    const options = [{
      name: 'Bisque',
      ingredients: [
        ing('heavy cream', 1, 'cups'),  // limit = max(1.0, 0.5 * 2) = 1.0; NOT > 1.0
        ing('tomato', 2, 'cups'),
        ing('chicken breast', 200, 'g'),
      ],
    }];
    expect(checkIngredientSanity(options, 2, 'tomato bisque')).toBe(true);
  });

  // ── Non-cup units are not flagged ─────────────────────────────────────────

  test('PASS: large gram or oz quantities in tbsp/tsp units do not trip cup checks', () => {
    const options = [{
      name: 'Steak',
      ingredients: [
        ing('olive oil', 2, 'tbsp'),   // Not cups → not checked
        ing('beef', 300, 'g'),
        ing('butter', 1, 'tbsp'),      // Not cups → not checked
      ],
    }];
    expect(checkIngredientSanity(options, 1, 'grilled steak')).toBe(true);
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  test('PASS: empty ingredient list returns true (nothing to fail)', () => {
    expect(checkIngredientSanity([{ name: 'Empty', ingredients: [] }], 1, 'cake')).toBe(true);
  });

  test('PASS: ingredient with zero quantity is skipped', () => {
    const options = [{
      name: 'Test',
      ingredients: [ing('coconut oil', 0, 'cups')],
    }];
    expect(checkIngredientSanity(options, 1, 'chocolate cake')).toBe(true);
  });

  test('PASS: multiple options — all valid options pass even when checked together', () => {
    const options = [
      {
        name: 'Option A',
        ingredients: [
          ing('chicken breast', 150, 'g'),
          ing('olive oil', 1, 'tbsp'),
        ],
      },
      {
        name: 'Option B',
        ingredients: [
          ing('salmon', 150, 'g'),
          ing('olive oil', 1, 'tbsp'),
        ],
      },
    ];
    expect(checkIngredientSanity(options, 1, 'grilled protein')).toBe(true);
  });

  test('FAIL: first option valid, second option has insane fat → fails overall', () => {
    const options = [
      {
        name: 'Option A',
        ingredients: [ing('chicken breast', 150, 'g')],
      },
      {
        name: 'Option B',
        ingredients: [ing('butter', 3, 'cups')], // standard limit = 1 cup
      },
    ];
    expect(checkIngredientSanity(options, 1, 'standard dinner')).toBe(false);
  });

  // ── Confection class (isBakedOrConfection) ────────────────────────────────

  test('FAIL: 1 cup butter for a single-serving truffle is caught (confection class)', () => {
    const options = [{
      name: 'Chocolate Truffle',
      ingredients: [ing('butter', 1, 'cups')],
    }];
    // confection limit = max(0.5, 0.25 * 1) = 0.5; 1 > 0.5
    expect(checkIngredientSanity(options, 1, 'chocolate truffle')).toBe(false);
  });

  test('PASS: 0.5 cup butter for 2-serving fudge is at baked-class limit (not exceeded)', () => {
    const options = [{
      name: 'Chocolate Fudge',
      ingredients: [
        ing('butter', 0.5, 'cups'),    // limit = max(0.5, 0.25 * 2) = 0.5; NOT > 0.5
        ing('sugar', 0.5, 'cups'),     // limit = max(0.5, 0.25 * 2) = 0.5; NOT > 0.5
      ],
    }];
    expect(checkIngredientSanity(options, 2, 'chocolate fudge')).toBe(true);
  });

});
