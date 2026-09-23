import { and, eq } from "drizzle-orm";
import { householdProfiles, users } from "@shared/schema";
import { oneTouchDirectionSchema, type OneTouchDirection, type OneTouchRequest } from "@shared/oneTouch";
import type { HumanFoodCandidate } from "@shared/humanFoodValidation";
import { db } from "../../db";
import { createHumanFoodRequestScope } from "../humanFoodContext/requestScope";
import { buildCreatorHumanFoodPrompt } from "../humanFoodContext/adapters";
import { validateHumanFoodResult } from "../humanFoodContext/validateHumanFoodResult";
import { validateHumanFoodCandidate } from "../humanFoodContext/finalValidation";
import { toPerServingNutrition } from "../humanFoodContext/servingNutrition";
import { enforceSafetyProfile } from "../safetyProfileService";
import { buildDietPromptBlock } from "../allergyGuardrails";
import {
  enforceBeforeGenerate, loadUserProtocolEnvelope, scanGeneratedOutput,
} from "../protocolEnvelope";
import { withOneTouchDiet, mutableProfileStyles } from "./dietAuthority";
import { validateOneTouchDirectionSafety } from "./directions";
import { resolveGLP1GlobalContext, buildGLP1RecommendationBlock } from "../glp1/resolveGLP1GlobalContext";
import { validateMealForDiet } from "../guardrails";
import { validateDiabeticMeal } from "../guardrails/validators/diabeticValidator";
import { validateDishIdentity } from "../dishAdaptation/dishIdentityValidator";
import { scaleIngredientQuantity } from "../servingScaling";
import { generateMealImageUnified, normalizeMealTypeToSourceType } from "../mealImageGenerator";
import { generateMenuRecipe, type MenuRecipeDraft } from "./menuRecipeGenerator";
import { oneTouchContextFingerprint } from "./contextFingerprint";
import type { GLP1GlobalContext } from "../glp1/resolveGLP1GlobalContext";
import { assessMenuDietEvidence } from "./menuDietEvidence";

/** Server-only operation. The caller must supply its authenticated actor, not a browser body ID. */
export interface MenuRecipeCompletionInput {
  actorUserId: string;
  subject: { id: string; kind: "account" | "household" };
  approvedConcept: OneTouchDirection;
  servings: number;
  cuisine?: string | null;
  dietaryDirection?: string | null;
  dateISO?: string;
}

export type MenuRecipeFailureCode =
  | "unauthorized_subject" | "unresolved_authority" | "invalid_request"
  | "concept_rejected" | "allergy_avoidance_rejected" | "diet_hfc_rejected"
  | "diabetes_rejected" | "glp1_rejected" | "protocol_clinical_rejected"
  | "generation_failed" | "nutrition_evidence_invalid" | "identity_mismatch"
  | "final_validation_rejected" | "serving_finalization_failed";

export interface MenuRecipeCard {
  name: string;
  description: string;
  ingredients: Array<{ name: string; quantity: string; unit: string }>;
  instructions: string;
  nutrition: { calories: number; protein: number; carbs: number; fat: number; starchyCarbs: number };
  cookingTime: string;
  servingSize: string;
  nutritionSource: "model_estimate";
  imageUrl?: string;
}

export type MenuRecipeCompletionResult =
  | { ok: true; card: MenuRecipeCard; contextFingerprint: string }
  | { ok: false; code: MenuRecipeFailureCode; retryable: boolean };

const fail = (code: MenuRecipeFailureCode, retryable = false): MenuRecipeCompletionResult =>
  ({ ok: false, code, retryable });

const ALLOWED_DIETS = new Set([
  "vegan", "vegetarian", "pescatarian", "keto", "paleo", "gluten-free",
  "kosher", "halal", "carnivore",
]);

function validMacros(draft: MenuRecipeDraft): boolean {
  return ["calories", "protein", "starchyCarbs", "fibrousCarbs", "fat"].every(
    (key) => Number.isFinite(draft[key as keyof MenuRecipeDraft] as number),
  );
}

