import type { OneTouchDirection, OneTouchCreator } from "@shared/oneTouch";
import type { HumanFoodContext } from "@shared/humanFoodContext";
import type { HumanFoodCandidate } from "@shared/humanFoodValidation";
import { generateCravingMealOptions, type UnifiedMeal } from "../unifiedMealPipeline";
import { enforceFinalCreatorCandidates } from "../humanFoodContext/enforceFinalCreatorCandidates";
import { validateHumanFoodCandidate } from "../humanFoodContext/finalValidation";
import { validateHumanFoodResult } from "../humanFoodContext/validateHumanFoodResult";
import { toPerServingNutrition } from "../humanFoodContext/servingNutrition";
import { buildCreatorHumanFoodPrompt } from "../humanFoodContext/adapters";
import { enforceBeforeGenerate, filterMealsByProtocol, scanGeneratedOutput } from "../protocolEnvelope";
import { validateOneTouchDirectionSafety } from "./directions";
import { validateDishIdentity } from "../dishAdaptation/dishIdentityValidator";
import { buildGuardrailContext, getDishAdaptationDirective } from "../dishAdaptation/dishAdaptationLayer";
import { enforceSafetyProfile } from "../safetyProfileService";
import { validateMealForDiet } from "../guardrails";
import { validateDiabeticMeal } from "../guardrails/validators/diabeticValidator";
import { scaleIngredientQuantity } from "../servingScaling";
import { generateMealImageUnified, normalizeMealTypeToSourceType } from "../mealImageGenerator";
import type { GLP1GlobalContext } from "../glp1/resolveGLP1GlobalContext";

type Envelope = Parameters<typeof scanGeneratedOutput>[1];

export interface SelectedConceptHandoff {
  actorUserId: string;
  creator: OneTouchCreator;
  concept: OneTouchDirection;
  servings: number;
  cuisine: string | null;
  context: HumanFoodContext;
  envelope: Envelope;
  glp1: GLP1GlobalContext;
  /** Profile styles replaced by a server-validated, request-scoped Builder diet. */
  overriddenDietaryIdentities: string[];
}

export type SelectedConceptResult =
  | { ok: true; meal: Record<string, unknown> }
  | { ok: false; code: "concept_rejected" | "generation_failed" | "identity_mismatch" | "final_validation_rejected"; retryable?: boolean };

/**
 * Menu owns the choice, not the recipe engine. This is an account-only,
 * server-authorized handoff to the manual Creators' variety generator and
 * bounded final-candidate enforcement. Never accept a client-provided dish.
 */
