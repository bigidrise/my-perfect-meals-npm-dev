/**
 * Hard server-side starch stacking validator for vegetarian/vegan meals.
 *
 * This enforces the STARCH HIERARCHY DECISION TREE as CODE — not AI prompts.
 * Prompts can be ignored. This cannot.
 *
 * Rules:
 *   1. If the meal contains legumes → NO grains allowed (legumes = protein + primary carb)
 *   2. No meal may have more than 1 starch source total (legume OR grain OR starchy veg)
 *
 * Applied in:
 *   - Variety engine (filterByStarchStructure) — drops invalid selection cards
 *   - Stable generator (validateStarchStructure) — triggers regeneration with a fix hint
 */

// ─── Ingredient classification maps ─────────────────────────────────────────

export const STARCH_LEGUMES: string[] = [
  "black bean", "black beans",
  "black-eyed pea", "black-eyed peas", "black eyed pea", "black eyed peas",
  "blackeyed pea", "blackeyed peas",
  "lentil", "lentils", "red lentil", "green lentil", "brown lentil",
  "chickpea", "chickpeas", "garbanzo", "garbanzo bean",
  "edamame",
  "kidney bean", "kidney beans",
  "white bean", "white beans",
  "navy bean", "navy beans",
  "pinto bean", "pinto beans",
  "cannellini", "cannellini bean",
  "fava bean", "fava beans",
  "great northern bean", "great northern beans",
  "adzuki bean", "adzuki beans",
  "mung bean", "mung beans",
];

export const STARCH_GRAINS: string[] = [
  "grits", "corn grits", "stone-ground grits", "quick grits", "instant grits",
  "polenta", "cornmeal", "corn meal",
  // cornbread is listed BEFORE "bread" so it gets an explicit match (not just via "bread" substring)
  "cornbread", "corn bread",
  // flour = refined grain — catches baked goods even when not named explicitly
  "flour", "corn flour", "all-purpose flour", "wheat flour", "white flour",
  "rice", "brown rice", "white rice", "jasmine rice", "basmati rice",
  "wild rice", "long grain rice", "short grain rice", "arborio",
  "quinoa",
  "farro",
  "barley", "pearl barley",
  "millet",
  "bulgur", "bulgur wheat",
  "couscous",
  "oat", "oats", "oatmeal", "rolled oats", "steel cut oats",
  "bread", "whole grain bread", "sourdough", "whole wheat bread",
  "toast", "whole wheat toast",
  "tortilla", "corn tortilla", "flour tortilla",
  "pita", "pita bread",
  "naan",
  "wrap",
  "pasta", "whole wheat pasta", "noodle", "noodles",
  // biscuit covers another common soul-food side
  "biscuit", "biscuits",
  // cracker / crouton
  "cracker", "crackers", "crouton", "croutons",
];

