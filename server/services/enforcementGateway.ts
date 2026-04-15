/**
 * Universal Enforcement Gateway
 * Phase 1 — Food Intelligence Layer
 *
 * UNIVERSAL PROTOCOL-FIRST ENFORCEMENT MODEL
 * Dietary Identity is the outermost rule container. Every other constraint
 * (allergies, medical limits, avoidances, preferences) is nested inside it.
 *
 * Priority order (highest to lowest — higher tier wins on conflict):
 *   Tier 0: Dietary Identity — outermost container (kosher, halal, vegan,
 *           vegetarian, gluten-free, paleo, etc.). Never overridden by any
 *           inner tier. This runs BEFORE allergy checks.
 *   Tier 1: Allergy / Safety (life-threatening) — absolute nested constraint
 *   Tier 2: Medical hard limits (diabetic, GLP-1, etc.)
 *   Tier 3: Medical optimization targets
 *   Tier 4: User food avoidances (preference-level, no medical basis)
 *
 * Fail-closed contract:
 *   - Unknown provenance or certification for a strict protocol → BLOCK
 *   - Unknown means "treat as unsafe" — not "treat as safe"
 *
 * Forward-compatible: designed to accept a future protocols[] array in Phase 2.
 * Currently derives protocols from the existing dietType + allergies user model.
 */

import { loadSafetyProfile, enforceSafetyProfile, type SafetyOptions } from "./safetyProfileService";
import { scanTextForHighRiskIngredients } from "./ingredientIntelligence";
import { evaluateRelationshipRules, type RuleViolation } from "./guardrails/rules/culturalRules";
import { AVOIDANCE_EXPANSION, scanForHiddenDietaryViolations } from "./allergyGuardrails";

// ─────────────────────────────────────────────────────────────────────────────
// TIER 4 HELPER — expand user avoidance list and find violations in meal text
// ─────────────────────────────────────────────────────────────────────────────

function expandUserAvoidances(raw: string[]): { term: string; sourceCategory: string }[] {
  const out: { term: string; sourceCategory: string }[] = [];
  for (const item of raw) {
    const key = item.trim().toLowerCase();
    const expanded = AVOIDANCE_EXPANSION[key];
    if (expanded) {
      for (const t of expanded) out.push({ term: t, sourceCategory: key });
    } else {
      out.push({ term: key, sourceCategory: key });
    }
  }
  return out;
}

function findAvoidanceViolation(
  mealText: string,
  avoidIngredients: string[]
): { term: string; category: string } | null {
  const expanded = expandUserAvoidances(avoidIngredients);
  const lower = mealText.toLowerCase();
  for (const { term, sourceCategory } of expanded) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(lower)) return { term, category: sourceCategory };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type BuilderType =
  | "craving_creator"
  | "fridge_rescue"
  | "create_dish"
  | "snack_creator"
  | "create_with_chef"
  | "dessert_creator"
  | "beverage_creator"
  | "meal_planner"
  | "holiday_feast"
  | "preflight"
  | string;

export type EnforcementPhase = "pre_generation" | "post_generation";
export type EnforcementDecision = "ALLOW" | "BLOCK" | "REVIEW_REQUIRED";

export interface GeneratedMealSnapshot {
  name?: string;
  description?: string;
  ingredients?: Array<{ name?: string; item?: string } | string>;
  instructions?: string | string[];
}

export interface EnforcementRequest {
  userId: string;
  builderType: BuilderType;
  phase: EnforcementPhase;

  inputText?: string;
  generatedMeal?: GeneratedMealSnapshot;

  safetyMode?: "STRICT" | "CUSTOM_AUTHENTICATED";
  overrideToken?: string;

  /**
   * Phase 2: pass explicit protocol stack instead of deriving from dietType.
   * Currently unused — derived automatically from user profile.
   */
  protocolOverride?: string[];
}

export interface EnforcementBlock {
  tier: 0 | 1 | 2 | 3 | 4 | 5;
  tierLabel: string;
  reasonCode: string;
  protocol: string;
  blockingIngredient?: string;
  blockingRule?: string;
  message: string;
  suggestedSubstitute?: string;
  reviewOverrideAllowed: boolean;
}

