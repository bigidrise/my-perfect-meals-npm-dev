import { z } from "zod";

/** Offline Increment 1 contracts. No route, profile loader, or provider belongs here. */
export const ContextLimits = {
  messageCharacters: 4000,
  historyMessages: 12,
  historyCharacters: 12000,
  listCharacters: 12000,
  listEntries: 100,
  requestBytes: 65536,
} as const;

const id = z.string().trim().min(1).max(120);
const text = z.string().trim().min(1).max(2000);
const revision = z.number().int().nonnegative();
const RiskDisclosure = z.object({
  source: z.literal("user_disclosure"),
  description: text,
}).strict();
const ExplicitValue = z.object({
  source: z.literal("explicit_user"),
  value: z.string().trim().min(1).max(500),
}).strict();
export const ConversationContext = z.object({
  meal: ExplicitValue.nullable(),
  preparation: ExplicitValue.nullable(),
  sauce: ExplicitValue.nullable(),
  budget: ExplicitValue.nullable(),
  currency: ExplicitValue.nullable(),
  location: ExplicitValue.nullable(),
  taste: ExplicitValue.nullable(),
  wineList: z.object({
    source: z.literal("explicit_user"),
    revision,
    text: z.string().max(ContextLimits.listCharacters),
  }).strict().nullable(),
  risks: z.array(RiskDisclosure).max(20),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(ContextLimits.messageCharacters),
  }).strict()).max(ContextLimits.historyMessages),
}).strict().superRefine((value, ctx) => {
  if (value.history.reduce((sum, message) => sum + message.content.length, 0) > ContextLimits.historyCharacters) {
    ctx.addIssue({ code: "custom", message: "History exceeds the total character limit" });
  }
});
export type ConversationContext = z.infer<typeof ConversationContext>;

export const AdvisorRequest = z.object({
  requestId: id,
  conversationId: id,
  contextRevision: revision,
  message: z.string().trim().min(1).max(ContextLimits.messageCharacters),
  context: ConversationContext,
}).strict();
export type AdvisorRequest = z.infer<typeof AdvisorRequest>;

/** Separate from request data: only a future authenticated server adapter may supply this. */
export const SafetyAuthority = z.discriminatedUnion("status", [
  z.object({ status: z.literal("unavailable") }).strict(),
  z.object({ status: z.literal("unauthorized") }).strict(),
  z.object({
    status: z.literal("ready"),
    actorId: id,
    subjectId: id,
    scope: z.literal("account_owner"),
    requiredSafetyComplete: z.literal(true),
    requiresVerifiedIngredients: z.boolean(),
    consumptionGate: z.enum(["eligible", "restricted"]),
    // Optional preferences are not evidence that required safety data was loaded.
    optionalPreferences: z.record(z.string()).optional(),
  }).strict(),
]);
export type SafetyAuthority = z.infer<typeof SafetyAuthority>;

export const IntentAssessment = z.object({
  intent: z.enum(["education", "consumption", "personal_suitability", "mixed", "unclear"]),
  subject: z.enum(["account_owner", "other", "unclear"]),
  referent: z.enum(["none", "resolved", "missing"]),
  contradictory: z.boolean(),
  newRisks: z.array(RiskDisclosure).max(20),
}).strict();
export type IntentAssessment = z.infer<typeof IntentAssessment>;

export const RestrictionReason = z.enum([
  "INGREDIENT_EVIDENCE_REQUIRED", "ACTIVE_SAFETY_RESTRICTION", "NEW_RISK_UNRESOLVED",
]);
export type RestrictionReason = z.infer<typeof RestrictionReason>;
export const ClarificationReason = z.enum([
  "INTENT_UNCLEAR", "REFERENCE_UNRESOLVED", "SUBJECT_UNSUPPORTED",
]);
export type ClarificationReason = z.infer<typeof ClarificationReason>;
export const UnavailableReason = z.enum([
  "SAFETY_AUTHORITY_UNAVAILABLE", "VALIDATION_FAILED", "PROVIDER_UNAVAILABLE",
]);

export type PolicyDecision =
  | { kind: "disabled" }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "unavailable"; reason: "SAFETY_AUTHORITY_UNAVAILABLE" }
  | { kind: "clarification"; reason: ClarificationReason }
  | { kind: "restricted"; reason: RestrictionReason; allowEducation: boolean }
  | { kind: "generate_education" }
  | { kind: "generate_recommendation"; includeEducation: boolean };

const Education = z.object({
  paragraphs: z.array(text).min(1).max(6),
  followUps: z.array(text).max(3),
}).strict();
const ReferencingText = z.object({
  text,
  recommendationIds: z.array(id).max(10),
}).strict();
const Claim = z.object({
  kind: z.enum(["list_membership", "price", "availability", "product_suitability"]),
  evidenceId: id,
}).strict();
const Recommendation = z.object({
  id,
  name: z.string().trim().min(1).max(120),
  listEntryId: id.nullable(),
  explanation: text,
  servingAdvice: text.nullable(),
  // Alternatives refer to validated cards, never unchecked names.
  alternativeIds: z.array(id).max(5),
  claims: z.array(Claim).max(10),
}).strict();
const common = {
  version: z.literal(1),
  requestId: id,
  conversationId: id,
  contextRevision: revision,
};
export const AdvisorResponse = z.discriminatedUnion("outcome", [
  z.object({ ...common, outcome: z.literal("education"), education: Education }).strict(),
  z.object({
    ...common,
    outcome: z.literal("recommendation"),
    education: Education.nullable(),
    recommendations: z.array(Recommendation).min(1).max(10),
    bestChoiceId: id.nullable(),
    narrative: z.array(ReferencingText).max(6),
    followUps: z.array(ReferencingText).max(3),
  }).strict(),
  z.object({
    ...common, outcome: z.literal("restricted"), reason: RestrictionReason,
    message: text, education: Education.nullable(),
  }).strict(),
  z.object({
    ...common, outcome: z.literal("clarification"), reason: ClarificationReason,
    question: text,
  }).strict(),
  z.object({
    ...common, outcome: z.literal("unavailable"), reason: UnavailableReason,
    message: text,
  }).strict(),
]);
export type AdvisorResponse = z.infer<typeof AdvisorResponse>;

/** Server-owned list evidence, not a verified price/composition/inventory record. */
export const EvidenceContext = z.object({
  suppliedList: z.object({ revision, text: z.string().max(ContextLimits.listCharacters) }).strict().nullable(),
}).strict();
export type EvidenceContext = z.infer<typeof EvidenceContext>;

/** Synthetic in Increment 1. A pass is not a clinical or model-accuracy guarantee. */
export const CompleteResponseReview = z.object({
  verdict: z.enum(["pass", "fail", "uncertain"]),
  covers: z.literal("complete_response"),
  reviewedPayload: z.string(),
  intentBoundary: z.boolean(),
  evidenceClaims: z.boolean(),
  noUnsafeAdvice: z.boolean(),
  referencesConsistent: z.boolean(),
}).strict();
export type CompleteResponseReview = z.infer<typeof CompleteResponseReview>;

// Deliberately proposals, not defaults read by an execution path.
export const ProvisionalRuntimeDesign = Object.freeze({
  approval: "pending_separate_runtime_approval",
  physicalAttemptsPerTurn: 3,
  perAttemptMilliseconds: 15000,
  totalMilliseconds: 45000,
  retries: 0,
  httpMapping: "pending_separate_runtime_approval",
});
