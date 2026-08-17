/**
 * Dish Engine Router
 *
 * Determines which generation engine to use for a given craving input.
 * This module has NO dependencies on DB, OpenAI, or storage — it is a
 * pure classifier used by generateCravingMealOptions() to auto-route
 * between buildVarietyPrompt() (nutrition-first) and
 * buildRecipeVarietyPrompt() (culinary-ratio-first).
 *
 * Background: certain dishes have load-bearing culinary ratios
 * (leavening, gluten development, emulsification, sugar stages) where
 * the nutrition-first prompt produces structurally wrong recipes.
 * This replaces the user-facing "Meal Mode / Recipe Mode" toggle — the
 * customer types a dish and MPM routes to the right engine silently.
 */

// Note: patterns use `s?` or `es?` on pluralizable nouns so "pancakes",
// "cookies", "brownies" etc. match as well as the singular forms.
// Word boundaries (\b) still anchor the match to full words.
const RECIPE_SENSITIVE_PATTERNS: RegExp[] = [
  // Baked goods — leavening ratios are load-bearing
  /\b(breads?|loafs?|loaves|sourdough|brioche|baguettes?|focaccia|bagels?|pretzels?|challah|pita|naan|flatbreads?)\b/i,
  /\b(cakes?|cupcakes?|layer cake|pound cake|coffee cake|bundt|cheesecake|tortes?)\b/i,
  /\b(cookies?|brownies?|biscuits?|scones?|shortbread|snickerdoodles?|macarons?|macaroons?)\b/i,
  /\b(muffins?|quick bread|banana bread|zucchini bread|corn bread|cornbread)\b/i,
  /\b(croissants?|danish|puff pastry|choux|eclairs?|cream puffs?|profiteroles?|palmiers?)\b/i,
  /\b(pancakes?|waffles?|crepes?|dutch baby|crumpets?|pikelets?)\b/i,
  /\b(pies?|tarts?|galettes?|quiches?|cobblers?|crumbles?|crisps?|crostatas?)\b/i,
  /\b(doughnuts?|donuts?|fritters?|churros?|beignets?|zeppole)\b/i,
  // Fresh dough / pasta — hydration and gluten ratios matter
  /\b(pastas?|fresh pasta|homemade pasta|gnocchi|dumplings?|wontons?|pierogis?|empanadas?|gyoza)\b/i,
  /\b(pizza dough|calzones?|strombolis?)\b/i,
  // Ratio-critical techniques — emulsification, suspension, caramelization
  /\b(souffles?|custards?|creme brulee|panna cotta|flan|puddings?|mousses?)\b/i,
  /\b(hollandaise|bearnaise|bechamel|veloute|espagnole|roux)\b/i,
  /\b(risotto|paella)\b/i,
  // Confections — sugar-stage chemistry
  /\b(fudge|caramels?|toffee|brittle|nougat|marzipan|pralines?|ganache|truffles?)\b/i,
];

/**
 * Returns true if the dish input is culinary-ratio-sensitive, meaning the
 * recipe engine (buildRecipeVarietyPrompt + checkIngredientSanity) should
 * be used instead of the nutrition-first meal engine.
 *
 * Used by generateCravingMealOptions() in auto mode (the default).
 * Can also be imported directly for testing or future feature work.
 */
export function isRecipeSensitiveDish(input: string): boolean {
  if (!input || !input.trim()) return false;
  return RECIPE_SENSITIVE_PATTERNS.some(pattern => pattern.test(input));
}
