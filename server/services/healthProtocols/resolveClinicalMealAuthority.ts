import type { ClinicalDirectiveRecord, ClinicalReviewDecision, ExactFoodDirective } from
  "../../../shared/clinicalMealAuthority";
import { exactFoodDirectiveSchema } from "../../../shared/clinicalMealAuthority";
import type { FoodBuilderStrategy, HealthProtocol, HealthProtocolRecord } from
  "../../../shared/healthProtocolState";
import { resolveHealthProtocolState } from "./resolveHealthProtocolState";

export interface CurrentFoodRule {
  id: string;
  sourceId: string;
  protocol: HealthProtocol;
  rule: ExactFoodDirective;
  authority: "reviewed_subject" | "verified_provider";
}

export interface ClinicalMealAuthority {
  healthHistory: string[];
  nutritionGuidance: { protocol: HealthProtocol; sourceId: string }[];
  hardFoodRestrictions: CurrentFoodRule[];
  verifiedProviderDirectives: CurrentFoodRule[];
  builderStrategy: HealthProtocol | null;
  /** Shadow-only candidate. It has NOT passed legacy-source reconciliation. */
  candidateForFood: {
    guidance: ClinicalMealAuthority["nutritionGuidance"];
    hardRestrictions: ClinicalMealAuthority["hardFoodRestrictions"];
  } | null;
  /** Never a food-read authorization until a separate completeness gate exists. */
  effectiveForFood: null;
  activationGate: "shadow_only_reconciliation_required";
  needsReview: { sourceId: string; directiveId: string | null; reason: string }[];
}

/**
 * Pure, shadow-only contract. History is never converted to a rule. A current
 * source needs an explicit decision, and a hard rule needs a typed directive.
 * No caller may use this to bypass the legacy safety path before cutover.
 */
