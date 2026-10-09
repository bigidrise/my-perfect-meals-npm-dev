import {
  buildLowCarbSourceGuidance,
  classifyCarbohydrateSource,
  type CarbohydrateSourceCategory,
} from "../../../shared/carbSourcePolicy";
import {
  classifyNutritionalRole,
  type NutritionalRole,
} from "../groceryNutritionalRole";
import type { HumanFoodCandidate } from "../../../shared/humanFoodValidation";
import type { HumanFoodContext } from "../../../shared/humanFoodContext";

export type LowCarbSourceEvidenceStatus =
  | "pass"
  | "adaptation_required"
  | "review_required";

export interface LowCarbIngredient {
  name?: unknown;
  item?: unknown;
  /**
   * Optional recipe-level components for a compound sauce. The compound label
   * is never proof by itself; each listed component is evaluated separately.
   */
  components?: readonly LowCarbIngredientInput[];
}

export type LowCarbIngredientInput = string | LowCarbIngredient;

export interface LowCarbNutritionEvidence {
  calories?: unknown;
  protein?: unknown;
  carbs?: unknown;
  fat?: unknown;
  starchyCarbs?: unknown;
  fibrousCarbs?: unknown;
  [key: string]: unknown;
}

export interface LowCarbIngredientEvidence {
  ingredient: string;
  category: CarbohydrateSourceCategory;
  role?: NutritionalRole;
  requiresExplicitEvidence: boolean;
  reason?: string;
}

/** Request-scoped culinary interpretation, not a safety or nutrient certificate. */
export interface ContextualSourceDecision {
  ingredient: string;
  category: CarbohydrateSourceCategory | "nonmaterial";
  role: string;
  reason: string;
}

export interface LowCarbSourceEvidence {
  /** Pass means the provided recipe's named source classes are explicit and usable. */
  status: LowCarbSourceEvidenceStatus;
  source: "canonical_carb_source_policy";
  ingredientsComplete: boolean;
  nutritionValuesFinite: boolean;
  ingredientEvidence: LowCarbIngredientEvidence[];
  issues: string[];
  /**
   * A single recipe cannot prove a day-level allocation. This is always false
   * here so callers cannot mistake recipe classification for a verified ratio.
   */
  dailySourceDistributionVerified: false;
  /** This policy is additive guidance and never mutates the existing target. */
  totalCarbohydrateTargetChanged: false;
  /** Values were checked for shape/finiteness only; their accuracy is unverified. */
  nutritionEvidenceBasis: "provided_values_unverified" | "missing_or_invalid";
  /** Number of compound sauce ingredient groups expanded from recipe components. */
  expandedSauceComponentGroups: number;
}

const requiredNutritionFields = ["calories", "protein", "carbs", "fat"] as const;

function getIngredientName(ingredient: LowCarbIngredientInput): string {
  if (typeof ingredient === "string") return ingredient.trim();
  const name = typeof ingredient.name === "string" ? ingredient.name : "";
  const item = typeof ingredient.item === "string" ? ingredient.item : "";
  return (name || item).trim();
}

const MAX_COMPONENT_DEPTH = 4;

interface ExpandedIngredients {
  names: string[];
  complete: boolean;
  issues: string[];
  expandedSauceComponentGroups: number;
}

/**
 * Expand only sauce components explicitly represented in the structured recipe.
 * A "homemade"/"sugar-free" label alone remains a sauce requiring review.
 */