export const STARCH_STARCHY_VEGETABLES: string[] = [
  "sweet potato", "sweet potatoes",
  "yam", "yams",
  "potato", "potatoes", "russet potato", "yukon gold", "fingerling potato",
  "butternut squash",
  "acorn squash",
  "plantain", "plantains",
  "parsnip", "parsnips",
  "cassava", "yuca",
  "taro",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractMealText(meal: unknown): string {
  if (!meal || typeof meal !== "object") return "";
  const m = meal as Record<string, unknown>;

  const parts: string[] = [];

  // Scan name — catches "Black-Eyed Peas Stew with Cornbread"
  if (typeof m.name === "string") parts.push(m.name);

  // Scan description — catches "served with cornbread" side-dish loophole
  if (typeof m.description === "string") parts.push(m.description);

  // Scan sideDish field if AI emits it separately
  if (typeof m.sideDish === "string") parts.push(m.sideDish);
  if (typeof m.side === "string") parts.push(m.side);
  if (typeof m.sides === "string") parts.push(m.sides);

  // Scan ingredients array — handles { name } and { item } shapes
  if (Array.isArray(m.ingredients)) {
    for (const ing of m.ingredients) {
      if (typeof ing === "string") {
        parts.push(ing);
      } else if (ing && typeof ing === "object") {
        const i = ing as Record<string, unknown>;
        if (typeof i.name === "string") parts.push(i.name);
        else if (typeof i.item === "string") parts.push(i.item);
        // Also scan any description/note on the ingredient itself
        if (typeof i.note === "string") parts.push(i.note);
      }
    }
  }

  return parts.join(" ").toLowerCase();
}

function matchesAny(text: string, terms: string[]): string | null {
  for (const term of terms) {
    if (text.includes(term.toLowerCase())) return term;
  }
  return null;
}

// ─── Core validator ──────────────────────────────────────────────────────────

export interface StarchValidationResult {
  valid: boolean;
  reason?: string;
  detected: {
    legume: string | null;
    grain: string | null;
    starchyVeg: string | null;
    starchCount: number;
  };
}

/**
 * Hard-validate a meal's starch structure.
 * Logs what it found so debugging is instant.
 *
 * @param meal - The generated meal object
 * @param mealLabel - Optional label for console logging
 */
export function validateStarchStructure(
  meal: unknown,
  mealLabel?: string,
): StarchValidationResult {
  const text = extractMealText(meal);
  const label = mealLabel || ((meal as any)?.name ?? "unnamed");

  const legume = matchesAny(text, STARCH_LEGUMES);
  const grain = matchesAny(text, STARCH_GRAINS);
  const starchyVeg = matchesAny(text, STARCH_STARCHY_VEGETABLES);

  const starchCount = (legume ? 1 : 0) + (grain ? 1 : 0) + (starchyVeg ? 1 : 0);

  console.log(
    `[STARCH GUARD] "${label}" — legume: ${legume ?? "none"} | grain: ${grain ?? "none"} | starchyVeg: ${starchyVeg ?? "none"} | starchCount: ${starchCount}`,
  );

  const detected = { legume, grain, starchyVeg, starchCount };

  if (legume && grain) {
    const reason = `Starch stacking: "${legume}" (legume) + "${grain}" (grain). Legumes serve as both protein and primary carb — no grain is allowed alongside them.`;
    console.warn(`[STARCH GUARD] BLOCKED "${label}" — ${reason}`);
    return { valid: false, reason, detected };
  }

  if (starchCount > 1) {
    const found = [legume, grain, starchyVeg].filter(Boolean).join(" + ");
    const reason = `Starch stacking: ${starchCount} starch sources detected (${found}). Maximum 1 per vegetarian meal.`;
    console.warn(`[STARCH GUARD] BLOCKED "${label}" — ${reason}`);
    return { valid: false, reason, detected };
  }

  return { valid: true, detected };
}

/**
 * Filter an array of meals by starch structure — drops invalid options.
 * Only applies when the diet is vegetarian or vegan.
 *
 * @param meals - Array of generated meal options
 * @param dietRestrictions - User's diet restriction tags
 */
export function filterByStarchStructure<T>(
  meals: T[],
  dietRestrictions: string[],
): T[] {
  const isVegOrVegan = dietRestrictions.some(
    (r) => r === "vegetarian" || r === "vegan",
  );
  if (!isVegOrVegan) return meals;

  const before = meals.length;
  const filtered = meals.filter((meal) => {
    const result = validateStarchStructure(meal);
    return result.valid;
  });

  if (filtered.length < before) {
    console.warn(
      `[STARCH GUARD] Filtered ${before - filtered.length} starch-stacked option(s) from variety cards`,
    );
  }

  return filtered;
}

/**
 * Build a regeneration hint explaining what went wrong and how to fix it.
 * Used in the stable generator's retry loop.
 */
export function buildStarchFixHint(result: StarchValidationResult, originalRequest: string): string {
  const { legume, grain, starchyVeg } = result.detected;

  if (legume && grain) {
    return (
      `STARCH STACKING VIOLATION: This meal contains "${legume}" (a legume) AND "${grain}" (a grain). ` +
      `Legumes count as BOTH the protein anchor AND the primary carb. No grain is allowed alongside them. ` +
      `FIX: Keep the "${legume}" as the protein + carb anchor. REMOVE the "${grain}" entirely. ` +
      `Fill the remaining slots with non-starchy vegetables (spinach, kale, mushrooms, peppers, broccoli). ` +
      `The user's original request was: "${originalRequest}".`
    );
  }

  const found = [legume, grain, starchyVeg].filter(Boolean);
  return (
    `STARCH STACKING VIOLATION: This meal contains ${found.length} starch sources: ${found.join(", ")}. ` +
    `Maximum 1 per vegetarian meal. ` +
    `FIX: Keep only ONE starch. Remove the others and replace with non-starchy vegetables. ` +
    `The user's original request was: "${originalRequest}".`
  );
}
