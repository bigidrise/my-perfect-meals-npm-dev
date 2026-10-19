import {
  IntentAssessment, SafetyAuthority,
  type ConversationContext, type PolicyDecision,
} from "../../../shared/pairingAdvisor/contracts";

/** Pure proposal for the runtime boundary; not mounted or read from process.env. */
export function developmentAdvisorAllowed(env: { nodeEnv?: string; deploymentMarker?: string }): boolean {
  return env.nodeEnv === "development" && !env.deploymentMarker;
}

export type PolicyInput = {
  enabled: boolean;
  access: "authorized" | "unauthenticated" | "forbidden";
  accountId: string;
  authority: unknown;
  assessment: unknown;
  context: ConversationContext;
};

export function decideAdvisorPolicy(input: PolicyInput): PolicyDecision {
  if (!input.enabled) return { kind: "disabled" };
  if (input.access === "unauthenticated" || !input.accountId) return { kind: "unauthorized" };
  if (input.access === "forbidden") return { kind: "forbidden" };
  const result = SafetyAuthority.safeParse(input.authority);
  if (!result.success || result.data.status === "unavailable") {
    return { kind: "unavailable", reason: "SAFETY_AUTHORITY_UNAVAILABLE" };
  }
  if (result.data.status === "unauthorized") return { kind: "forbidden" };
  const authority = result.data;
  if (authority.actorId !== input.accountId || authority.subjectId !== input.accountId) {
    return { kind: "unavailable", reason: "SAFETY_AUTHORITY_UNAVAILABLE" };
  }
  const intent = IntentAssessment.safeParse(input.assessment);
  if (!intent.success || intent.data.intent === "unclear" || intent.data.contradictory) {
    return { kind: "clarification", reason: "INTENT_UNCLEAR" };
  }
  const assessment = intent.data;
  if (assessment.subject !== "account_owner") {
    return { kind: "clarification", reason: "SUBJECT_UNSUPPORTED" };
  }
  if (assessment.referent === "missing") {
    return { kind: "clarification", reason: "REFERENCE_UNRESOLVED" };
  }
  if (assessment.intent === "education") return { kind: "generate_education" };
  const allowEducation = assessment.intent === "mixed";
  if (authority.requiresVerifiedIngredients) {
    return { kind: "restricted", reason: "INGREDIENT_EVIDENCE_REQUIRED", allowEducation };
  }
  if (authority.consumptionGate === "restricted") {
    return { kind: "restricted", reason: "ACTIVE_SAFETY_RESTRICTION", allowEducation };
  }
  if (input.context.risks.length || assessment.newRisks.length) {
    return { kind: "restricted", reason: "NEW_RISK_UNRESOLVED", allowEducation };
  }
  return { kind: "generate_recommendation", includeEducation: allowEducation };
}