function expandRecipeIngredients(
  ingredients: readonly LowCarbIngredientInput[],
): ExpandedIngredients {
  const names: string[] = [];
  const issues: string[] = [];
  const activeObjects = new WeakSet<object>();
  let complete = ingredients.length > 0;
  let expandedSauceComponentGroups = 0;

  const visit = (ingredient: LowCarbIngredientInput, depth: number): void => {
    if (typeof ingredient === "string") {
      const name = ingredient.trim();
      if (!name) {
        complete = false;
        issues.push("Every recipe component needs a non-empty ingredient name.");
      } else {
        names.push(name);
      }
      return;
    }
    if (!ingredient || typeof ingredient !== "object") {
      complete = false;
      issues.push("A recipe component is missing its structured ingredient record.");
      return;
    }
    if (activeObjects.has(ingredient)) {
      complete = false;
      issues.push("A cyclic compound-ingredient component list cannot be evaluated.");
      return;
    }

    const name = getIngredientName(ingredient);
    const hasComponentsProperty = Object.prototype.hasOwnProperty.call(ingredient, "components");
    const components = ingredient.components;
    const hasComponentList = Array.isArray(components);
    const sourceClass = name ? classifyCarbohydrateSource(name) : null;
    const isSauce = sourceClass?.category === "sauce_condiment";
    const isNamedCompound = isSauce || sourceClass?.category === "spice_blend";

    if (hasComponentsProperty && (!hasComponentList || components.length === 0)) {
      complete = false;
      issues.push(`The component list for ${name || "a compound ingredient"} is missing or empty.`);
      if (name) names.push(name);
      return;
    }

    if (hasComponentList && isNamedCompound && name) {
      if (depth >= MAX_COMPONENT_DEPTH) {
        complete = false;
        issues.push(`The component list for ${name} is nested too deeply to evaluate.`);
        names.push(name);
        return;
      }

      if (isSauce) expandedSauceComponentGroups += 1;
      activeObjects.add(ingredient);
      for (const component of components) visit(component, depth + 1);
      activeObjects.delete(ingredient);
      return;
    }

    if (name) {
      names.push(name);
    } else {
      complete = false;
      issues.push("Every recipe component needs a non-empty ingredient name.");
    }

    if (hasComponentList) {
      complete = false;
      issues.push(
        `Components are accepted only for a named sauce or seasoning blend; review ${name || "this ingredient"}.`,
      );
      if (depth >= MAX_COMPONENT_DEPTH) {
        issues.push("Nested component details exceed the supported depth.");
        return;
      }
      activeObjects.add(ingredient);
      for (const component of components) visit(component, depth + 1);
      activeObjects.delete(ingredient);
    }
  };

  for (const ingredient of ingredients) visit(ingredient, 0);
  return { names, complete, issues, expandedSauceComponentGroups };
}

function hasFiniteNonnegativeNutrition(
  nutrition: LowCarbNutritionEvidence | null | undefined,
): nutrition is LowCarbNutritionEvidence {
  if (!nutrition || typeof nutrition !== "object") return false;
  return requiredNutritionFields.every((field) => {
    const value = nutrition[field];
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
  }) && ["starchyCarbs", "fibrousCarbs"].every((field) => {
    const value = nutrition[field];
    return value === undefined || (
      typeof value === "number" && Number.isFinite(value) && value >= 0
    );
  });
}

function isUncoatedProtein(name: string, role: NutritionalRole): boolean {
  if (!["lean_protein", "fatty_protein", "plant_protein"].includes(role)) return false;
  return !/\b(sweetened|glazed|breaded|battered|coated|sauce|marinade|syrup|honey|sugar)\b/i.test(name);
}

function isSimpleOil(name: string, role: NutritionalRole): boolean {
  return role === "healthy_fat" &&
    (
      /^(?:extra virgin )?(?:olive|avocado|canola|vegetable|sunflower|sesame|peanut|coconut|grapeseed|flaxseed) oil$/i.test(name) ||
      /^(?:unsalted )?butter$|^ghee$/i.test(name)
    );
}

/**
 * Evaluate only evidence available from a structured candidate.
 *
 * This is deliberately not a carb-limit calculator: finite macro fields do
 * not establish their accuracy, a daily target, or a recipe's share of the
 * product's 70/30 day-level food-source allocation.
 */
