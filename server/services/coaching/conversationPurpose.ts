import { z } from "zod";

/** Internal Development contract; never a frontend action or access authority. */
export const ResponsePurposeSchema = z.enum([
  "answer", "clarify", "answer_with_offer", "feature_only_offer", "handoff", "care",
]);
export const MemberNeedSchema = z.enum([
  "nutrition_guidance", "feature_help", "navigation", "unclear",
]);
export type ResponsePurpose = z.infer<typeof ResponsePurposeSchema>;

export function inspectConversationPurpose(turn: {
  responsePurpose?: unknown; memberNeed?: unknown; navigationIntent?: unknown;
  conciergeDecision?: unknown;
}): { purpose?: ResponsePurpose; valid: boolean; reason?: "purpose_missing" | "purpose_invalid" | "purpose_conflict" } {
  if (turn.responsePurpose === undefined || turn.memberNeed === undefined) {
    return { valid: false, reason: "purpose_missing" };
  }
  const purpose = ResponsePurposeSchema.safeParse(turn.responsePurpose);
  const need = MemberNeedSchema.safeParse(turn.memberNeed);
  if (!purpose.success || !need.success) return { valid: false, reason: "purpose_invalid" };
  const value = purpose.data;
  const action = turn.conciergeDecision as { mode?: unknown; destinationId?: unknown } | null;
  const hasAction = action?.mode === "food_assistance" || action?.destinationId != null;
  const ordinary = (value === "answer" || value === "clarify") &&
    turn.navigationIntent === "none" && !hasAction;
  const offer = (value === "answer_with_offer" || value === "feature_only_offer") &&
    turn.navigationIntent === "recommendation" && action?.mode === "food_assistance" &&
    (value !== "feature_only_offer" || need.data === "feature_help") &&
    need.data !== "navigation" && need.data !== "unclear";
  const handoff = value === "handoff" && need.data === "navigation" &&
    (turn.navigationIntent === "confirmed" || turn.navigationIntent === "direct_request");
  // Actual care flags are evaluated first by the caller. A purpose alone cannot
  // invent either a referral or permission to navigate.
  return { purpose: value, valid: ordinary || offer || handoff,
    ...(!ordinary && !offer && !handoff ? { reason: "purpose_conflict" as const } : {}) };
}

/** Numbers/booleans only: no raw model values, hashes of conversations or PHI. */
export function responseFieldMetrics(turn?: Record<string, unknown>) {
  return Object.fromEntries(["message", "recommendationMessage", "conversationMessage", "handoffMessage"]
    .map(field => [field, {
      present: typeof turn?.[field] === "string",
      length: typeof turn?.[field] === "string" ? (turn[field] as string).length : 0,
    }]));
}
