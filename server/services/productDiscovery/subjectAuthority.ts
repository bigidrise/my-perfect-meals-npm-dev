import { createHash } from "node:crypto";
import type { HumanFoodContext } from "../../../shared/humanFoodContext";
import type { UserProtocolEnvelope } from "../protocolEnvelope";
import { buildAnalysisProfile } from "../ingredientScanService";

export interface ProductSubjectRequest {
  actorUserId: string;
  subjectUserId: string;
  subjectKind: "account" | "household";
  dateISO: string;
}

export interface ProductSubjectSnapshot {
  actorUserId: string;
  subjectId: string;
  subjectKind: ProductSubjectRequest["subjectKind"];
  dateISO: string;
  status: "resolved" | "unresolved";
  issues: string[];
  fingerprint: string;
  dietaryIdentity: string[];
  allergies: string[];
  explicitAvoidances: string[];
  dislikes: string[];
  preferences: string[];
  /** Product Scan's existing subject-owned profile factor labels, for explanation only. */
  profileFactors: string[];
  medicalHardLimitNames: string[];
  medicalOptimizationNames: string[];
  glp1Active: boolean;
  alphaGalActive: boolean;
  pregnancyActive: boolean;
  providerInterventionKeys: string[];
  /** Daily/meal planning context is not an intrinsic package prohibition. */
  dailyNutritionAvailable: boolean;
  clinicalDirectiveAuthority: "shadow_only_not_effective_for_food";
}

export interface ProductSubjectSources {
  resolveFoodContext(request: ProductSubjectRequest): Promise<HumanFoodContext>;
  loadEnvelope(request: ProductSubjectRequest): Promise<UserProtocolEnvelope | null>;
  /** Needed because the legacy self path implicitly overlays an active household member. */
  activeHouseholdProfileId(subjectUserId: string): Promise<string | null>;
}

/**
 * Deliberately inert until called; no live route imports this module.
 * Both reads use existing authorization/profile resolvers. Do not use the
 * single-ID Grocery Coach context as proof of who is being fed.
 */
export const existingProductSubjectSources: ProductSubjectSources = {
  async resolveFoodContext(request) {
    const { resolveHumanFoodContext } = await import("../humanFoodContext/resolveHumanFoodContext");
    return resolveHumanFoodContext({
      actorUserId: request.actorUserId,
      subjectUserId: request.subjectUserId,
      creator: "grocery_coach",
      dateISO: request.dateISO,
      // Intentionally no dietOverride: a search adaptation cannot remove
      // the stored dietary identity of the person being fed.
    });
  },
  async loadEnvelope(request) {
    const { loadUserProtocolEnvelope } = await import("../protocolEnvelope");
    return request.subjectKind === "household"
      ? loadUserProtocolEnvelope(request.actorUserId, request.subjectUserId)
      : loadUserProtocolEnvelope(request.subjectUserId);
  },
  async activeHouseholdProfileId(subjectUserId) {
    const { db } = await import("../../db");
    const { users } = await import("../../../shared/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select({ active: users.activeHouseholdProfileId })
      .from(users).where(eq(users.id, subjectUserId)).limit(1);
    return row?.active ?? null;
  },
};

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const normalize = (values: readonly string[]) =>
    [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))].sort();
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

export async function resolveProductSubjectAuthority(
  request: ProductSubjectRequest,
  sources: ProductSubjectSources = existingProductSubjectSources,
): Promise<ProductSubjectSnapshot> {
  if (!request.actorUserId || !request.subjectUserId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(request.dateISO) ||
      (request.subjectKind === "household" && request.actorUserId === request.subjectUserId)) {
    throw new Error("Exact actor, subject, kind, and local date are required.");
  }
  // Do not catch authorization failures and return an unrestricted snapshot.
  const food = await sources.resolveFoodContext(request);
  if (food.actorUserId !== request.actorUserId ||
      food.subjectUserId !== request.subjectUserId) {
    throw new Error("Food context returned a different actor or nutrition subject.");
  }
  const [envelope, activeHousehold] = await Promise.all([
    sources.loadEnvelope(request),
    request.subjectKind === "account"
      ? sources.activeHouseholdProfileId(request.subjectUserId) : Promise.resolve(null),
  ]);
  if (!envelope) throw new Error("Subject protocol envelope is unavailable.");
  const expectedEnvelopeOwner = request.subjectKind === "household"
    ? request.actorUserId : request.subjectUserId;
  if (envelope.userId !== expectedEnvelopeOwner) {
    throw new Error("Subject protocol envelope has a different owner.");
  }
  const issues: string[] = [];
  if (activeHousehold) issues.push("implicit_household_selection_requires_explicit_subject");
  if (food.status === "blocked" || food.status === "review_required") {
    issues.push(`food_context_${food.status}`);
  }
  if (food.diet.source === "request" ||
      !sameSet(food.diet.stored, envelope.dietaryIdentity) ||
      !sameSet(food.safety.allergies, envelope.allergies)) {
    issues.push("subject_profile_sources_disagree");
  }
  if (food.gaps.some((gap) =>
    gap === "daily_nutrition_state" || gap.startsWith("diabetes."))) {
    issues.push("authoritative_nutrition_or_glucose_unavailable");
  }
  const profileFactors = buildAnalysisProfile({
    ...envelope,
    conditionGuidanceBlocks: envelope.conditionGuidanceBlocks ?? [],
  });
  const fingerprint = createHash("sha256").update(JSON.stringify({
    subjectId: request.subjectUserId,
    kind: request.subjectKind,
    dateISO: request.dateISO,
    foodFingerprint: food.internalFingerprint,
    dietaryIdentity: envelope.dietaryIdentity,
    allergies: envelope.allergies,
    explicitAvoidances: food.safety.avoidedFoods,
    dislikes: food.safety.dislikedFoods,
    hardLimitNames: envelope.medicalHardLimits,
    optimizationNames: envelope.medicalOptimization,
    providerInterventions: envelope.providerInterventions,
    glp1: food.safety.glp1MealAuthorityActive,
    pregnancy: envelope.pregnancySupportContext,
    alphaGal: envelope.alphaGalContext,
    profileFactors,
  })).digest("hex");
  return {
    actorUserId: request.actorUserId,
    subjectId: request.subjectUserId,
    subjectKind: request.subjectKind,
    dateISO: request.dateISO,
    status: issues.length ? "unresolved" : "resolved",
    issues,
    fingerprint,
    dietaryIdentity: [...food.diet.stored],
    allergies: [...food.safety.allergies],
    explicitAvoidances: [...food.safety.avoidedFoods],
    dislikes: [...food.safety.dislikedFoods],
    preferences: [...(envelope.preferences ?? [])],
    profileFactors,
    medicalHardLimitNames: [...envelope.medicalHardLimits],
    medicalOptimizationNames: [...envelope.medicalOptimization],
    glp1Active: food.safety.glp1MealAuthorityActive === true,
    alphaGalActive: envelope.alphaGalContext?.active === true,
    pregnancyActive: envelope.pregnancySupportContext?.active === true,
    providerInterventionKeys: (envelope.providerInterventions ?? []).map((item) => item.conditionKey),
    dailyNutritionAvailable: food.nutrition !== null,
    clinicalDirectiveAuthority: "shadow_only_not_effective_for_food",
  };
}