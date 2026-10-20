import type { AdvisorResponse, IntentAssessment } from "../../../shared/pairingAdvisor/contracts";
import { emptyConversation } from "../../../shared/pairingAdvisor/conversation";
import type { ContextAcknowledgement, TurnSubmission } from "../../../shared/pairingAdvisor/readiness/transport";
import { createOfflineReadinessController, type OfflineReadinessOptions } from "../../services/pairingAdvisor/readiness/controller";
import type { StrictOwnerReceipt } from "../../services/pairingAdvisor/readiness/authority";
import type { SafetySourceKey } from "../../services/nutritionResolutionContext";
import type { AuthenticatedOwner } from "../../services/pairingAdvisor/readiness/sessions";
import type { MockProviderPort, ReviewInput } from "../../services/pairingAdvisor/readiness/providers";
import { educational, reviewed } from "../pairingAdvisorOffline/fixtures";

export const owner: AuthenticatedOwner = {
  accountId: "synthetic-owner", authSessionId: "synthetic-login", activeAccess: true, proAccess: true,
};
export function envelope(extra: Record<string, unknown> = {}) {
  return {
    userId: owner.accountId, allergies: [], dietaryIdentity: [], avoidances: [],
    medicalHardLimits: [], medicalOptimization: [], conditionGuidanceBlocks: [],
    providerInterventions: [], procedural: {}, hasDiabetes: false, thyroidSupport: false,
    pregnancySupportContext: null, dailyNutritionState: null, glp1DailyTolerance: null, ...extra,
  };
}
type MutableStrictFixture = Omit<Extract<StrictOwnerReceipt, { status: "complete" }>, "sources"> & {
  sources: Partial<Record<SafetySourceKey, unknown>>;
};
export function strictReceipt(): MutableStrictFixture {
  const sources = Object.fromEntries([
    "glp1_activation", "personal_supports", "provider_interventions", "diabetes_context",
    "glp1_tolerance", "competition", "condition_guidance", "daily_state", "prescription",
    "glp1_guardrails", "performance",
  ].map(key => [key, { status: "not_applicable", reasonCode: "synthetic_non_applicability" }]));
  return {
    status: "complete", ownerId: owner.accountId, subjectId: owner.accountId, scope: "account_owner",
    envelope: envelope(), prescription: null, persistence: "none",
    sources: {
      ...sources,
      owner_profile: { status: "success", value: { id: owner.accountId }, basis: "stored" },
      timezone: { status: "success", value: { timezone: "America/Chicago", localDate: "2026-10-19" }, basis: "stored" },
      write_boundary: { status: "success", value: "none", basis: "calculated" },
    },
  };
}
export function intent(kind: IntentAssessment["intent"] = "education"): IntentAssessment {
  return { intent: kind, subject: "account_owner", referent: "none", contradictory: false, newRisks: [] };
}
export function water(): AdvisorResponse {
  return {
    version: 1, requestId: "ignored", conversationId: "ignored", contextRevision: 0,
    outcome: "recommendation", education: null,
    recommendations: [{
      id: "water", name: "Sparkling water", listEntryId: null,
      explanation: "Bubbles contrast with richness.", servingAdvice: "Serve chilled.",
      alternativeIds: [], claims: [],
    }],
    bestChoiceId: "water", narrative: [], followUps: [],
  };
}
export function harness(overrides: Partial<OfflineReadinessOptions> = {}) {
  const state = {
    authority: strictReceipt() as StrictOwnerReceipt,
    assessment: intent(), response: educational() as unknown,
    runtime: { nodeEnv: "development" as string | undefined, deploymentMarker: undefined as string | undefined },
  };
  const resolveOwner = jest.fn(async () => state.authority);
  const execute = jest.fn(async (call: Parameters<MockProviderPort["execute"]>[0]) => {
    const output = call.stage === "interpretation" ? state.assessment
      : call.stage === "generation" ? state.response
        : reviewed((call.input as ReviewInput).candidate);
    return { source: "mock_provider", physicalAttempts: 1, output };
  });
  const deterministic = { checkInput: jest.fn(() => "pass" as const), scanFinal: jest.fn(() => true) };
  const controller = createOfflineReadinessController({
    mode: "offline_readiness_only", getRuntime: () => state.runtime,
    authority: {
      resolveOwner, requiresVerifiedIngredients: () => false,
      consumptionGate: () => "eligible", constraints: () => "SYNTHETIC OWNER CONSTRAINTS",
    },
    deterministic, provider: { mode: "mock_only", execute }, ...overrides,
  });
  let acknowledgement = controller.open(owner);
  let sequence = 0;
  function turn(patch: Partial<TurnSubmission> = {}): TurnSubmission {
    return {
      sessionId: acknowledgement.sessionId, conversationId: acknowledgement.conversationId,
      expectedRevision: acknowledgement.revision, requestId: `request-${++sequence}`,
      message: "Explain tannins.", context: emptyConversation(), ...patch,
    };
  }
  const send = async (patch: Partial<TurnSubmission> = {}, signal?: AbortSignal) => {
    const result = await controller.submit(owner, turn(patch), signal);
    if (result.acknowledgement) acknowledgement = result.acknowledgement;
    return result;
  };
  return {
    controller, state, execute, resolveOwner, deterministic, turn, send,
    ack: () => acknowledgement,
    setAck: (value: ContextAcknowledgement) => { acknowledgement = value; },
  };
}
