/**
 * INGREDIENT NORMALIZER — SINGLE SOURCE OF TRUTH
 *
 * Maps ingredient name variants to canonical names so duplicates
 * collapse into a single item during Smart Grocery List aggregation.
 *
 * Apply BEFORE canMerge in shoppingListStore.ts.
 * Do NOT use for macro math or meal builder logic.
 */

// Grains where "cooked X" → "X" (same dry-grain purchase item)
const COOKED_GRAIN_NAMES = [
  'quinoa', 'rice', 'farro', 'barley', 'bulgur', 'couscous',
  'oat', 'oats', 'lentil', 'lentils',
];

export function normalizeIngredient(name: string): string {
  const n = name.toLowerCase().trim();

  // ── Poultry variants ────────────────────────────────────────────────────────
  if (n.includes("boneless") && n.includes("chicken breast")) return "skinless chicken breast";
  if (n.includes("chicken breast")) return "skinless chicken breast";
  if (n.includes("skinless chicken breast")) return "skinless chicken breast";
  if (n.includes("chicken thigh")) return "chicken thigh";
  if (n.includes("chicken leg")) return "chicken leg";
  if (n.includes("chicken wing")) return "chicken wing";
  if (n.includes("ground turkey")) return "ground turkey";
  if (n.includes("turkey breast")) return "turkey breast";

  // ── Tofu variants → "tofu" ─────────────────────────────────────────────────
  // Merges "extra-firm tofu", "firm tofu", "silken tofu", "soft tofu", etc.
  if (n.includes("tofu")) return "tofu";

  // ── Soy sauce variants ─────────────────────────────────────────────────────
  if (n.includes("soy sauce") || n.includes("low sodium soy sauce")) return "soy sauce";

  // ── Citrus juice / zest → whole fruit ─────────────────────────────────────
  // "lemon juice", "lemon zest" → "lemon" so the retail layer counts whole fruit
  if ((n.includes("juice") || n.includes("zest")) && n.includes("lemon")) return "lemon";
  if ((n.includes("juice") || n.includes("zest")) && n.includes("lime")) return "lime";
  if ((n.includes("juice") || n.includes("zest")) && n.includes("orange")) return "orange";
  if ((n.includes("juice") || n.includes("zest")) && n.includes("grapefruit")) return "grapefruit";

  // ── Cooked grains → raw canonical name ────────────────────────────────────
  // "cooked quinoa" / "quinoa, cooked" → "quinoa" so they merge and retail
  // layer uses the raw-grain density for the cup→lb conversion
  for (const grain of COOKED_GRAIN_NAMES) {
    // "cooked quinoa" pattern
    if (n === `cooked ${grain}` || n.startsWith(`cooked ${grain} `)) return grain;
    // "quinoa, cooked" pattern — comma already stripped by classifier, but handle here too
    if (n === `${grain}, cooked` || n === `${grain} cooked`) return grain;
  }

  // ── "garlic, minced" / "ginger, minced" style comma-descriptors ─────────
  // The classifier strips after comma, but the normalizer runs first.
  const commaIdx = n.indexOf(',');
  if (commaIdx !== -1) {
    return name.substring(0, commaIdx).trim();
  }

  return name;
}
