import { z } from "zod";
import { isCoachDestinationId } from "../../../shared/coaching/navigation";
import type { CoachResponse } from "../../../shared/coaching/types";

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

/** Closed enums and booleans only. Never return raw invalid values or prose. */
export function responseContractIndicators(turn: Record<string, unknown>, pendingInput: boolean) {
  const need = MemberNeedSchema.safeParse(turn.memberNeed);
  const intent = ["none", "recommendation", "confirmed", "direct_request"].includes(String(turn.navigationIntent))
    ? String(turn.navigationIntent) : turn.navigationIntent === undefined ? "missing" : "invalid";
  const action = turn.conciergeDecision && typeof turn.conciergeDecision === "object"
    ? turn.conciergeDecision as Record<string, unknown> : undefined;
  return {
    memberNeed: need.success ? need.data : turn.memberNeed === undefined ? "missing" : "invalid",
    navigationIntent: intent,
    decisionPresent: !!action,
    foodAssistanceMode: action?.mode === "food_assistance",
    destinationPresent: action?.destinationId != null,
    destination: isCoachDestinationId(action?.destinationId) ? action.destinationId : "none_or_invalid",
    goalPresent: !!action?.goal && typeof action.goal === "object",
    offerIntentConsistent: intent === "recommendation",
    offerNeedConsistent: need.success && (need.data === "nutrition_guidance" || need.data === "feature_help"),
    pendingInputPresent: pendingInput,
  };
}

/** Emission is not persistence; the engine logs storage only after persistTurn succeeds. */
export function navigationEmissionIndicators(response: CoachResponse) {
  const navigation = response.presentation?.navigation;
  const target = response.presentation?.destinationId;
  return {
    pendingOutputPresent: navigation?.state === "recommendation_pending",
    authorizedActionEmitted: !!target && navigation?.destinationId === target &&
      (navigation.state === "navigation_confirmed" || navigation.state === "direct_navigation") &&
      response.todayPlan.items.some(item => item.kind === "use_feature" && item.destinationId === target),
  };
}