function conceptIdentityMatches(concept: OneTouchDirection, draft: MenuRecipeDraft): boolean {
  const identity = validateDishIdentity(concept.title, draft);
  if (!identity.passed || identity.catastrophicDeviation) return false;
  // Title resemblance is insufficient: the defining foods must remain in the recipe.
  const ingredientText = draft.ingredients.map((ingredient) => ingredient.name.toLowerCase()).join(" ");
  return concept.primaryIngredients.every((required) => {
    const normalized = required.toLowerCase().trim();
    return ingredientText.includes(normalized);
  });
}

function perServingCard(draft: MenuRecipeDraft): MenuRecipeCard {
  return {
    name: draft.name,
    description: draft.description,
    ingredients: draft.ingredients.map((ingredient) => ({
      name: ingredient.name,
      quantity: String(ingredient.quantity),
      unit: ingredient.unit,
    })),
    instructions: draft.instructions,
    nutrition: {
      calories: draft.calories,
      protein: draft.protein,
      carbs: draft.starchyCarbs + draft.fibrousCarbs,
      fat: draft.fat,
      starchyCarbs: draft.starchyCarbs,
    },
    cookingTime: draft.cookingTime,
    servingSize: "1 serving",
    nutritionSource: "model_estimate",
  };
}

function scaleCard(card: MenuRecipeCard, servings: number): MenuRecipeCard | null {
  const ingredients = card.ingredients.map((ingredient) => ({
    ...ingredient,
    quantity: scaleIngredientQuantity(ingredient.quantity, servings),
  }));
  // Never claim a multi-serving total when an ingredient quantity could not be scaled.
  if (ingredients.some((ingredient) => !Number.isFinite(Number(ingredient.quantity)))) return null;
  return {
    ...card,
    ingredients: ingredients.map((ingredient) => ({ ...ingredient, quantity: String(ingredient.quantity) })),
    nutrition: Object.fromEntries(
      Object.entries(card.nutrition).map(([key, value]) => [key, value * servings]),
    ) as MenuRecipeCard["nutrition"],
    servingSize: `${servings} servings`,
  };
}

/**
 * Construct evidence only from a validated structured generation and the actual
 * authoritative checks. Model-supplied cuisine is a culinary claim, not clinical proof.
 * Never assert commercial/religious certification.
 */
function finalCandidate(
  card: MenuRecipeCard,
  draft: MenuRecipeDraft,
  servings: number,
  proof: { diabetes?: boolean; glp1?: boolean; dietaryIdentity?: boolean },
  category: string,
): HumanFoodCandidate {
  const perServing = toPerServingNutrition(card, servings);
  return {
    name: card.name,
    description: card.description,
    category,
    ingredients: card.ingredients,
    instructions: card.instructions,
    nutrition: {
      calories: Number(perServing.calories),
      protein: Number(perServing.protein),
      carbs: Number(perServing.carbs),
      fat: Number(perServing.fat),
      starchyCarbs: Number(perServing.starchyCarbs),
    },
    evidence: {
      sourceType: "generated_recipe",
      ingredientEvidence: "structured_generation",
      preparationEvidence: "structured_generation",
      nutritionEvidence: "structured_generation",
      // The identity classifier is the sole source of positive dietary proof.
      // A clean protocol scan cannot prove keto macros or clinical directives.
      dietaryIdentityCompliant: proof.dietaryIdentity,
      diabetesCompliant: proof.diabetes,
      glp1Compliant: proof.glp1,
      dishIdentityPreserved: true,
      cuisine: draft.evidence?.cuisine ?? undefined,
      cuisineIntensity: draft.evidence?.cuisineIntensity ?? undefined,
      heat: draft.evidence?.heat ?? undefined,
      seasoningIntensity: draft.evidence?.seasoningIntensity ?? undefined,
      broadFlavor: draft.evidence?.broadFlavor ?? undefined,
      flavorStyle: draft.evidence?.flavorStyle ?? undefined,
    },
  };
}

