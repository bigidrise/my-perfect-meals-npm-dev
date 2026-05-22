/**
 * Kidney Disease (Renal Diet) Prompt Builder
 *
 * Clinical guardrails for chronic kidney disease (CKD) nutrition.
 * Enforces renal diet essentials: low potassium, low phosphorus, low sodium,
 * and moderate protein — without inventing treatment claims.
 *
 * Sources: National Kidney Foundation, Academy of Nutrition and Dietetics (RD.net),
 * American Journal of Kidney Diseases dietary guidelines.
 */

const KIDNEY_BLOCKED_INGREDIENTS = [
  'banana', 'bananas', 'orange', 'oranges', 'avocado', 'avocados',
  'potato', 'potatoes', 'sweet potato', 'sweet potatoes',
  'tomato juice', 'tomato sauce', 'canned tomatoes',
  'dried apricots', 'raisins', 'prunes', 'dried fruit',
  'beans', 'lentils', 'kidney beans', 'black beans', 'chickpeas',
  'nuts', 'almonds', 'peanuts', 'cashews', 'pistachios', 'walnuts',
  'seeds', 'sunflower seeds', 'pumpkin seeds',
  'milk', 'cheese', 'yogurt', 'ice cream', 'dairy',
  'whole grain bread', 'bran', 'bran cereal', 'oat bran',
  'dark cola', 'cola', 'beer', 'chocolate', 'cocoa',
  'processed meats', 'bacon', 'sausage', 'hot dogs', 'deli meat', 'ham',
  'canned soup', 'canned food', 'pickles', 'olives',
  'salt substitute', 'potassium chloride',
];

const KIDNEY_PREFERRED_INGREDIENTS = [
  'cauliflower', 'cabbage', 'green beans', 'asparagus', 'kale (small portions)',
  'bell peppers', 'cucumber', 'lettuce', 'arugula', 'onions', 'garlic',
  'apples', 'blueberries', 'strawberries', 'grapes', 'peaches', 'pineapple',
  'white rice', 'white bread', 'pasta', 'cream of wheat', 'rice cakes',
  'egg whites', 'chicken breast', 'turkey breast', 'white fish', 'tilapia', 'cod', 'bass',
  'olive oil', 'fresh herbs', 'lemon juice', 'vinegar',
];

export function buildKidneyDiseasePrompt(basePrompt: string): string {
  return `RENAL DIET PROTOCOL — MANDATORY CLINICAL GUARDRAILS:
This meal must follow a strict kidney disease (CKD) renal diet. These rules are NON-NEGOTIABLE and override all other preferences:

LOW POTASSIUM (hard limit — high potassium is dangerous for kidneys):
- BANNED: bananas, oranges, avocados, potatoes (all types), beans, lentils, dried fruits, nuts, seeds, dairy products, chocolate, tomato sauce/juice
- USE: apples, berries, grapes, peaches, cauliflower, cabbage, green beans, bell peppers, cucumber, white rice, white pasta, egg whites

LOW PHOSPHORUS (phosphorus builds up in CKD and damages bones/heart):
- BANNED: dairy (milk, cheese, yogurt), nuts, seeds, whole grain bread, bran cereals, dark colas, beer, chocolate, processed meats
- USE: white rice, white bread, regular pasta, cream of wheat, egg whites, fresh produce (low-phosphorus vegetables)

LOW SODIUM (critical for blood pressure and fluid retention):
- BANNED: canned soups, processed meats, deli meats, pickles, olives, fast food, salt substitutes (contain potassium chloride — dangerous in CKD)
- LIMIT: added salt. Season with fresh herbs, garlic, lemon, or vinegar instead
- Target: under 2,000mg sodium per meal

MODERATE PROTEIN — do NOT overload on protein (it burdens damaged kidneys):
- Choose: egg whites, chicken breast, turkey, white fish (tilapia, cod, bass)
- Avoid: very high-protein preparations, protein shakes, red meat as primary (small portions only)

PREFERRED INGREDIENTS:
${KIDNEY_PREFERRED_INGREDIENTS.join(', ')}

${basePrompt}

CRITICAL RESTRICTIONS:
- None of these ingredients may appear: ${KIDNEY_BLOCKED_INGREDIENTS.slice(0, 20).join(', ')}
- No salt substitutes or potassium-based seasonings
- No dairy of any kind
- Lean, fresh proteins only at moderate portions (3–4 oz)
- Season with fresh herbs and lemon — never salt or soy sauce`;
}

export function buildKidneyDiseaseSnackPrompt(basePrompt: string): string {
  return `RENAL DIET SNACK PROTOCOL — MANDATORY CLINICAL GUARDRAILS:
${basePrompt}

KIDNEY-SAFE SNACK RULES (non-negotiable):
- No high-potassium ingredients: no banana, avocado, nuts, dried fruit, potatoes, beans, lentils, dairy, chocolate
- No high-phosphorus ingredients: no nuts, seeds, dairy, bran, dark cola, beer
- No high-sodium items: no chips, crackers with salt, processed snacks, deli meats
- No salt substitutes (potassium chloride is dangerous in CKD)
- Low-potassium fruits: apples, berries (blueberries, strawberries), grapes, peaches, pineapple
- Safe carbs: white rice cakes, plain white crackers, cream of wheat, low-sodium white bread
- Protein: egg whites or a small portion (1–2 oz) of white fish or chicken
- Fat: a small drizzle of olive oil only
- Season with fresh herbs, lemon juice, or vinegar — never salt`;
}

export function getKidneyDiseaseSystemPrompt(): string {
  return `You are a clinical nutrition specialist supporting patients with chronic kidney disease (CKD).
Your role is to generate meals that strictly follow renal diet guidelines — protecting kidney function, managing potassium, phosphorus, and sodium loads.

KEY CLINICAL PRINCIPLES (non-negotiable):
1. LOW POTASSIUM — avoid bananas, avocados, oranges, potatoes, beans, lentils, nuts, dried fruits, dairy, chocolate
2. LOW PHOSPHORUS — avoid dairy, nuts, seeds, bran, whole grains, dark sodas, beer, chocolate, processed foods
3. LOW SODIUM — no added salt, no canned/processed foods, no soy sauce; use fresh herbs and lemon
4. MODERATE PROTEIN — 3–4 oz lean protein per meal (egg whites, chicken breast, white fish); do not over-protein
5. NO SALT SUBSTITUTES — potassium chloride products are medically dangerous for CKD patients

SAFE PROTEIN CHOICES: egg whites, chicken breast, turkey breast, tilapia, cod, bass
SAFE CARBOHYDRATES: white rice, white bread, regular pasta, cream of wheat
SAFE VEGETABLES: cauliflower, cabbage, green beans, bell peppers, cucumber, lettuce, asparagus
SAFE FRUITS: apples, blueberries, strawberries, grapes, peaches, pineapple

Every meal you create must be:
- Kidney-safe and within renal diet boundaries
- Low in potassium, phosphorus, and sodium
- Moderate in protein — not excessive
- Flavorful through fresh herbs, garlic, lemon, and vinegar`;
}

export const kidneyDiseaseBlockedIngredients = KIDNEY_BLOCKED_INGREDIENTS;
export const kidneyDiseasePreferredIngredients = KIDNEY_PREFERRED_INGREDIENTS;
