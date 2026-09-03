/**
 * Liver Disease (Hepatic Diet) Prompt Builder
 *
 * Clinical guardrails for advanced liver disease (cirrhosis, hepatitis, NAFLD).
 * MORE RESTRICTIVE than liver-support — enforces hepatic diet essentials:
 * no alcohol (absolute), no raw shellfish, low sodium, adequate (not excess) protein,
 * small frequent meal framing, and soft-food awareness.
 *
 * Sources: American Association for the Study of Liver Diseases (AASLD),
 * European Association for the Study of the Liver (EASL),
 * American Journal of Gastroenterology dietary guidelines.
 */

const LIVER_DISEASE_BLOCKED_INGREDIENTS = [
  'alcohol', 'beer', 'wine', 'liquor', 'spirits', 'sake', 'mead', 'hard cider',
  'raw oysters', 'raw clams', 'raw mussels', 'raw shellfish', 'raw scallops',
  'bacon', 'sausage', 'hot dogs', 'deli meat', 'ham', 'salami', 'pepperoni',
  'prosciutto', 'pastrami', 'corned beef',
  'canned soup', 'canned broth', 'instant noodles', 'ramen', 'frozen meals',
  'fast food', 'fried food', 'deep fried', 'french fries', 'onion rings',
  'chips', 'pretzels', 'pickles', 'olives', 'soy sauce', 'fish sauce',
  'high-fat dairy', 'heavy cream', 'full-fat cheese', 'ice cream',
  'refined sugar', 'candy', 'soda', 'energy drinks', 'pastries', 'donuts',
  'coconut oil', 'lard', 'palm oil', 'shortening',
];

const LIVER_DISEASE_PREFERRED_INGREDIENTS = [
  'egg whites', 'eggs (whole, cooked)', 'chicken breast', 'turkey breast',
  'salmon', 'cod', 'tilapia', 'white fish', 'tuna (low sodium)',
  'tofu', 'soft-cooked lentils', 'soft-cooked beans',
  'spinach', 'kale', 'arugula', 'broccoli', 'cauliflower', 'green beans',
  'zucchini', 'carrots (cooked)', 'sweet potato (moderate)', 'peas',
  'blueberries', 'strawberries', 'apples', 'pears', 'bananas (ripe, soft)',
  'oats', 'white rice', 'whole wheat pasta', 'quinoa',
  'olive oil', 'avocado', 'walnuts', 'flaxseed',
  'garlic', 'turmeric', 'ginger', 'fresh herbs', 'lemon juice', 'beets',
];

export function buildLiverDiseasePrompt(basePrompt: string): string {
  return `LIVER DISEASE DIETARY PROTOCOL — MANDATORY CLINICAL GUARDRAILS:
This meal must follow a strict hepatic (liver disease) diet. These rules are NON-NEGOTIABLE and override all other preferences. Liver disease patients face serious complications from violations of these rules.

ABSOLUTE BAN — NO EXCEPTIONS:
1. NO ALCOHOL OF ANY KIND — beer, wine, spirits, sake, hard cider. Even trace amounts accelerate liver failure.
2. NO RAW SHELLFISH — raw oysters, clams, mussels, or scallops can cause fatal Vibrio bacterial infection in liver disease patients. Cooked shellfish only.

LOW SODIUM (liver disease causes fluid buildup/ascites — sodium worsens it severely):
- HARD LIMIT: under 2,000mg sodium per meal
- BANNED: canned soups/broths, deli meats, processed meats, pickles, olives, soy sauce, fish sauce, fast food, chips, instant noodles
- Season with: fresh herbs, garlic, lemon juice, turmeric, ginger, vinegar

NO FRIED OR HIGH-FAT FOODS (liver cannot process excess fat):
- BANNED: deep-fried foods, french fries, fried chicken, heavy cream, coconut oil, lard, palm oil
- USE: olive oil (small amounts), avocado, walnuts, flaxseed

MODERATE PROTEIN (adequate but not excessive — supports liver repair without overload):
- PREFERRED: eggs, chicken breast, turkey, salmon, white fish, tofu, soft-cooked lentils/beans
- PORTION: 3–4 oz protein per meal — do not create high-protein overload
- AVOID: processed meats of all kinds

LIVER-SUPPORTIVE INGREDIENTS:
- Cruciferous vegetables: broccoli, cauliflower, Brussels sprouts
- Leafy greens: spinach, kale, arugula
- Antioxidant-rich: berries, beets, garlic, turmeric, ginger
- Healthy fats: olive oil, avocado, walnuts, flaxseed

PREFERRED INGREDIENTS:
${LIVER_DISEASE_PREFERRED_INGREDIENTS.slice(0, 20).join(', ')}

${basePrompt}

CRITICAL RESTRICTIONS:
- ZERO alcohol — this is a medical absolute. Do not include any alcohol-containing ingredient.
- NO raw shellfish of any kind.
- None of these ingredients may appear: ${LIVER_DISEASE_BLOCKED_INGREDIENTS.slice(0, 18).join(', ')}
- Low sodium — season with herbs and lemon only
- No fried foods; cooking methods must be baked, steamed, grilled, or poached`;
}