export interface EnforcementResult {
  decision: EnforcementDecision;
  blocks: EnforcementBlock[];
  warnings: string[];
  auditId: string;
  phase: EnforcementPhase;
  builderType: BuilderType;

  /** Convenience: first hard block, or undefined if ALLOW */
  primaryBlock?: EnforcementBlock;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROTOCOL DETECTION
// Derives active dietary identity protocols from the user's diet type.
// "Dietary Identity" covers all named diet types — religious law, lifestyle
// protocols, and medical-lifestyle hybrids alike.
// Phase 2 replaces this with an explicit protocols[] array on the user profile.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Protocols that use the ingredient-intelligence + relationship-rules engine
 * (kosher/halal require certification-level knowledge beyond a simple term scan).
 */
const CERTIFICATION_PROTOCOLS: Record<string, string[]> = {
  kosher:        ["kosher"],
  halal:         ["halal"],
  "kosher-halal": ["kosher", "halal"],
};

/**
 * All dietary identity tags that the gateway enforces at Tier 0.
 * The hidden-term scan handles vegan, vegetarian, and others.
 */
const ALL_DIETARY_IDENTITIES = new Set([
  "kosher", "halal", "kosher-halal",
  "vegan", "vegetarian",
  "gluten-free", "paleo", "keto",
  "anti-inflammatory", "diabetic-friendly",
]);

function deriveCertificationProtocols(
  dietType: string | null | undefined,
  protocolOverride?: string[]
): string[] {
  if (protocolOverride && protocolOverride.length > 0) return protocolOverride;
  if (!dietType) return [];
  const normalized = dietType.trim().toLowerCase();
  return CERTIFICATION_PROTOCOLS[normalized] || [];
}

function dietaryIdentityIsActive(dietType: string | null | undefined): boolean {
  if (!dietType) return false;
  return ALL_DIETARY_IDENTITIES.has(dietType.trim().toLowerCase());
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXT EXTRACTION
// Pull all searchable text from a generated meal snapshot.
// ─────────────────────────────────────────────────────────────────────────────

function extractMealText(meal: GeneratedMealSnapshot): string {
  const parts: string[] = [];
  if (meal.name) parts.push(meal.name);
  if (meal.description) parts.push(meal.description);
  if (meal.ingredients) {
    for (const ing of meal.ingredients) {
      if (typeof ing === "string") parts.push(ing);
      else parts.push(ing.name || ing.item || "");
    }
  }
  if (meal.instructions) {
    if (Array.isArray(meal.instructions)) parts.push(...meal.instructions);
    else parts.push(meal.instructions);
  }
  return parts.join(" ");
}

function extractIngredientNames(meal: GeneratedMealSnapshot): string[] {
  if (!meal.ingredients) return [];
  return meal.ingredients.map(ing => {
    if (typeof ing === "string") return ing;
    return ing.name || ing.item || "";
  }).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT ID
// ─────────────────────────────────────────────────────────────────────────────

function generateAuditId(): string {
  return `gw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: runEnforcement
// Tier 0 runs first — dietary identity is the outermost rule container.
// ─────────────────────────────────────────────────────────────────────────────

export async function runEnforcement(request: EnforcementRequest): Promise<EnforcementResult> {
  const auditId = generateAuditId();
  const blocks: EnforcementBlock[] = [];
  const warnings: string[] = [];

  const textToCheck =
    request.phase === "pre_generation"
      ? request.inputText || ""
      : request.generatedMeal
      ? extractMealText(request.generatedMeal)
      : request.inputText || "";

  const ingredientNames =
    request.phase === "post_generation" && request.generatedMeal
      ? extractIngredientNames(request.generatedMeal)
      : [];

  const dishName =
    request.phase === "post_generation" && request.generatedMeal?.name
      ? request.generatedMeal.name
      : "";

  // ── Load user safety profile ──────────────────────────────────────────────
  const profile = await loadSafetyProfile(request.userId);

  if (!profile) {
    console.warn(`[EnforcementGateway] No profile found for user ${request.userId} — allowing with warning`);
    warnings.push("Safety profile could not be loaded — proceeding without restriction checks");
    return buildResult("ALLOW", blocks, warnings, auditId, request);
  }

  const dietType: string | null = (profile as any).dietType || null;
  const certificationProtocols = deriveCertificationProtocols(
    dietType,
    request.protocolOverride
  );

  // ══════════════════════════════════════════════════════════════════════════
  // TIER 0: DIETARY IDENTITY — outermost rule container
  // Runs before allergy and every other check. Dietary identity is never
  // overridden by medical logic, preferences, or any inner tier.
  // ══════════════════════════════════════════════════════════════════════════

  if (dietaryIdentityIsActive(dietType) || (request.protocolOverride && request.protocolOverride.length > 0)) {

    // ── 0a. Certification protocols (kosher / halal) ───────────────────────
    // These require provenance + combination-level knowledge beyond term scanning.
    if (certificationProtocols.length > 0) {

      // Ingredient Intelligence — fail-closed for unknown provenance
      const intelligenceFindings = scanTextForHighRiskIngredients(textToCheck, certificationProtocols);

      for (const finding of intelligenceFindings) {
        const unsafeProtocols = certificationProtocols.filter(
          p => finding.riskByProtocol[p] === "unsafe"
        );
        const unknownFailClosedProtocols = certificationProtocols.filter(
          p =>
            finding.riskByProtocol[p] === "unknown" &&
            finding.intelligence?.failClosedProtocols.includes(p)
        );

        if (unsafeProtocols.length > 0) {
          blocks.push({
            tier: 0,
            tierLabel: "Dietary Identity",
            reasonCode: `INGREDIENT_UNSAFE_${unsafeProtocols[0].toUpperCase()}`,
            protocol: unsafeProtocols[0],
            blockingIngredient: finding.ingredientName,
            message: finding.reason,
            suggestedSubstitute: "Use a certified alternative appropriate for your protocol.",
            reviewOverrideAllowed: false,
          });
        } else if (unknownFailClosedProtocols.length > 0) {
          blocks.push({
            tier: 0,
            tierLabel: "Dietary Identity",
            reasonCode: `INGREDIENT_UNKNOWN_FAIL_CLOSED`,
            protocol: unknownFailClosedProtocols[0],
            blockingIngredient: finding.ingredientName,
            message: finding.reason,
            suggestedSubstitute: "Use a certified kosher/halal alternative or a plant-based substitute.",
            reviewOverrideAllowed: false,
          });
        }
      }

      // Short-circuit on hard block
      const certHardBlock = blocks.find(b => b.tier === 0 && !b.reviewOverrideAllowed);
      if (certHardBlock) {
        logGatewayBlock(request, certHardBlock, auditId);
        return buildResult("BLOCK", blocks, warnings, auditId, request);
      }

      // Relationship Rules — combination conflicts, dish categories
      const ruleViolations = evaluateRelationshipRules(
        textToCheck,
        ingredientNames,
        dishName,
        certificationProtocols
      );

      for (const violation of ruleViolations) {
        const { rule } = violation;
        const primaryProtocol = rule.protocols.find(p => certificationProtocols.includes(p)) || rule.protocols[0];
        blocks.push({
          tier: 0,
          tierLabel: "Dietary Identity",
          reasonCode: rule.effect.reasonCode,
          protocol: primaryProtocol,
          blockingRule: rule.id,
          blockingIngredient: violation.matchedOn || undefined,
          message: rule.effect.message,
          suggestedSubstitute: rule.effect.suggestedSubstitute,
          reviewOverrideAllowed: rule.effect.reviewOverrideAllowed,
        });
      }

      const certHardBlocks = blocks.filter(b => b.tier === 0 && !b.reviewOverrideAllowed);
      const certSoftBlocks  = blocks.filter(b => b.tier === 0 && b.reviewOverrideAllowed);

      if (certHardBlocks.length > 0) {
        logGatewayBlock(request, certHardBlocks[0], auditId);
        return buildResult("BLOCK", blocks, warnings, auditId, request);
      }
      if (certSoftBlocks.length > 0) {
        logGatewayBlock(request, certSoftBlocks[0], auditId);
        return buildResult("REVIEW_REQUIRED", blocks, warnings, auditId, request);
      }
    }

    // ── 0b. Hidden-term scan for lifestyle protocols ───────────────────────
    // Vegan, vegetarian, and other lifestyle protocols use the ingredient-level
    // hidden-term scanner built in allergyGuardrails.
    if (dietType && request.phase === "post_generation" && request.generatedMeal) {
      const mealText = extractMealText(request.generatedMeal);
      const hiddenViolations = scanForHiddenDietaryViolations(mealText, [dietType]);

      for (const violation of hiddenViolations) {
        const block: EnforcementBlock = {
          tier: 0,
          tierLabel: "Dietary Identity",
          reasonCode: `HIDDEN_${violation.category.toUpperCase()}_VIOLATION`,
          protocol: violation.category,
          blockingIngredient: violation.term,
          message: `${violation.reason} This violates your ${dietType} dietary identity.`,
          suggestedSubstitute: `Use a ${dietType}-compliant alternative.`,
          reviewOverrideAllowed: false,
        };
        blocks.push(block);
        logGatewayBlock(request, block, auditId);
        return buildResult("BLOCK", blocks, warnings, auditId, request);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TIER 1: ALLERGY / SAFETY — life-threatening, absolute nested constraint
  // ══════════════════════════════════════════════════════════════════════════

  const safetyOptions: SafetyOptions = {
    safetyMode: request.safetyMode || "STRICT",
    overrideToken: request.safetyMode === "CUSTOM_AUTHENTICATED" ? request.overrideToken : undefined,
  };

  const safetyAssessment = await enforceSafetyProfile(
    request.userId,
    textToCheck,
    `${request.builderType}-${request.phase}`,
    safetyOptions
  );

  if (safetyAssessment.result === "BLOCKED") {
    blocks.push({
      tier: 1,
      tierLabel: "Allergy / Safety",
      reasonCode: "ALLERGY_BLOCK",
      protocol: "allergy",
      blockingIngredient: safetyAssessment.blockedTerms[0],
      message: safetyAssessment.message,
      suggestedSubstitute: safetyAssessment.suggestion,
      reviewOverrideAllowed: false,
    });

    logGatewayBlock(request, blocks[blocks.length - 1], auditId);
    return buildResult("BLOCK", blocks, warnings, auditId, request);
  }

  if (safetyAssessment.result === "AMBIGUOUS") {
    blocks.push({
      tier: 1,
      tierLabel: "Allergy / Safety",
      reasonCode: "ALLERGY_AMBIGUOUS",
      protocol: "allergy",
      blockingIngredient: safetyAssessment.ambiguousTerms[0],
      message: safetyAssessment.message,
      suggestedSubstitute: safetyAssessment.suggestion,
      reviewOverrideAllowed: true,
    });

    logGatewayBlock(request, blocks[blocks.length - 1], auditId);
    return buildResult("REVIEW_REQUIRED", blocks, warnings, auditId, request);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TIER 2–3: Medical hard limits and optimization targets
  // Handled by DietGuard / StarchGuard in the UI layer and the guardrail
  // prompt injection in the generation pipeline.
  // ══════════════════════════════════════════════════════════════════════════

  if (safetyAssessment.result === "DIET_ADAPT") {
    warnings.push(safetyAssessment.message || "Dietary adaptation applied");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TIER 4: USER FOOD AVOIDANCES — preference-level (no medical basis)
  // Safety net: AI prompt already instructs the model to skip avoided
  // ingredients, but this catches leaks before they reach the user.
  // ══════════════════════════════════════════════════════════════════════════

  if (request.phase === "post_generation" && request.generatedMeal) {
    const userAvoidIngredients: string[] = (profile as any).avoidIngredients || [];
    if (userAvoidIngredients.length > 0) {
      const mealText = extractMealText(request.generatedMeal);
      const violation = findAvoidanceViolation(mealText, userAvoidIngredients);
      if (violation) {
        const block: EnforcementBlock = {
          tier: 4,
          tierLabel: "User Food Avoidance",
          reasonCode: "AVOID_INGREDIENT_FOUND",
          protocol: "user_avoidance",
          blockingIngredient: violation.term,
          message: `This meal contains "${violation.term}" which you've marked as a food to avoid (${violation.category}). Regenerating with a compliant alternative.`,
          suggestedSubstitute: `A meal will be created without ${violation.category}.`,
          reviewOverrideAllowed: false,
        };
        blocks.push(block);
        logGatewayBlock(request, block, auditId);
        return buildResult("BLOCK", blocks, warnings, auditId, request);
      }
    }
  }

  // ── ALLOW ─────────────────────────────────────────────────────────────────
  console.log(
    `✅ [EnforcementGateway] ALLOW — user=${request.userId} builder=${request.builderType} phase=${request.phase} auditId=${auditId}`
  );

  return buildResult("ALLOW", blocks, warnings, auditId, request);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function buildResult(
  decision: EnforcementDecision,
  blocks: EnforcementBlock[],
  warnings: string[],
  auditId: string,
  request: EnforcementRequest
): EnforcementResult {
  const primaryBlock = blocks.find(b => !b.reviewOverrideAllowed) || blocks[0];
  return {
    decision,
    blocks,
    warnings,
    auditId,
    phase: request.phase,
    builderType: request.builderType,
    primaryBlock: decision !== "ALLOW" ? primaryBlock : undefined,
  };
}