export function resolveClinicalMealAuthority(input: {
  subjectUserId: string;
  history: readonly string[];
  builder: FoodBuilderStrategy;
  sources: readonly HealthProtocolRecord[];
  directives: readonly ClinicalDirectiveRecord[];
  decisions: readonly ClinicalReviewDecision[];
  relationshipStatus: Readonly<Record<string, "active" | "ended">>;
  now: Date;
}): ClinicalMealAuthority {
  const state = resolveHealthProtocolState({
    builder: input.builder, records: input.sources,
    relationshipStatus: input.relationshipStatus,
  });
  const needsReview: ClinicalMealAuthority["needsReview"] = state.needsReview.map((item) => ({
    sourceId: item.sourceRecordId, directiveId: null, reason: item.reason,
  }));
  const bySource = new Map(input.sources.map((source) => [source.id, source]));
  const byDirective = new Map<string, ClinicalDirectiveRecord>();
  for (const directive of input.directives) {
    if (byDirective.has(directive.id)) throw new Error("Duplicate clinical directive ID.");
    byDirective.set(directive.id, directive);
    const source = bySource.get(directive.sourceId);
    if (!source || directive.subjectUserId !== input.subjectUserId ||
        source.protocol !== directive.protocol) throw new Error("Clinical directive source mismatch.");
    exactFoodDirectiveSchema.parse(directive.rule);
  }
  const latest = new Map<string, ClinicalReviewDecision>();
  for (const decision of input.decisions) {
    const source = bySource.get(decision.sourceId);
    const directive = decision.directiveId ? byDirective.get(decision.directiveId) : null;
    if (!source || decision.subjectUserId !== input.subjectUserId ||
        (decision.directiveId && (!directive || directive.sourceId !== source.id))) {
      throw new Error("Clinical review decision identity mismatch.");
    }
    if (!Number.isFinite(decision.decidedAt.getTime())) throw new Error("Invalid clinical decision time.");
    const key = `${source.id}:${decision.directiveId ?? "source"}`;
    const previous = latest.get(key);
    if (!previous ||
        decision.decidedAt.getTime() > previous.decidedAt.getTime() ||
        (decision.decidedAt.getTime() === previous.decidedAt.getTime() &&
          decision.id.localeCompare(previous.id) > 0)) latest.set(key, decision);
  }
  const nutritionGuidance: ClinicalMealAuthority["nutritionGuidance"] = [];
  const hardFoodRestrictions: CurrentFoodRule[] = [];
  const verifiedProviderDirectives: CurrentFoodRule[] = [];

  for (const source of input.sources) {
    if (source.status === "inactive" || source.status === "historical") continue;
    if (!state.activeSourceIds[source.protocol]?.includes(source.id)) continue;
    const sourceDecision = latest.get(`${source.id}:source`);
    if (sourceDecision && sourceDecision.disposition !== "unresolved" &&
        sourceDecision.actorUserId !== (source.source === "provider"
          ? source.ownerUserId : input.subjectUserId)) {
      needsReview.push({ sourceId: source.id, directiveId: null, reason: "review_actor_unverified" });
      continue;
    }
    if (sourceDecision?.disposition === "current_guidance" &&
        source.source !== "provider" && source.source !== "medication") {
      nutritionGuidance.push({ protocol: source.protocol, sourceId: source.id });
    } else if (source.source !== "provider" &&
        !input.directives.some((directive) => directive.sourceId === source.id) &&
        sourceDecision?.disposition !== "history_only" &&
        sourceDecision?.disposition !== "historical") {
      needsReview.push({ sourceId: source.id, directiveId: null, reason: "source_authority_unconfirmed" });
    }

    const sourceDirectives = input.directives.filter((item) => item.sourceId === source.id);
    if (source.source === "provider" && sourceDirectives.length === 0) {
      needsReview.push({ sourceId: source.id, directiveId: null, reason: "provider_rule_missing" });
    }
    for (const directive of sourceDirectives) {
      const decision = latest.get(`${source.id}:${directive.id}`);
      if (directive.supersedesId) {
        const prior = byDirective.get(directive.supersedesId);
        if (!prior || prior.sourceId !== source.id) {
          throw new Error("Superseded clinical directive source mismatch.");
        }
        const previousDecision = latest.get(`${source.id}:${prior.id}`);
        if (previousDecision &&
            !["historical", "history_only"].includes(previousDecision.disposition)) {
          needsReview.push({ sourceId: source.id, directiveId: directive.id, reason: "prior_directive_still_current" });
          continue;
        }
      }
      if (!decision || decision.disposition === "unresolved") {
        needsReview.push({ sourceId: source.id, directiveId: directive.id, reason: "directive_unreviewed" });
        continue;
      }
      const expectedActor = source.source === "provider"
        ? source.ownerUserId : input.subjectUserId;
      if (!expectedActor || decision.actorUserId !== expectedActor) {
        needsReview.push({ sourceId: source.id, directiveId: directive.id, reason: "review_actor_unverified" });
        continue;
      }
      if (decision.disposition === "historical" || decision.disposition === "history_only") {
        continue;
      }
      if (decision.disposition === "current_guidance") {
        if (source.source !== "provider" && source.source !== "medication") {
          nutritionGuidance.push({ protocol: source.protocol, sourceId: source.id });
        } else {
          needsReview.push({ sourceId: source.id, directiveId: directive.id, reason: "provider_rule_unresolved" });
        }
        continue;
      }
      if (sourceDecision &&
          ["history_only", "historical", "unresolved"].includes(sourceDecision.disposition)) {
        needsReview.push({ sourceId: source.id, directiveId: directive.id, reason: "source_review_conflict" });
        continue;
      }
      if (!Number.isFinite(directive.effectiveAt.getTime()) ||
          (directive.expiresAt && !Number.isFinite(directive.expiresAt.getTime())) ||
          directive.effectiveAt > input.now ||
          (directive.expiresAt && directive.expiresAt <= input.now)) {
        needsReview.push({ sourceId: source.id, directiveId: directive.id, reason: "directive_not_current" });
        continue;
      }
      if (source.source === "provider" &&
          (decision.disposition !== "verified_provider_directive" ||
            !source.ownerUserId || decision.actorUserId !== source.ownerUserId ||
            !source.relationshipId || input.relationshipStatus[source.relationshipId] !== "active")) {
        needsReview.push({ sourceId: source.id, directiveId: directive.id, reason: "provider_owner_required" });
        continue;
      }
      if (source.source !== "provider" &&
          (decision.disposition !== "current_hard_restriction" ||
            source.source === "medication" || source.source === "system_recommendation" ||
            decision.actorUserId !== input.subjectUserId)) {
        needsReview.push({ sourceId: source.id, directiveId: directive.id, reason: "hard_rule_authority_unconfirmed" });
        continue;
      }
      const rule: CurrentFoodRule = {
        id: directive.id, sourceId: source.id, protocol: source.protocol, rule: directive.rule,
        authority: source.source === "provider" ? "verified_provider" : "reviewed_subject",
      };
      hardFoodRestrictions.push(rule);
      if (source.source === "provider") verifiedProviderDirectives.push(rule);
    }
    if (source.source === "provider" &&
        !verifiedProviderDirectives.some((item) => item.sourceId === source.id)) {
      needsReview.push({ sourceId: source.id, directiveId: null, reason: "provider_rule_not_current" });
    } else if (source.source !== "provider" && sourceDirectives.length > 0 &&
        !hardFoodRestrictions.some((item) => item.sourceId === source.id) &&
        !nutritionGuidance.some((item) => item.sourceId === source.id) &&
        sourceDecision?.disposition !== "history_only" &&
        sourceDecision?.disposition !== "historical") {
      needsReview.push({ sourceId: source.id, directiveId: null, reason: "source_authority_unconfirmed" });
    }
  }
  const uniqueGuidance = [...new Map(nutritionGuidance.map((item) =>
    [`${item.protocol}:${item.sourceId}`, item])).values()];
  return {
    healthHistory: [...new Set(input.history.map((item) => item.trim()).filter(Boolean))],
    nutritionGuidance: uniqueGuidance,
    hardFoodRestrictions,
    verifiedProviderDirectives,
    builderStrategy: state.builderStrategy,
    candidateForFood: needsReview.length ? null : {
      guidance: uniqueGuidance, hardRestrictions: hardFoodRestrictions,
    },
    effectiveForFood: null,
    activationGate: "shadow_only_reconciliation_required",
    needsReview,
  };
}