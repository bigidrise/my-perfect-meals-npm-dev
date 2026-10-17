import type { DietValidationIssue, ValidationResult } from "./guardrails/types";

/** Diagnostic/test infrastructure only; normal functional repairs are not runtime-gated. */
export function developmentSnackRepairEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NODE_ENV === "development" && !env.REPLIT_DEPLOYMENT;
}

const normalizeIngredient = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function matchesIngredientPhrase(name: string, phrase: string): boolean {
  const normalized = ` ${normalizeIngredient(name)} `;
  const term = normalizeIngredient(phrase);
  return normalized.includes(` ${term} `);
}

type Ingredient = { name: string; quantity?: string; unit?: string };

/**
 * Correct identification is not clinical clearance. Qualified dairy, butter and
 * crackers need actual protocol-compatible evidence, or a compatible substitute.
 * Do not invent sodium/saturated-fat ceilings from a condition's name.
 */
export function validateCardiacSnackIngredients(
  ingredients: Ingredient[],
  blocked: string[],
): ValidationResult {
  const issues: DietValidationIssue[] = [];
  for (const ingredient of ingredients) {
    const name = normalizeIngredient(ingredient.name);
    const qualifiedDairy = matchesIngredientPhrase(name, "cream cheese") &&
      /\b(low fat|reduced fat|fat free|nonfat)\b/.test(name);
    const unsaltedButter = matchesIngredientPhrase(name, "unsalted butter");
    const qualifiedCracker = /\bcrackers?\b/.test(name) &&
      /\b(unsalted|no added salt|low sodium|salt free)\b/.test(name);
    if (qualifiedDairy || unsaltedButter || qualifiedCracker) {
      issues.push({
        source: "heart-failure",
        ruleId: "cardiac:qualified_ingredient_evidence_required",
        ingredient: ingredient.name,
        message: `Cardiac compatibility needs verified quantity, preparation and sodium/saturated-fat evidence for "${ingredient.name}" (${ingredient.quantity ?? "unknown quantity"} ${ingredient.unit ?? ""}). Its qualifier is not a blanket approval; use a compatible substitute if that evidence is unavailable.`,
      });
      continue;
    }
    const match = blocked.find(term => matchesIngredientPhrase(name, term) ||
      (term === "crackers" && matchesIngredientPhrase(name, "cracker")));
    if (match) {
      issues.push({
        source: "heart-failure",
        ruleId: "cardiac:restricted_ingredient",
        ingredient: ingredient.name,
        message: `Cardiac protocol restricts "${ingredient.name}" (ingredient: ${match}); adapt this ingredient while preserving the requested food.`,
      });
    }
  }
  return {
    isValid: issues.length === 0,
    violations: issues.map(issue => issue.message),
    blockedIngredients: issues.map(issue => issue.ingredient!),
    issues,
  };
}

export const CARDIAC_DESSERT_ADAPTATION =
  "Dessert is not a prohibited category. Preserve the requested dessert's structure, texture and preparation. " +
  "For cardiac-compatible cheesecake, consider a set or baked filling using plain nonfat Greek yogurt, or a verified compatible dairy-free alternative when required by allergies/diet; use a compatible unsalted base. " +
  "These are substitution options, not automatic approvals. Verify quantities, preparation, nutrition and every active protocol. " +
  "Do not use cream cheese, butter or cracker qualifiers as proof of compatibility. Do not replace cheesecake with an unrelated parfait, fruit cup or protein snack. " +
  "Do not invent universal snack calorie limits or GLP-1 requirements.";

export class SnackCompatibilityError extends Error {
  readonly code = "snack_compatibility_completion_failed";
  constructor(
    readonly issues: DietValidationIssue[],
    readonly attempts: number,
  ) {
    super(`We couldn't finish a compatible version in ${attempts} attempts. ` +
      issues.map(issue => `[${issue.source}] ${issue.message}`).join(" ") +
      " This is an attempt-completion failure, not a prohibition on desserts.");
    this.name = "SnackCompatibilityError";
  }
}