function logGatewayBlock(
  request: EnforcementRequest,
  block: EnforcementBlock,
  auditId: string
): void {
  console.log(
    `🚫 [EnforcementGateway] BLOCK — ` +
    `user=${request.userId} ` +
    `builder=${request.builderType} ` +
    `phase=${request.phase} ` +
    `tier=${block.tier}(${block.tierLabel}) ` +
    `code=${block.reasonCode} ` +
    `protocol=${block.protocol} ` +
    `ingredient="${block.blockingIngredient || ""}" ` +
    `rule="${block.blockingRule || ""}" ` +
    `auditId=${auditId}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER: converts EnforcementResult back to the shape existing routes expect.
// Makes migration of call sites minimal — routes replace enforceSafetyProfile
// with runEnforcement + toRouteResponse(), keeping their existing if-blocks.
// ─────────────────────────────────────────────────────────────────────────────

export interface RouteEnforcementResponse {
  blocked: boolean;
  reviewRequired: boolean;
  errorPayload?: {
    success: false;
    error: string;
    safetyBlocked?: boolean;
    safetyAmbiguous?: boolean;
    blockedTerms?: string[];
    ambiguousTerms?: string[];
    suggestion?: string;
    reasonCode?: string;
    protocol?: string;
    blockingIngredient?: string;
    blockingRule?: string;
    reviewOverrideAllowed?: boolean;
  };
}

export function toRouteResponse(result: EnforcementResult): RouteEnforcementResponse {
  if (result.decision === "ALLOW") {
    return { blocked: false, reviewRequired: false };
  }

  const pb = result.primaryBlock;

  if (result.decision === "BLOCK") {
    return {
      blocked: true,
      reviewRequired: false,
      errorPayload: {
        success: false,
        error: pb?.message || "This request was blocked by the enforcement gateway.",
        safetyBlocked: true,
        blockedTerms: pb?.blockingIngredient ? [pb.blockingIngredient] : [],
        suggestion: pb?.suggestedSubstitute,
        reasonCode: pb?.reasonCode,
        protocol: pb?.protocol,
        blockingIngredient: pb?.blockingIngredient,
        blockingRule: pb?.blockingRule,
        reviewOverrideAllowed: false,
      },
    };
  }

  return {
    blocked: false,
    reviewRequired: true,
    errorPayload: {
      success: false,
      error: pb?.message || "This request requires review before proceeding.",
      safetyAmbiguous: true,
      ambiguousTerms: pb?.blockingIngredient ? [pb.blockingIngredient] : [],
      suggestion: pb?.suggestedSubstitute,
      reasonCode: pb?.reasonCode,
      protocol: pb?.protocol,
      blockingIngredient: pb?.blockingIngredient,
      blockingRule: pb?.blockingRule,
      reviewOverrideAllowed: true,
    },
  };
}
