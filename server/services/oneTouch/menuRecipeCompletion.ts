import { and, eq } from "drizzle-orm";
import { householdProfiles, users } from "@shared/schema";
import { oneTouchDirectionSchema, type OneTouchDirection, type OneTouchRequest } from "@shared/oneTouch";
import type { HumanFoodCandidate, HumanFoodRequirementProof } from "@shared/humanFoodValidation";
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
  /** Culinary occasion may be snack; clinical/nutrition meal-slot authority stays explicit. */
  clinicalMealSlot?: "breakfast" | "lunch" | "dinner" | "snack";
  contextCreator?: "create_a_dish" | "craving_creator";
  servings: number;
  cuisine?: string | null;
  dietaryDirection?: string | null;
  dateISO?: string;
}

export type MenuRecipeFailureCode =
  | "unauthorized_subject" | "unresolved_authority" | "invalid_request"
  | "concept_rejected" | "allergy_avoidance_rejected" | "diet_hfc_rejected"
  | "diabetes_rejected" | "glp1_rejected" | "protocol_scan_rejected" | "protocol_clinical_rejected"
  | "generation_failed" | "nutrition_evidence_invalid" | "identity_mismatch"
  | "final_validation_rejected" | "requirement_evidence_unsupported"
  | "serving_finalization_failed";

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
      // Exact requirement evidence is attached only after running the matching
      // validator against this payload. Legacy generic booleans prove nothing here.
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
  const clinicalMealSlot = input.clinicalMealSlot ?? mealType;
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
    creator: input.contextCreator ?? "my_perfect_menu" as const,
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
      input.subject.id, input.dateISO ?? context.nutrition?.date ?? new Date().toISOString().slice(0, 10), clinicalMealSlot,
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
       buildCreatorHumanFoodPrompt(input.contextCreator ?? "my_perfect_menu", context, scope.executionState),
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
    if (!protocol.passed) return fail("protocol_scan_rejected");

    // A protocol text scan alone cannot prove numeric or specialist directives
    // (for example renal sodium limits) that this one-recipe contract cannot
    // measure. Final validation must review those rather than receiving true.
    const optimizationKeys = new Set(envelope.medicalOptimization.map((condition) => condition.trim().toLowerCase()));
    const otherClinicalCondition = context.safety.healthConditions.some(
      (condition) => !optimizationKeys.has(condition.trim().toLowerCase()) &&
        !/glp.?1|semaglutide|tirzepatide|diabet/i.test(condition),
    );
    // Optimization guidance is not a hard clinical limit. It still participates
    // in the protocol prompt and output scan, but cannot require numeric proof.
    const otherEnvelopeDirective = envelope.medicalHardLimits
      .some((condition) => !/glp.?1|semaglutide|tirzepatide|diabet/i.test(condition));
    const hasOtherClinicalDirective = otherClinicalCondition || otherEnvelopeDirective;
    if (hasOtherClinicalDirective) return fail("protocol_clinical_rejected");
    const effectiveDiets = context.diet.effective.map((diet) =>
      diet.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim(),
    );
    const diabetesRequired = envelope.hasDiabetes ||
      context.safety.healthConditions.some((condition) => /diabet/i.test(condition)) ||
      effectiveDiets.includes("diabetic");
    const glp1Required = Boolean(glp1?.isActive) ||
      context.safety.healthConditions.some((condition) => /glp.?1|semaglutide|tirzepatide/i.test(condition)) ||
      effectiveDiets.includes("glp1");
    const assess = (candidate: HumanFoodCandidate): MenuRecipeFailureCode | null => {
      const diet = assessMenuDietEvidence(candidate, context.diet.effective);
      const requirements = diet.requirements;
      if (diet.status === "contradicted") return "diet_hfc_rejected";
      if (diabetesRequired) {
        if (!envelope.hasDiabetes || !envelope.diabeticGlucoseState ||
            !Number.isFinite(candidate.nutrition?.carbs)) return "unresolved_authority";
        const passed = validateDiabeticMeal({
          name: candidate.name!, description: candidate.description,
          ingredients: candidate.ingredients as MenuRecipeCard["ingredients"],
          instructions: candidate.instructions,
          macros: candidate.nutrition,
        }, { glucoseState: envelope.diabeticGlucoseState }).isValid;
        const proof: HumanFoodRequirementProof = {
          status: passed ? "pass" : "fail", source: "diabetes_authority", nutritionBasis: "model_estimate",
        };
        requirements["clinical:diabetes"] = proof;
        if (effectiveDiets.includes("diabetic")) requirements["dietary_identity:diabetic"] = proof;
        if (!passed) return "diabetes_rejected";
      }
      if (glp1Required) {
        if (!glp1?.isActive || !glp1.resolvedTargets ||
            !["calories", "protein", "fat"].every((macro) =>
              Number.isFinite(candidate.nutrition?.[macro as "calories" | "protein" | "fat"]))) {
          return "unresolved_authority";
        }
        const passed = validateMealForDiet({
          name: candidate.name!,
          ingredients: candidate.ingredients as MenuRecipeCard["ingredients"],
          instructions: candidate.instructions,
          macros: candidate.nutrition,
        }, "glp1", undefined, clinicalMealSlot === "snack", glp1.resolvedTargets).isValid;
        const proof: HumanFoodRequirementProof = {
          status: passed ? "pass" : "fail", source: "glp1_authority", nutritionBasis: "model_estimate",
        };
        requirements["clinical:glp1"] = proof;
        if (effectiveDiets.includes("glp1")) requirements["dietary_identity:glp1"] = proof;
        if (!passed) return "glp1_rejected";
      }
      candidate.evidence = { ...candidate.evidence, requirementEvidence: requirements };
      return null;
    };
    const check = (candidate: HumanFoodCandidate) =>
      validateHumanFoodCandidate(candidate, context, {
        requestedDish: concept.title,
        requestedCategory: mealType,
        executionState: scope.executionState,
        evidenceMode: "exact",
      });
    const finalValidationFailure = (result: ReturnType<typeof check>): MenuRecipeFailureCode =>
      result.findings?.some((finding) => finding.code.startsWith("requirement_evidence_required:"))
        ? "requirement_evidence_unsupported"
        : "final_validation_rejected";
    const firstFood = finalCandidate(card, draft, 1, mealType);
    const firstIssue = assess(firstFood);
    if (firstIssue) return fail(firstIssue);
    const firstValidation = check(firstFood);
    if (firstValidation.outcome !== "pass") return fail(finalValidationFailure(firstValidation));
    const formatted = scaleCard(card, input.servings);
    if (!formatted) return fail("serving_finalization_failed");
    // Repeat ALL food checks against the actual returned ingredients/instructions
    // and convert final total-recipe nutrition back to the one-serving authority.
    const finalFood = finalCandidate(formatted, draft, input.servings, mealType);
    const finalIssue = assess(finalFood);
    if (finalIssue) return fail(finalIssue);
    if (!validateHumanFoodResult(finalFood, context).valid ||
        !scanGeneratedOutput(finalFood, envelope, { generatorName: "menu-recipe-completion" }).passed ||
        !conceptIdentityMatches(concept, { ...draft, ingredients: formatted.ingredients })) {
      return fail("final_validation_rejected");
    }
    const finalValidation = check(finalFood);
    if (finalValidation.outcome !== "pass") return fail(finalValidationFailure(finalValidation));
    const current = await createHumanFoodRequestScope(scopeInput).resolve();
    const currentEnvelope = await loadUserProtocolEnvelope(input.actorUserId, isHousehold ? input.subject.id : undefined);
    const currentGlp1 = isHousehold ? null : await resolveGLP1GlobalContext(
      input.subject.id, input.dateISO ?? current.nutrition?.date ?? new Date().toISOString().slice(0, 10), clinicalMealSlot,
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