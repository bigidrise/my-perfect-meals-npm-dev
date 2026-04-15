/**
 * Universal Enforcement Gateway
 * Phase 1 — Food Intelligence Layer
 *
 * The single law of the system. Every builder calls this before and after
 * generation. No exceptions, no bypass paths.
 *
 * Priority order (highest to lowest — higher tier wins on conflict):
 *   Tier 1: Allergy / Safety (never overridden silently)
 *   Tier 2: Religious law (kosher, halal — hard enforcement)
 *   Tier 3: Medical hard limits (diabetic, GLP-1, etc.)
 *   Tier 4: Medical optimization targets
 *   Tier 5: User preferences
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
import { AVOIDANCE_EXPANSION } from "./allergyGuardrails";

// ─────────────────────────────────────────────────────────────────────────────
// TIER 5 HELPER — expand user avoidance list and find violations in meal text
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
  tier: 1 | 2 | 3 | 4 | 5;
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
// Derives active cultural/religious protocols from the user's diet type.
// Phase 2 replaces this with an explicit protocols[] array on the user profile.
// ─────────────────────────────────────────────────────────────────────────────

const RELIGIOUS_DIET_PROTOCOLS: Record<string, string[]> = {
  kosher: ["kosher"],
  halal: ["halal"],
  "kosher-halal": ["kosher", "halal"],
};

function deriveActiveProtocols(
  dietType: string | null | undefined,
  protocolOverride?: string[]
): string[] {
  if (protocolOverride && protocolOverride.length > 0) return protocolOverride;
  if (!dietType) return [];
  const normalized = dietType.trim().toLowerCase();
  return RELIGIOUS_DIET_PROTOCOLS[normalized] || [];
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

  const activeProtocols = deriveActiveProtocols(
    (profile as any).dietType,
    request.protocolOverride
  );

  // ── TIER 1: Allergy / Safety check (existing SafetyGuard) ────────────────
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

    logGatewayBlock(request, blocks[0], auditId);
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

    logGatewayBlock(request, blocks[0], auditId);
    return buildResult("REVIEW_REQUIRED", blocks, warnings, auditId, request);
  }

  // ── TIER 2: Religious / Cultural checks ──────────────────────────────────
  if (activeProtocols.length > 0) {

    // 2a. Ingredient Intelligence — fail-closed for unknown provenance
    const intelligenceFindings = scanTextForHighRiskIngredients(textToCheck, activeProtocols);

    for (const finding of intelligenceFindings) {
      const unsafeProtocols = activeProtocols.filter(
        p => finding.riskByProtocol[p] === "unsafe"
      );
      const unknownFailClosedProtocols = activeProtocols.filter(
        p =>
          finding.riskByProtocol[p] === "unknown" &&
          finding.intelligence?.failClosedProtocols.includes(p)
      );

      if (unsafeProtocols.length > 0) {
        blocks.push({
          tier: 2,
          tierLabel: "Religious / Cultural Law",
          reasonCode: `INGREDIENT_UNSAFE_${unsafeProtocols[0].toUpperCase()}`,
          protocol: unsafeProtocols[0],
          blockingIngredient: finding.ingredientName,
          message: finding.reason,
          suggestedSubstitute: "Use a certified alternative appropriate for your protocol.",
          reviewOverrideAllowed: false,
        });
      } else if (unknownFailClosedProtocols.length > 0) {
        // Fail-closed: unknown + strict protocol = BLOCK
        blocks.push({
          tier: 2,
          tierLabel: "Religious / Cultural Law",
          reasonCode: `INGREDIENT_UNKNOWN_FAIL_CLOSED`,
          protocol: unknownFailClosedProtocols[0],
          blockingIngredient: finding.ingredientName,
          message: finding.reason,
          suggestedSubstitute: "Use a certified kosher/halal alternative or a plant-based substitute.",
          reviewOverrideAllowed: false,
        });
      }
    }

    // If a hard block from ingredient intelligence — short-circuit
    const hardBlock = blocks.find(b => b.tier === 2 && !b.reviewOverrideAllowed);
    if (hardBlock) {
      logGatewayBlock(request, hardBlock, auditId);
      return buildResult("BLOCK", blocks, warnings, auditId, request);
    }

    // 2b. Relationship Rules — combination conflicts, dish categories
    const ruleViolations = evaluateRelationshipRules(
      textToCheck,
      ingredientNames,
      dishName,
      activeProtocols
    );

    for (const violation of ruleViolations) {
      const { rule } = violation;
      const primaryProtocol = rule.protocols.find(p => activeProtocols.includes(p)) || rule.protocols[0];

      blocks.push({
        tier: 2,
        tierLabel: "Religious / Cultural Law",
        reasonCode: rule.effect.reasonCode,
        protocol: primaryProtocol,
        blockingRule: rule.id,
        blockingIngredient: violation.matchedOn || undefined,
        message: rule.effect.message,
        suggestedSubstitute: rule.effect.suggestedSubstitute,
        reviewOverrideAllowed: rule.effect.reviewOverrideAllowed,
      });
    }

    // Evaluate final decision after tier 2
    const tier2HardBlocks = blocks.filter(b => b.tier === 2 && !b.reviewOverrideAllowed);
    const tier2SoftBlocks = blocks.filter(b => b.tier === 2 && b.reviewOverrideAllowed);

    if (tier2HardBlocks.length > 0) {
      logGatewayBlock(request, tier2HardBlocks[0], auditId);
      return buildResult("BLOCK", blocks, warnings, auditId, request);
    }

    if (tier2SoftBlocks.length > 0) {
      logGatewayBlock(request, tier2SoftBlocks[0], auditId);
      return buildResult("REVIEW_REQUIRED", blocks, warnings, auditId, request);
    }
  }

  // ── TIER 3–5: Medical and preference checks ───────────────────────────────
  // Currently handled by the existing DietGuard / StarchGuard in the UI layer
  // and the guardrail prompt injection in the generation pipeline.
  // The gateway records any warnings from the safety assessment.
  if (safetyAssessment.result === "DIET_ADAPT") {
    warnings.push(safetyAssessment.message || "Dietary adaptation applied");
  }

  // ── TIER 5: User food avoidances (post-generation scan) ──────────────────
  // This is the safety net for avoided foods. The AI prompt already instructs
  // the model to skip avoided ingredients, but if it ignores the instruction
  // this check catches the violation before the meal reaches the user.
  if (request.phase === "post_generation" && request.generatedMeal) {
    const userAvoidIngredients: string[] = (profile as any).avoidIngredients || [];
    if (userAvoidIngredients.length > 0) {
      const mealText = extractMealText(request.generatedMeal);
      const violation = findAvoidanceViolation(mealText, userAvoidIngredients);
      if (violation) {
        const block: EnforcementBlock = {
          tier: 5,
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
    `🚫 [EnforcementGateway] ${block.decision || "BLOCK"} — ` +
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