export function evaluateLowCarbSourceEvidence(
  ingredients: readonly LowCarbIngredientInput[] | null | undefined,
  nutrition: LowCarbNutritionEvidence | null | undefined,
  contextualDecisions: readonly ContextualSourceDecision[] = [],
): LowCarbSourceEvidence {
  const list = Array.isArray(ingredients) ? ingredients : [];
  const expandedIngredients = expandRecipeIngredients(list);
  const ingredientsComplete = expandedIngredients.complete &&
    expandedIngredients.names.length > 0;
  const nutritionValuesFinite = hasFiniteNonnegativeNutrition(nutrition);
  const issues: string[] = [...expandedIngredients.issues];
  const ingredientEvidence: LowCarbIngredientEvidence[] = [];
  let adaptationRequired = false;
  let reviewRequired = !ingredientsComplete || !nutritionValuesFinite;

  if (!ingredientsComplete) {
    issues.push("Complete, non-empty ingredient names are required.");
  }
  if (!nutritionValuesFinite) {
    issues.push("Finite, non-negative calories, protein, carbohydrate, and fat values are required.");
  }

  for (const name of expandedIngredients.names) {
    if (!name) continue;
    const classified = classifyCarbohydrateSource(name);
    const role = classifyNutritionalRole(name);
    let category = classified.category;
    let requiresExplicitEvidence = classified.requiresExplicitEvidence;
    let reason = classified.reason;

    // Reuse Grocery Coach's ingredient-role knowledge for foods that are not
    // themselves carbohydrate sources, while keeping legumes/sauces/etc. under
    // the explicit source categories returned by the canonical classifier.
    if (category === "unknown" && isUncoatedProtein(name, role)) {
      category = "non_carb_ingredient";
      requiresExplicitEvidence = false;
      reason = undefined;
    } else if (category === "unknown" && isSimpleOil(name, role)) {
      category = "non_carb_ingredient";
      requiresExplicitEvidence = false;
      reason = undefined;
    } else if (category === "unknown" && role === "starchy_carb") {
      category = "starchy_concentrated";
      requiresExplicitEvidence = false;
      reason = undefined;
    }

    // Only genuinely unresolved names can use contextual culinary evidence.
    // Compound/packaged, dairy, sugar and other explicitly guarded categories
    // never become verified just because a model described them positively.
    if (category === "unknown") {
      const decision = contextualDecisions.find((entry) => entry.ingredient === name);
      if (decision) {
        if (decision.category === "nonmaterial") {
          category = "non_carb_ingredient";
          requiresExplicitEvidence = false;
          reason = undefined;
        } else if (["whole_plant_fat", "non_starchy_fibrous", "starchy_concentrated", "added_sugar"].includes(decision.category)) {
          category = decision.category;
          requiresExplicitEvidence = false;
          reason = undefined;
        }
      }
    }

    ingredientEvidence.push({
      ingredient: name,
      category,
      role: role === "other" ? undefined : role,
      requiresExplicitEvidence,
      ...(reason ? { reason } : {}),
    });

    if (category === "added_sugar") {
      adaptationRequired = true;
      issues.push(`Adapt or explicitly resolve added/concentrated sugar: ${name}.`);
    } else if (requiresExplicitEvidence || category === "unknown") {
      reviewRequired = true;
      issues.push(reason || `Explicit carbohydrate-source evidence is needed for: ${name}.`);
    }
  }

  let status: LowCarbSourceEvidenceStatus;
  if (reviewRequired) {
    status = "review_required";
  } else if (adaptationRequired) {
    status = "adaptation_required";
  } else {
    status = "pass";
  }

  return {
    status,
    source: "canonical_carb_source_policy",
    ingredientsComplete,
    nutritionValuesFinite,
    ingredientEvidence,
    issues,
    dailySourceDistributionVerified: false,
    totalCarbohydrateTargetChanged: false,
    nutritionEvidenceBasis: nutritionValuesFinite
      ? "provided_values_unverified"
      : "missing_or_invalid",
    expandedSauceComponentGroups: expandedIngredients.expandedSauceComponentGroups,
  };
}

/**
 * Narrow, request-scoped proof: a zero-starch recipe fits the subject's
 * currently resolved allocation. This does NOT prove the daily 70/30 ratio,
 * verify model-estimated nutrition, or grant starch to an unknown day.
 */
export function assessLowCarbRecipeCompatibility(
  candidate: HumanFoodCandidate,
  context: HumanFoodContext,
  contextualDecisions: readonly ContextualSourceDecision[] = [],
): LowCarbSourceEvidence {
  const source = evaluateLowCarbSourceEvidence(candidate.ingredients, candidate.nutrition, contextualDecisions);
  if (source.status !== "pass") return source;
  const nutrition = context.nutrition;
  const remaining = nutrition?.projectedRemaining ?? nutrition?.remaining;
  if (context.status !== "resolved" || !nutrition ||
      nutrition.prescription?.source === "fallback" ||
      (nutrition.subject?.userId && nutrition.subject.userId !== context.subjectUserId) ||
      !remaining ||
      !["calories", "carbs", "fat"].every((macro) => {
        const value = remaining[macro as "calories" | "carbs" | "fat"];
        return typeof value === "number" && Number.isFinite(value) && value >= 0;
      })) {
    return { ...source, status: "review_required",
      issues: [...source.issues, "A current resolved subject-owned macro allocation is required."] };
  }
  // A daily macro goal overage is not a Low Carb source conflict. Starch
  // composition and day-level starch authority remain independently required.
  const starchy = source.ingredientEvidence.some((item) => item.category === "starchy_concentrated");
  if (starchy) {
    return { ...source, status: "review_required",
      issues: [...source.issues, "A concentrated starch needs a separate day-level source allocation before positive Low Carb proof. Adapt the starch source when possible."] };
  }
  if (candidate.nutrition!.starchyCarbs !== 0) {
    return { ...source, status: "review_required",
      issues: [...source.issues, "Zero-starch ingredients and the estimated starchy-carb quantity must agree."] };
  }
  return source;
}

export { buildLowCarbSourceGuidance };