/**
 * Not wired to any route in Phase 2. One invocation asks for exactly one
 * candidate, returns one validated card or a typed failure, and never calls
 * the manual Creator route or its three-candidate generator.
 */
export async function completeMenuRecipe(input: MenuRecipeCompletionInput): Promise<MenuRecipeCompletionResult> {
  if (!input.actorUserId?.trim() || !input.subject?.id?.trim()) return fail("unauthorized_subject");
  const parsedConcept = oneTouchDirectionSchema.safeParse(input.approvedConcept);
  if (!parsedConcept.success || !Number.isInteger(input.servings) || input.servings < 1 || input.servings > 10 ||
      (input.cuisine && (input.cuisine.length < 2 || input.cuisine.length > 80)) ||
      (input.dietaryDirection && !ALLOWED_DIETS.has(input.dietaryDirection.toLowerCase()))) {
    return fail("invalid_request");
  }
  const concept = parsedConcept.data;
  const mealType = concept.occasion;
  const isHousehold = input.subject.kind === "household";
  if (input.subject.kind !== "account" && !isHousehold) return fail("invalid_request");
  if (!isHousehold && input.subject.id !== input.actorUserId) return fail("unauthorized_subject");
  if (isHousehold) {
    try {
      const [actor] = await db.select({ activeHouseholdProfileId: users.activeHouseholdProfileId })
        .from(users).where(eq(users.id, input.actorUserId)).limit(1);
      if (actor?.activeHouseholdProfileId !== input.subject.id) return fail("unauthorized_subject");
      const [owned] = await db.select({ id: householdProfiles.id })
        .from(householdProfiles).where(and(
          eq(householdProfiles.id, input.subject.id),
          eq(householdProfiles.ownerUserId, input.actorUserId),
        )).limit(1);
      if (!owned || input.subject.id === input.actorUserId) return fail("unauthorized_subject");
    } catch {
      return fail("unresolved_authority", true);
    }
  }

  const dietaryDirection = input.dietaryDirection?.toLowerCase() ?? null;
  const scopeInput = {
    actorUserId: input.actorUserId,
    subjectUserId: input.subject.id,
    creator: "my_perfect_menu" as const,
    dietOverride: dietaryDirection,
    cuisine: input.cuisine ?? null,
    dateISO: input.dateISO,
  };
  const scope = createHumanFoodRequestScope(scopeInput);
  try {
    const context = await scope.resolve();
    if (context.status === "review_required" || context.status === "blocked") return fail("unresolved_authority");
    if (!isHousehold && context.gaps.some(
      (gap) => gap === "daily_nutrition_state" || gap === "diabetes.glucose_food_preferences",
    )) return fail("unresolved_authority", true);
    // Household HFC intentionally lacks account nutrition/diabetes/GLP-1. Do not
    // substitute the actor's authority to fill those absent dimensions.
    if (isHousehold && (context.nutrition || context.diabetesFoodPreferences)) return fail("unresolved_authority");
    const profileEnvelope = await loadUserProtocolEnvelope(
      input.actorUserId,
      isHousehold ? input.subject.id : undefined,
    );
    if (!profileEnvelope) return fail("unresolved_authority", true);
    const envelope = withOneTouchDiet(profileEnvelope, dietaryDirection);
    if (isHousehold && (envelope.hasDiabetes ||
      context.safety.healthConditions.some((condition) => /glp.?1|semaglutide|tirzepatide/i.test(condition)) ||
      [...envelope.medicalHardLimits, ...envelope.medicalOptimization].some(
        (limit) => /glp.?1|semaglutide|tirzepatide/i.test(limit),
      ))) return fail("unresolved_authority");
    if (envelope.glp1DailyTolerance?.shouldEscalate) return fail("glp1_rejected");

    const glp1 = isHousehold ? null : await resolveGLP1GlobalContext(
      input.subject.id, input.dateISO ?? context.nutrition?.date ?? new Date().toISOString().slice(0, 10), mealType,
    );
    if (glp1?.isActive && !glp1.resolvedTargets) return fail("unresolved_authority", true);
    const envelopeMentionsGlp1 = [...envelope.medicalHardLimits, ...envelope.medicalOptimization]
      .some((value) => /glp.?1|semaglutide|tirzepatide/i.test(value));
    if (envelopeMentionsGlp1 && !glp1?.isActive) return fail("unresolved_authority");
    const inactiveGlp1: GLP1GlobalContext = {
      isActive: false, activationSources: [], performanceActive: false,
      resolvedTargets: null, dailyNutritionState: null, compositionNote: "",
    };
    const choices: OneTouchRequest = {
      creator: mealType === "snack" ? "craving_creator" : "create_a_dish",
      servings: input.servings,
      cuisine: input.cuisine ? { mode: "explicit", value: input.cuisine } : { mode: "profile" },
      eatingStyle: dietaryDirection ? { mode: "explicit", value: dietaryDirection } : { mode: "profile" },
    };
    const authorityFingerprint = oneTouchContextFingerprint(
      choices, context, envelope, glp1 ?? inactiveGlp1,
    );

    const conceptIssues = validateOneTouchDirectionSafety(
      concept, context, envelope, input.cuisine ?? null,
    );
    if (conceptIssues.length) return fail("concept_rejected");
    if (!isHousehold) {
      const decision = await enforceSafetyProfile(input.subject.id,
        `${concept.title}. ${concept.description}. ${concept.primaryIngredients.join(", ")}`,
        "menu-recipe-completion", {
          safetyMode: "STRICT",
          ignoredDietaryRestrictions: dietaryDirection ? mutableProfileStyles(profileEnvelope) : [],
        });
      // Menu completion does not consume manual Creator override tokens or
      // silently accept advisory/ambiguous decisions.
      if (decision.result !== "SAFE") return fail(
        decision.result === "BLOCKED" ? "allergy_avoidance_rejected" : "diet_hfc_rejected",
      );
    }

    const authorityPrompt = [
      buildCreatorHumanFoodPrompt("my_perfect_menu", context, scope.executionState),
      buildDietPromptBlock(context.diet.effective),
      enforceBeforeGenerate(envelope, { generatorName: "menu-recipe-completion" }).combined,
      glp1 ? buildGLP1RecommendationBlock(glp1) : "",
    ].filter(Boolean).join("\n\n");
    let draft: MenuRecipeDraft;
    try {
      draft = await generateMenuRecipe({ concept, cuisine: input.cuisine ?? null, authorityPrompt });
    } catch {
      return fail("generation_failed", true);
    }
    if (!validMacros(draft)) return fail("nutrition_evidence_invalid");
    const card = perServingCard(draft);
    if (!conceptIdentityMatches(concept, draft)) return fail("identity_mismatch");
    const hfc = validateHumanFoodResult(card, context);
    if (!hfc.valid) return fail("diet_hfc_rejected");
    const protocol = scanGeneratedOutput(card, envelope, { generatorName: "menu-recipe-completion" });
    if (!protocol.passed) return fail("protocol_clinical_rejected");

    const diabetesCompliant = envelope.hasDiabetes
      ? validateDiabeticMeal({
          name: card.name, description: card.description,
          ingredients: card.ingredients, instructions: card.instructions,
          macros: card.nutrition,
        }, { glucoseState: envelope.diabeticGlucoseState ?? undefined }).isValid
      : undefined;
    if (diabetesCompliant === false) return fail("diabetes_rejected");
    const glp1Compliant = glp1?.isActive
      ? validateMealForDiet({
          name: card.name,
          ingredients: card.ingredients,
          instructions: card.instructions,
          macros: card.nutrition,
        }, "glp1", undefined, mealType === "snack", glp1.resolvedTargets!).isValid
      : undefined;
    if (glp1Compliant === false) return fail("glp1_rejected");
    // A protocol text scan alone cannot prove numeric or specialist directives
    // (for example renal sodium limits) that this one-recipe contract cannot
    // measure. Final validation must review those rather than receiving true.
    const otherClinicalCondition = context.safety.healthConditions.some(
      (condition) => !/glp.?1|semaglutide|tirzepatide|diabet/i.test(condition),
    );
    const otherEnvelopeDirective = [...envelope.medicalHardLimits, ...envelope.medicalOptimization]
      .some((condition) => !/glp.?1|semaglutide|tirzepatide|diabet/i.test(condition));
    const hasOtherClinicalDirective = otherClinicalCondition || otherEnvelopeDirective;
    if (hasOtherClinicalDirective) return fail("protocol_clinical_rejected");
    const proof = { diabetes: diabetesCompliant, glp1: glp1Compliant };
    const check = (candidate: HumanFoodCandidate) =>
      validateHumanFoodCandidate(candidate, context, {
        requestedDish: concept.title,
        requestedCategory: mealType,
        executionState: scope.executionState,
      });
    const firstFood = finalCandidate(card, draft, 1, proof, mealType);
    const firstDiet = assessMenuDietEvidence(firstFood, context.diet.effective);
    if (firstDiet.status === "contradicted") return fail("diet_hfc_rejected");
    firstFood.evidence = { ...firstFood.evidence, dietaryIdentityCompliant: firstDiet.dietaryIdentityCompliant };
    if (check(firstFood).outcome !== "pass") return fail("final_validation_rejected");
    const formatted = scaleCard(card, input.servings);
    if (!formatted) return fail("serving_finalization_failed");
    // Repeat ALL food checks against the actual returned ingredients/instructions
    // and convert final total-recipe nutrition back to the one-serving authority.
    const finalFood = finalCandidate(formatted, draft, input.servings, proof, mealType);
    const finalDiet = assessMenuDietEvidence(finalFood, context.diet.effective);
    if (finalDiet.status === "contradicted") return fail("diet_hfc_rejected");
    finalFood.evidence = { ...finalFood.evidence, dietaryIdentityCompliant: finalDiet.dietaryIdentityCompliant };
    if (!validateHumanFoodResult(finalFood, context).valid ||
        !scanGeneratedOutput(finalFood, envelope, { generatorName: "menu-recipe-completion" }).passed ||
        !conceptIdentityMatches(concept, { ...draft, ingredients: formatted.ingredients }) ||
        check(finalFood).outcome !== "pass") {
      return fail("final_validation_rejected");
    }
    const current = await createHumanFoodRequestScope(scopeInput).resolve();
    const currentEnvelope = await loadUserProtocolEnvelope(input.actorUserId, isHousehold ? input.subject.id : undefined);
    const currentGlp1 = isHousehold ? null : await resolveGLP1GlobalContext(
      input.subject.id, input.dateISO ?? current.nutrition?.date ?? new Date().toISOString().slice(0, 10), mealType,
    );
    if (current.status === "review_required" || current.status === "blocked" ||
        !currentEnvelope || (currentGlp1?.isActive && !currentGlp1.resolvedTargets) ||
        oneTouchContextFingerprint(
          choices, current, withOneTouchDiet(currentEnvelope, dietaryDirection), currentGlp1 ?? inactiveGlp1,
        ) !== authorityFingerprint) {
      return fail("unresolved_authority", true);
    }
    try {
      formatted.imageUrl = await generateMealImageUnified(
        formatted.name, formatted.ingredients, normalizeMealTypeToSourceType(mealType),
      );
    } catch {
      // Food has already passed; an image failure never changes its food safety.
    }
    return { ok: true, card: formatted, contextFingerprint: authorityFingerprint };
  } catch {
    return fail("unresolved_authority", true);
  }
}