/**
 * Heart Failure (Cardiac Diet) Prompt Builder
 *
 * Clinical guardrails for heart failure nutrition.
 * Enforces cardiac diet essentials: very low sodium, heart-healthy fats,
 * no processed meats, fluid-conscious portions.
 *
 * Sources: American Heart Association (AHA), Heart Failure Society of America,
 * American College of Cardiology dietary guidelines.
 */

const HEART_FAILURE_BLOCKED_INGREDIENTS = [
  'bacon', 'sausage', 'hot dogs', 'deli meat', 'ham', 'salami', 'pepperoni',
  'prosciutto', 'pastrami', 'corned beef', 'bologna',
  'canned soup', 'canned broth', 'chicken broth (canned)', 'beef broth (canned)',
  'pickles', 'olives', 'sauerkraut', 'miso', 'soy sauce', 'teriyaki sauce',
  'fish sauce', 'Worcestershire sauce',
  'salted butter', 'margarine',
  'chips', 'pretzels', 'crackers', 'salted popcorn',
  'frozen meals', 'fast food', 'instant noodles', 'ramen',
  'alcohol', 'beer', 'wine', 'liquor',
  'full-fat cheese', 'cream cheese', 'heavy cream',
  'coconut oil', 'lard', 'shortening', 'palm oil',
];

const HEART_FAILURE_PREFERRED_INGREDIENTS = [
  'salmon', 'sardines', 'mackerel', 'tuna (low sodium)', 'cod', 'tilapia',
  'chicken breast (unseasoned)', 'turkey breast', 'egg whites',
  'leafy greens', 'spinach', 'kale', 'arugula', 'collard greens',
  'broccoli', 'cauliflower', 'asparagus', 'green beans', 'zucchini', 'cucumber',
  'blueberries', 'strawberries', 'raspberries', 'apples', 'pears', 'oranges',
  'oats', 'quinoa', 'brown rice', 'whole wheat pasta',
  'olive oil', 'avocado', 'walnuts', 'flaxseed',
  'garlic', 'turmeric', 'ginger', 'fresh herbs', 'lemon juice', 'vinegar',
  'unsalted nuts (small amounts)', 'beans', 'lentils',
];

export function buildHeartFailurePrompt(basePrompt: string): string {
  return `CARDIAC DIET PROTOCOL — MANDATORY CLINICAL GUARDRAILS:
This meal must follow a strict heart failure cardiac diet. These rules are NON-NEGOTIABLE and override all other preferences:

VERY LOW SODIUM (sodium causes fluid retention — dangerous in heart failure):
- HARD LIMIT: 1,500mg sodium per meal (strict; AHA guideline for HF patients)
- BANNED: all canned soups/broths, processed meats, deli meats, pickles, olives, soy sauce, miso, fish sauce, teriyaki sauce, Worcestershire sauce, chips, pretzels, salted crackers, frozen meals, fast food
- Season ONLY with: fresh herbs, garlic, lemon juice, vinegar, or alcohol-free hot sauce (low sodium)
- No added table salt whatsoever

HEART-HEALTHY FATS — saturated fat worsens heart disease:
- BANNED: bacon, sausage, heavy cream, full-fat cheese, coconut oil, lard, palm oil, shortening, butter (except a very small amount of unsalted butter if critical to the dish)
- USE: olive oil, avocado, walnuts, flaxseed, salmon, sardines

HEART-HEALTHY PROTEIN:
- PREFERRED: fatty fish (omega-3 rich — salmon, mackerel, sardines), chicken breast, turkey, egg whites, legumes
- LIMIT: red meat. If included, keep to 3 oz maximum of lean cuts (sirloin, tenderloin) — no more than once per meal
- BANNED: processed meats of any kind (bacon, sausage, deli meats, hot dogs)

NO ALCOHOL — alcohol weakens heart muscle (cardiomyopathy risk):
- Absolutely no beer, wine, or spirits

PREFERRED INGREDIENTS:
${HEART_FAILURE_PREFERRED_INGREDIENTS.slice(0, 20).join(', ')}

${basePrompt}

CRITICAL RESTRICTIONS:
- None of these ingredients may appear: ${HEART_FAILURE_BLOCKED_INGREDIENTS.slice(0, 20).join(', ')}
- Every meal must be low sodium — season with herbs and lemon only
- No processed meats under any circumstances
- No alcohol of any kind`;
}

export function buildHeartFailureSnackPrompt(basePrompt: string): string {
  return `CARDIAC DIET SNACK PROTOCOL — MANDATORY CLINICAL GUARDRAILS:
${basePrompt}

HEART FAILURE SNACK RULES (non-negotiable):
- Strictly low sodium: no chips, pretzels, salted crackers, pickles, olives, processed snacks
- No processed meats: no jerky, deli-style meats, pepperoni, salami
- No saturated fat: no full-fat cheese, heavy cream dips, coconut-based items
- No alcohol of any kind
- Safe snack choices: fresh fruit (berries, apple slices), unsalted raw vegetables with hummus (low sodium), a small handful of unsalted walnuts, plain rice cakes (unsalted), plain oatmeal
- Protein: hard-boiled egg white, a small (1–2 oz) piece of unseasoned grilled chicken or salmon
- Healthy fat: a small drizzle of olive oil or a quarter avocado
- Season with fresh herbs and lemon — never salt`;
}

export function getHeartFailureSystemPrompt(): string {
  return `You are a clinical nutrition specialist supporting patients with heart failure (HF).
Your role is to generate meals that strictly follow cardiac diet guidelines — protecting heart function through very low sodium intake, heart-healthy fats, and clean lean proteins.

KEY CLINICAL PRINCIPLES (non-negotiable):
1. VERY LOW SODIUM — absolute maximum 1,500mg per meal. No soy sauce, miso, canned goods, pickles, olives, or processed meats. Season with fresh herbs, garlic, lemon, vinegar only.
2. HEART-HEALTHY FATS — olive oil, avocado, walnuts, salmon, flaxseed. Never coconut oil, lard, or heavy cream.
3. ZERO PROCESSED MEATS — no bacon, sausage, deli meats, hot dogs, salami, pepperoni of any kind.
4. NO ALCOHOL — alcohol directly weakens cardiac muscle.
5. OMEGA-3 PRIORITY — fatty fish (salmon, mackerel, sardines) are the gold standard protein. Chicken breast and legumes as alternatives.
6. LEAN RED MEAT LIMIT — if requested, 3 oz maximum lean cut; otherwise default to fish or poultry.

PREFERRED PROTEINS: salmon, sardines, mackerel, chicken breast, turkey, egg whites, lentils, black beans
PREFERRED FATS: olive oil, avocado, walnuts, flaxseed
PREFERRED CARBOHYDRATES: oats, brown rice, quinoa, whole wheat pasta, sweet potato (moderate)
PREFERRED FLAVOR: garlic, turmeric, ginger, rosemary, thyme, lemon juice, vinegar

Every meal you create must be:
- Very low in sodium (under 1,500mg total)
- Rich in omega-3 fatty acids and heart-protective nutrients
- Free of processed meats and saturated fats
- Supportive of cardiac function without causing fluid retention`;
}

export const heartFailureBlockedIngredients = HEART_FAILURE_BLOCKED_INGREDIENTS;
export const heartFailurePreferredIngredients = HEART_FAILURE_PREFERRED_INGREDIENTS;