export async function completeSelectedConcept(input: SelectedConceptHandoff): Promise<SelectedConceptResult> {
  const { concept, context, envelope } = input;
  // The Menu can offer ideas with non-blocking preference gaps. Selection must
  // accept the same authority state; clinical/protocol and final recipe gates
  // still run against the freshly resolved context.
  if (!["resolved", "resolved_with_gaps"].includes(context.status) ||
      context.subjectUserId !== input.actorUserId ||
      concept.occasion !== (input.creator === "craving_creator" ? "snack" : "lunch") ||
      validateOneTouchDirectionSafety(concept, context, envelope, input.cuisine).length) {
    return { ok: false, code: "concept_rejected" };
  }
  if ((envelope.hasDiabetes && !envelope.diabeticGlucoseState) ||
      (input.glp1.isActive && !input.glp1.resolvedTargets)) {
    return { ok: false, code: "final_validation_rejected" };
  }
  // A text scan cannot certify specialist numeric/clinical instructions.
  // Preserve the former Menu's fail-closed boundary until a matching
  // condition-specific validator is available in the shared Creator pipeline.
  const otherClinical = (value: string) => !/glp.?1|semaglutide|tirzepatide|diabet/i.test(value);
  if (context.safety.healthConditions.some(otherClinical) ||
      envelope.medicalHardLimits.some(otherClinical)) {
    return { ok: false, code: "final_validation_rejected" };
  }
  const safety = await enforceSafetyProfile(input.actorUserId,
    `${concept.title}. ${concept.description}. ${concept.primaryIngredients.join(", ")}`,
    "menu-selected-concept", {
      safetyMode: "STRICT",
      ignoredDietaryRestrictions: input.overriddenDietaryIdentities,
    });
  if (safety.result !== "SAFE") return { ok: false, code: "concept_rejected" };
  const directive = await getDishAdaptationDirective(
    concept.title,
    buildGuardrailContext({
      dietaryIdentity: context.diet.effective,
      glp1Active: input.glp1.isActive,
      allergies: envelope.allergies,
      overriddenAllergens: [],
    }),
    "first_pass",
  );

  // The title is classification input; concept text is culinary data, never an
  // authorization source. The generator resolves the account profile again.
  const generationInput = [
    concept.title,
    `Selected dish: ${concept.title}. Culinary form: ${concept.culinaryIdentity.dishForm}.`,
    `Defining ingredients: ${concept.primaryIngredients.join(", ")}.`,
    `Preparation: ${concept.preparationMethod}. Cuisine: ${concept.cuisine}.`,
    concept.description,
    buildCreatorHumanFoodPrompt(input.creator, context),
    enforceBeforeGenerate(envelope, { generatorName: "menu-selected-concept" }).combined,
  ].join("\n");
  const diet = context.diet.effective;
  const cuisine = input.cuisine ?? (context.flavor.cuisine.available ? context.flavor.cuisine.value : concept.cuisine);
  const targets = input.glp1.isActive ? input.glp1.resolvedTargets ?? undefined : undefined;
  const generate = (prompt: string) => generateCravingMealOptions(
    prompt, concept.occasion, input.actorUserId, diet, [], false, "auto",
    cuisine ?? undefined, targets, undefined, directive, false,
    undefined, undefined, input.overriddenDietaryIdentities,
    concept.title,
  );
  const matches = (meal: UnifiedMeal): boolean => {
    const identity = validateDishIdentity(concept.title, meal, directive);
    if (!identity.passed || identity.catastrophicDeviation) return false;
    const names = meal.ingredients.map((ingredient) => ingredient.name.toLowerCase()).join(" ");
    return concept.primaryIngredients.every((name) => names.includes(name.toLowerCase().trim()));
  };
  const nutrition = (meal: UnifiedMeal) => ({
    calories: meal.calories, protein: meal.protein, carbs: meal.carbs,
    fat: meal.fat, starchyCarbs: meal.starchyCarbs,
  });
  const candidate = (meal: UnifiedMeal): HumanFoodCandidate => {
    const protocol = scanGeneratedOutput(meal, envelope, { generatorName: "menu-selected-final" });
    const diabetes = envelope.hasDiabetes && envelope.diabeticGlucoseState
      ? validateDiabeticMeal({
          name: meal.name, description: meal.description, ingredients: meal.ingredients,
          instructions: meal.instructions, macros: nutrition(meal),
        }, { glucoseState: envelope.diabeticGlucoseState }).isValid
      : undefined;
    const glp1 = input.glp1.isActive && input.glp1.resolvedTargets
      ? validateMealForDiet({
          name: meal.name, ingredients: meal.ingredients,
          instructions: meal.instructions, macros: nutrition(meal),
        }, "glp1", undefined, concept.occasion === "snack", input.glp1.resolvedTargets).isValid
      : undefined;
    return {
      ...meal, category: concept.occasion,
      nutrition: nutrition(meal),
      evidence: {
        ...meal.evidence, sourceType: "generated_recipe",
        ingredientEvidence: "structured_generation",
        preparationEvidence: "structured_generation",
        nutritionEvidence: "structured_generation",
        dietaryIdentityCompliant: protocol.passed,
        clinicalDirectivesCompliant: undefined,
        diabetesCompliant: diabetes, glp1Compliant: glp1,
      },
    };
  };
  const safe = (meal: UnifiedMeal) => {
    if (!matches(meal) ||
        !Number.isFinite(meal.calories) || !Number.isFinite(meal.protein) ||
        !Number.isFinite(meal.carbs) || !Number.isFinite(meal.fat)) return false;
    const assessed = candidate(meal);
    if ((envelope.hasDiabetes && assessed.evidence?.diabetesCompliant !== true) ||
        (input.glp1.isActive && assessed.evidence?.glp1Compliant !== true)) return false;
    const food = validateHumanFoodResult(assessed, context);
    if (food.violations.some((violation) => !violation.startsWith("projected_"))) return false;
    return filterMealsByProtocol([meal], envelope, {
      generatorName: "menu-selected-concept",
      dishIdentity: { requestedDish: concept.title, directive },
    }).length === 1;
  };
  const validate = (meal: UnifiedMeal) =>
    validateHumanFoodCandidate(candidate(meal), context, {
      requestedDish: concept.title, requestedCategory: concept.occasion,
    });

  let generated: UnifiedMeal[];
  try {
    generated = await generate(generationInput);
  } catch {
    return { ok: false, code: "generation_failed", retryable: true };
  }
  let identityMatches = generated.filter(matches);
  if (!identityMatches.length) {
    // The manual variety generator may offer recognizable variants while
    // omitting a defining ingredient from the selected Menu concept. Ask for
    // one targeted correction, then apply the exact same identity and safety
    // gates; never turn an unrelated fallback into the chosen card.
    try {
      identityMatches = (await generate(
        `${generationInput}\n\n[SELECTED DISH IDENTITY REPAIR — ONE ATTEMPT ONLY]\n` +
        `Make ${concept.title} in the selected ${concept.culinaryIdentity.dishForm} form. ` +
        `List every defining ingredient by name as a separate structured ingredient: ${concept.primaryIngredients.join(", ")}. ` +
        "Preserve all allergies, avoidances, dietary and clinical restrictions. " +
        "If any defining ingredient cannot be used safely, do not substitute an unrelated dish.",
      )).filter(matches);
    } catch {
      return { ok: false, code: "generation_failed", retryable: true };
    }
  }
  if (!identityMatches.length) return { ok: false, code: "identity_mismatch" };
  const matching = identityMatches.filter(safe);
  if (!matching.length) return { ok: false, code: "final_validation_rejected" };
  const final = await enforceFinalCreatorCandidates({
    candidates: matching,
    validate,
    repair: async (instructions) => {
      try {
        return (await generate(
          `${generationInput}\nRepair this selected dish while preserving its defining ingredients: ${instructions.join(" ")}`,
        )).filter(safe);
      } catch {
        return [];
      }
    },
  });
  const selected = final.accepted.find((meal) => safe(meal) && validate(meal).outcome === "pass");
  if (!selected) return { ok: false, code: "final_validation_rejected" };

  // Mirror the manual Creator contract: total-recipe nutrition and quantities
  // for the requested serving count, with per-serving final revalidation.
  const ingredients = selected.ingredients.map((ingredient) => ({
    ...ingredient, quantity: scaleIngredientQuantity(ingredient.quantity, input.servings),
  }));
  if (ingredients.some((ingredient) => !Number.isFinite(Number(ingredient.quantity)))) {
    return { ok: false, code: "final_validation_rejected" };
  }
  const meal = {
    ...selected, ingredients,
    calories: selected.calories * input.servings,
    protein: selected.protein * input.servings,
    carbs: selected.carbs! * input.servings,
    fat: selected.fat * input.servings,
    ...(selected.starchyCarbs != null ? { starchyCarbs: selected.starchyCarbs * input.servings } : {}),
    ...(selected.fibrousCarbs != null ? { fibrousCarbs: selected.fibrousCarbs * input.servings } : {}),
    nutrition: {
      calories: selected.calories * input.servings,
      protein: selected.protein * input.servings,
      carbs: selected.carbs! * input.servings,
      fat: selected.fat * input.servings,
      ...(selected.starchyCarbs != null ? { starchyCarbs: selected.starchyCarbs * input.servings } : {}),
    },
    servingSize: `${input.servings} ${input.servings === 1 ? "serving" : "servings"}`,
    nutritionSource: "model_estimate" as const,
  };
  const perServing = toPerServingNutrition(meal, input.servings);
  const returnedCandidate = candidate({
    ...selected, ingredients,
    calories: Number(perServing.calories),
    protein: Number(perServing.protein),
    carbs: Number(perServing.carbs),
    fat: Number(perServing.fat),
    ...(perServing.starchyCarbs != null ? { starchyCarbs: Number(perServing.starchyCarbs) } : {}),
  });
  if (!matches({ ...selected, ingredients }) ||
      !validateHumanFoodResult(returnedCandidate, context).valid ||
      !scanGeneratedOutput(meal, envelope, { generatorName: "menu-selected-final" }).passed ||
      validateHumanFoodCandidate(returnedCandidate, context, {
        requestedDish: concept.title, requestedCategory: concept.occasion,
      }).outcome !== "pass") {
    return { ok: false, code: "final_validation_rejected" };
  }
  try {
    meal.imageUrl = await generateMealImageUnified(
      selected.name, ingredients.map((ingredient) => ingredient.name),
      normalizeMealTypeToSourceType(concept.occasion),
    );
  } catch {
    // A missing image does not change the validated food.
  }
  return { ok: true, meal };
}