export function buildLiverDiseaseSnackPrompt(basePrompt: string): string {
  return `LIVER DISEASE SNACK PROTOCOL — MANDATORY CLINICAL GUARDRAILS:
${basePrompt}

HEPATIC DIET SNACK RULES (non-negotiable):
- ZERO alcohol — absolutely no alcohol of any kind
- NO raw shellfish — no raw oysters, clams, or mussels
- No fried foods or high-fat items
- Low sodium: no chips, pretzels, salted crackers, pickles, olives, processed snacks, canned items
- No processed meats: no jerky, deli meats, pepperoni, sausage
- No refined sugar or sweets: no candy, pastries, soda, energy drinks
- Safe snacks: fresh fruit (blueberries, strawberries, apple slices), plain rice cakes, soft-cooked vegetables, hummus (low sodium), plain oatmeal
- Protein: hard-boiled eggs, a small (1–2 oz) piece of baked chicken or fish, soft tofu
- Healthy fat: a small drizzle of olive oil or a few walnuts
- Season with fresh herbs and lemon — never salt or soy sauce`;
}

export function getLiverDiseaseSystemPrompt(): string {
  return `You are a clinical nutrition specialist supporting patients with serious liver disease (cirrhosis, advanced hepatitis, NAFLD/NASH).
Your role is to generate meals that strictly follow hepatic diet guidelines — protecting liver function, preventing complications like ascites (fluid buildup) and encephalopathy, and supporting liver regeneration.

KEY CLINICAL PRINCIPLES (non-negotiable, medically critical):
1. ZERO ALCOHOL — absolutely no alcohol of any kind. Even small amounts are dangerous with liver disease and can trigger acute-on-chronic liver failure.
2. NO RAW SHELLFISH — Vibrio vulnificus infection from raw oysters or clams is frequently fatal in liver disease patients. Cooked shellfish only.
3. LOW SODIUM — maximum 2,000mg per meal. Sodium causes dangerous ascites (abdominal fluid accumulation). Use fresh herbs, garlic, lemon, vinegar for flavor.
4. NO FRIED OR HIGH-FAT FOODS — the liver cannot process excessive fat, accelerating damage. No deep frying. Cook by baking, grilling, steaming, or poaching.
5. MODERATE PROTEIN — 3–4 oz lean protein per meal. Enough to support repair; too much burdens the liver with ammonia production.
6. LIVER-PROTECTIVE FOODS — cruciferous vegetables (broccoli, cauliflower), leafy greens (spinach, kale), antioxidants (berries, beets, turmeric, garlic), omega-3s (salmon, walnuts, flaxseed).

SAFE PROTEINS: eggs, chicken breast, turkey, salmon, white fish, tofu, soft lentils/beans
SAFE FATS: olive oil (small amounts), avocado, walnuts, flaxseed
SAFE CARBOHYDRATES: oats, white rice, whole wheat pasta, quinoa, sweet potato (moderate)
SAFE FLAVOR: garlic, turmeric, ginger, rosemary, thyme, lemon juice, beets, fresh herbs

Every meal you create must be:
- Completely free of alcohol — this is absolute
- Free of raw shellfish
- Low in sodium (under 2,000mg)
- Free of fried foods and excess fat
- Supportive of liver healing and function`;
}

export const liverDiseaseBlockedIngredients = LIVER_DISEASE_BLOCKED_INGREDIENTS;
export const liverDiseasePreferredIngredients = LIVER_DISEASE_PREFERRED_INGREDIENTS;
