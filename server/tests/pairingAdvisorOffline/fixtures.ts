import {
  AdvisorResponse, type AdvisorRequest, type CompleteResponseReview,
  type IntentAssessment, type SafetyAuthority,
} from "../../../shared/pairingAdvisor/contracts";
import { emptyConversation } from "../../../shared/pairingAdvisor/conversation";

export const meta = { version: 1 as const, requestId: "request-1", conversationId: "conversation-1", contextRevision: 0 };
export const authority: SafetyAuthority = {
  status: "ready", actorId: "synthetic-owner", subjectId: "synthetic-owner",
  scope: "account_owner", requiredSafetyComplete: true,
  requiresVerifiedIngredients: false, consumptionGate: "eligible",
};
export const assessment: IntentAssessment = {
  intent: "education", subject: "account_owner", referent: "none",
  contradictory: false, newRisks: [],
};
export function request(message = "Why do tannins matter?"): AdvisorRequest {
  return {
    requestId: meta.requestId, conversationId: meta.conversationId, contextRevision: 0,
    message, context: emptyConversation(),
  };
}
export function educational(): AdvisorResponse {
  return {
    ...meta, outcome: "education",
    education: {
      paragraphs: ["Tannins contribute astringency; food changes the sensory balance. This is a general explanation."],
      followUps: ["Would you like to learn how acidity differs from tannin?"],
    },
  };
}
export function recommendation(): Extract<AdvisorResponse, { outcome: "recommendation" }> {
  return {
    ...meta, outcome: "recommendation", education: null,
    recommendations: [{
      id: "choice-1", name: "Estate A, Chianti 2021", listEntryId: "wine-1",
      explanation: "Its acidity contrasts with the meal's richness.",
      servingAdvice: null, alternativeIds: [],
      claims: [{ kind: "list_membership", evidenceId: "list:1:wine-1" }],
    }],
    bestChoiceId: "choice-1",
    narrative: [{ text: "This selection is on the list you supplied.", recommendationIds: ["choice-1"] }],
    followUps: [],
  };
}
export const listEvidence = { suppliedList: { revision: 1, text: "Estate A, Chianti 2021 — $25" } };
export const noEvidence = { suppliedList: null };

/** A synthetic verdict proves plumbing, never real language understanding. */
export function reviewed(raw: unknown, overrides: Partial<CompleteResponseReview> = {}): CompleteResponseReview {
  return {
    verdict: "pass", covers: "complete_response", reviewedPayload: JSON.stringify(AdvisorResponse.parse(raw)),
    intentBoundary: true, evidenceClaims: true, noUnsafeAdvice: true, referencesConsistent: true,
    ...overrides,
  };
}
