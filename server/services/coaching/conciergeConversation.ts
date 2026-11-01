import type OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { CoachResponse, CoachingTool } from "../../../shared/coaching/types";
import { ConciergeDecisionSchema, ConciergeGoalSchema, ConciergeMessageSchema } from "../../../shared/coaching/schemas";
import { validateConciergeGoal } from "./conciergeGoal";
import { CHEF_CONCIERGE_REVISION, CHEF_CONVERSATION_INSTRUCTIONS } from "./conciergeInstructions";
import { buildSafetyResponse } from "./safety";
import { getLanguageInstruction } from "../../utils/languageInstruction";
import { CreatorRequestEvidenceSchema, groundedCreatorRequest } from "./creatorRequest";
import { COACH_DESTINATIONS, mentionsCoachDestination, type CoachDestinationId } from "../../../shared/coaching/navigation";
import { CORNER_UNSUPPORTED_FEATURES } from "./capabilityRegistry";
import type { ChefCreatorRequest } from "../../../shared/coaching/creatorRequest";
import { getDevelopmentPlatformKnowledge, PLATFORM_GUIDANCE_INSTRUCTIONS } from "./platformKnowledge";
import type { PendingRecommendation } from "./conciergeNavigationState";
import type { ChefKnowledgeAccess } from "./platformKnowledgeAccess";

const TurnSchema = ConciergeMessageSchema.extend({
  // Semantic consent is separate from choosing a suitable food destination.
  // Unknown/missing values cannot authorize a button.
  message: z.string().trim().min(1).max(8000).nullish().catch(undefined),
  navigationIntent: z.unknown().optional(),
  recommendationMessage: z.string().trim().min(1).max(8000).nullish().catch(undefined),
  handoffMessage: z.string().trim().min(1).max(8000).nullish().catch(undefined),
  // An independent, model-authored continuation must survive a rejected action.
  conversationMessage: z.string().trim().min(1).max(8000).nullish().catch(undefined),
  // Validate after safety escalation: malformed navigation must never erase care.
  conciergeDecision: z.unknown().optional(),
  redFlag: z.boolean().default(false),
  redFlagReason: z.string().max(1000).nullish().transform(value => value ?? undefined),
  contactCare: z.string().max(1000).nullish().transform(value => value ?? undefined),
  // Missing/invalid classification retains the legacy fail-closed referral path.
  careDisposition: z.enum(["none", "routine_caveat", "referral", "emergency"]).optional().catch(undefined),
  creatorRequest: CreatorRequestEvidenceSchema.optional().catch(undefined),
});

const destinationIds = Object.keys(COACH_DESTINATIONS) as [CoachDestinationId, ...CoachDestinationId[]];
// Provider-enforced structure, not another reasoning/rendering pass. Nullable
// fields are explicit because strict structured output requires every key.
const ModelTurnSchema = z.object({
  message: z.string(),
  conversationMessage: z.string().nullable(),
  navigationIntent: z.enum(["none", "recommendation", "confirmed", "direct_request"]),
  recommendationMessage: z.string().nullable(),
  handoffMessage: z.string().nullable(),
  conciergeDecision: z.object({
    mode: z.enum(["food_assistance", "nutrition_education", "behavioral_coaching", "clarification"]),
    destinationId: z.enum(destinationIds).nullable(),
    goal: ConciergeGoalSchema.extend({ explicitFeatureId: z.enum(destinationIds).nullable() }),
  }).nullable(),
  creatorRequest: z.object({ idea: z.string(), memberTurns: z.array(z.number().int()) }).nullable(),
  redFlag: z.boolean(),
  redFlagReason: z.string().nullable(),
  contactCare: z.string().nullable(),
  careDisposition: z.enum(["none", "routine_caveat", "referral", "emergency"]),
});

/** Output isolation, not intent routing: never reuse a rejected feature pitch. */
function independentConversation(message: string | null | undefined, allowedDestinationId?: CoachDestinationId,
  allowFeatureMentions = false): string | undefined {
  // Symbol-only nullable-field placeholders are not useful conversation or
  // consent. This is output validation, not classification of food intent.
  if (!message || !/[\p{L}\p{N}]/u.test(message)) return undefined;
  const lower = message.toLocaleLowerCase();
  // Match longer labels first: "Athlete Beverage Creator" includes "Beverage
  // Creator", but authorizing one must not authorize an additional other tool.
  let remaining = lower;
  for (const [id, destination] of Object.entries(COACH_DESTINATIONS)
    .sort((a, b) => b[1].label.length - a[1].label.length)) {
    const label = destination.label.toLocaleLowerCase();
    if (remaining.includes(label)) {
      if (!allowFeatureMentions && id !== allowedDestinationId) return undefined;
      remaining = remaining.split(label).join("");
    }
    if (lower.includes(destination.route)) return undefined;
  }
  if (/https?:\/\/|www\.|javascript:|data:|href\s*=|\]\s*\(|(?:^|\s)\/[a-z]/i.test(message)) return undefined;
  return message;
}

// Output screening only, never interpretation of member intent or authorization.
// A feature name is harmless in a standalone explanation. Opening/transfer claims
// and instructions are not an independent continuation of a rejected action.
function conversationalContinuation(message: string | null | undefined): string | undefined {
  const text = independentConversation(message, undefined, true);
  if (!text || /\b(?:open|launch|navigate|click|tap|press|redirect|transfer|take you|taking you|send you|get you started|getting you started|button)\b/i.test(text)) {
    return undefined;
  }
  return text;
}

type DecisionReason = "missing_recommendation_wording" | "missing_handoff_wording" |
  "navigation_not_authorized" | "missing_pending_recommendation" | "decision_invalid" |
  "invalid_destination" | "entitlement_rejected" | "goal_not_ready" | "unusable_conversational_response";
class DecisionFailure extends Error {
  constructor(readonly reason: DecisionReason) { super(reason); }
}

function envelope(message: string, destinationId?: NonNullable<CoachResponse["presentation"]>["destinationId"],
  creatorRequest?: ChefCreatorRequest): CoachResponse {
  return {
    presentation: { kind: "concierge", message, ...(destinationId ? { destinationId } : {}),
      ...(creatorRequest ? { creatorRequest } : {}) },
    whatIFound: message, whatItCouldMean: "", learningOpportunity: null,
    todayPlan: {
      why: "", successMetric: "", nextCheckIn: "",
      items: destinationId ? [{
        horizon: "today", kind: "use_feature", text: "Open the recommended feature",
        featureTarget: destinationId, destinationId,
      }] : [],
    },
    // Legacy envelope compatibility, not a resolved assessment/style.
    meta: { specialization: "corner", confidence: "low", styleMode: "encouragement",
      patternKeys: [], observersRun: [], redFlag: false,
      concierge: { revision: CHEF_CONCIERGE_REVISION, reasoning: "validated", rendering: "primary" } },
  };
}

/** One foreground call. No assessment, style resolution, behavioral hypotheses, or second expression call. */
export async function runConciergeConversation(params: {
  client: OpenAI; userMessage: string; history: Array<{ role: string; content: string }>;
  rollingContext: string | null; context: Record<string, unknown>; tools: CoachingTool[];
  preferredLanguage?: string;
  pendingRecommendation?: PendingRecommendation;
  knowledgeAccess?: ChefKnowledgeAccess;
  requestId?: string;
}): Promise<CoachResponse> {
  const memberMessages = [...params.history.filter(m => m.role === "user").map(m => m.content), params.userMessage];
  let stage: "provider" | "parsing" | "decision" = "provider";
  let retainPendingOnFailure = false;
  // Only correlation IDs in the existing UUID format are safe for logs.
  const correlation = /^[a-f0-9-]{36}$/i.test(params.requestId ?? "") ? ` request_id=${params.requestId}` : "";
  const diagnostic = (outcome: string, reason?: DecisionReason | "safety_escalation") =>
    console.info(`[ChefConcierge] decision_outcome=${outcome}${reason ? ` reason=${reason}` : ""}${correlation}`);
  try {
    const completion = await params.client.chat.completions.create({
      model: "gpt-4o", response_format: zodResponseFormat(ModelTurnSchema, "chef_conversation"),
      temperature: 0.4, max_tokens: 2000,
      messages: [
        { role: "system", content: [
          CHEF_CONVERSATION_INSTRUCTIONS,
          getLanguageInstruction(params.preferredLanguage),
          PLATFORM_GUIDANCE_INSTRUCTIONS,
        ].filter(Boolean).join("\n") },
        { role: "user", content: JSON.stringify({
          authorizedNutritionContext: params.context.coachingContextBlock ?? params.context,
          availableFeatures: params.tools.map(({ id, label, description }) => ({ id, label, description })),
          platformKnowledge: getDevelopmentPlatformKnowledge(params.knowledgeAccess),
          unsupportedFeatures: CORNER_UNSUPPORTED_FEATURES,
          earlierConversation: params.rollingContext,
          pendingRecommendation: params.pendingRecommendation ?? null,
          history: params.history,
          latestMemberMessage: params.userMessage,
          memberStatements: memberMessages.map((text, index) => ({ index, text })),
        }) },
      ],
    });
    stage = "parsing";
    const turn = TurnSchema.parse(JSON.parse(completion.choices[0]?.message?.content ?? "{}"));
    const classifiedCare = turn.careDisposition === "referral" || turn.careDisposition === "emergency";
    // Explicit no-care classifications own inactive fields. Live structured
    // outputs can fill unused nullable strings with placeholders; presence alone
    // is not a clinical decision. Unclassified legacy care still fails closed.
    const requiredCare = !!turn.contactCare?.trim() && turn.careDisposition === undefined;
    if (turn.redFlag || classifiedCare || requiredCare) {
      diagnostic("safety_rejected_navigation", "safety_escalation");
      return buildSafetyResponse({
        triggered: true, class: turn.careDisposition === "emergency" ? "emergency" : "escalate",
        reason: "concierge_care_escalation",
        suggestedResponse: turn.contactCare
          ? [...new Set([turn.message, turn.contactCare].filter(Boolean))].join("\n\n")
          : turn.redFlagReason ?? turn.message ?? undefined,
      }) as CoachResponse;
    }
    stage = "decision";
    const acceptingPending = turn.navigationIntent === "confirmed" && params.pendingRecommendation;
    if (turn.conciergeDecision == null && !acceptingPending) {
      const message = independentConversation(turn.message, undefined, true) ??
        conversationalContinuation(turn.conversationMessage);
      if (!message) throw new DecisionFailure("unusable_conversational_response");
      diagnostic("no_navigation", turn.navigationIntent === "confirmed" ? "missing_pending_recommendation" : undefined);
      return envelope(message);
    }
    const rejectAction = (reason: DecisionReason, preservePending = false): CoachResponse => {
      retainPendingOnFailure = preservePending && !!acceptingPending;
      const message = conversationalContinuation(turn.conversationMessage);
      if (!message) {
        diagnostic("conversation_rejected", "unusable_conversational_response");
        throw new DecisionFailure(reason);
      }
      diagnostic("action_rejected_conversation_preserved", reason);
      // Neither the unchecked pitch nor its request text reaches display/persistence.
      const response = envelope(message);
      if (preservePending && acceptingPending) {
        response.presentation!.navigation = acceptingPending;
      }
      return response;
    };
    const parsedDecision = ConciergeDecisionSchema.safeParse(acceptingPending && (
      turn.conciergeDecision == null ||
      ((turn.conciergeDecision as any)?.mode === "food_assistance" && (
        (turn.conciergeDecision as any)?.destinationId == null ||
        (turn.conciergeDecision as any)?.destinationId === acceptingPending.destinationId
      ))
    ) ? {
      mode: "food_assistance", destinationId: acceptingPending.destinationId, goal: acceptingPending.goal,
    } : turn.conciergeDecision);
    if (!parsedDecision.success) {
      const target = (turn.conciergeDecision as any)?.destinationId;
      return rejectAction(typeof target === "string" && !destinationIds.includes(target as CoachDestinationId)
        ? "invalid_destination" : "decision_invalid");
    }
    if (!["none", "recommendation", "confirmed", "direct_request"].includes(String(turn.navigationIntent))) {
      return rejectAction("navigation_not_authorized");
    }
    const decision = validateConciergeGoal(parsedDecision.data, params.tools,
      memberMessages, { completeMissingDestination: true });
    // Reject the action, not an independently valid conversational continuation.
    if (parsedDecision.data.destinationId && !decision?.destinationId) {
      return rejectAction(params.tools.some(tool => tool.id === parsedDecision.data.destinationId)
        ? "goal_not_ready" : "entitlement_rejected");
    }
    const destinationId = decision?.destinationId as NonNullable<CoachResponse["presentation"]>["destinationId"];
    if (!destinationId || !decision?.goal) {
      const message = independentConversation(turn.message, undefined, true) ??
        conversationalContinuation(turn.conversationMessage);
      if (!message) throw new DecisionFailure("unusable_conversational_response");
      return envelope(message);
    }
    const confirmed = !!acceptingPending && acceptingPending.destinationId === destinationId &&
      !!independentConversation(params.userMessage, destinationId);
    // This is evidence binding, not a keyword router: the model still interprets
    // request vs mention/negation. An unnamed assistance request cannot qualify
    // for the explicit-feature exception, regardless of the model's intent tag.
    const direct = turn.navigationIntent === "direct_request" &&
      decision.goal.explicitFeatureId === destinationId &&
      mentionsCoachDestination(params.userMessage, destinationId) &&
      !!independentConversation(params.userMessage, destinationId);
    if (!confirmed && !direct) {
      if (turn.navigationIntent === "confirmed" && !params.pendingRecommendation) {
        diagnostic("navigation_downgraded", "missing_pending_recommendation");
      } else if (turn.navigationIntent === "direct_request" || acceptingPending) {
        diagnostic("navigation_downgraded", "navigation_not_authorized");
      }
      // Reuse existing model wording only as a proposal, never as consent.
      // A primary reply must name the validated target so an unrelated question
      // cannot silently create a pending destination.
      const recommendation = [turn.recommendationMessage, turn.message, turn.conversationMessage]
        .map((text, index) => ({ text: independentConversation(text, destinationId), dedicated: index === 0 }))
        .find(({ text, dedicated }) => text && /[?？؟]/u.test(text) &&
          (dedicated || mentionsCoachDestination(text, destinationId)) &&
          conversationalContinuation(text.replace(/\b(?:open|use)\b/gi, "")));
      if (!recommendation) return rejectAction("missing_recommendation_wording");
      if (!recommendation.dedicated) diagnostic("recommendation_recovered", "missing_recommendation_wording");
      const response = envelope(recommendation.text!);
      response.presentation!.navigation = {
        state: "recommendation_pending", destinationId, goal: decision.goal,
      };
      diagnostic("recommendation_pending");
      return response;
    }
    // No recovery from message/conversationMessage may manufacture a handoff.
    const handoff = independentConversation(turn.handoffMessage, destinationId);
    if (!handoff || handoff === turn.recommendationMessage) return rejectAction("missing_handoff_wording", !!confirmed);
    const completed = !!destinationId && !parsedDecision.data.destinationId;
    diagnostic(completed ? "completed_from_goal" : "validated_destination");
    const request = groundedCreatorRequest(turn.creatorRequest, destinationId, memberMessages);
    // Keep the model's wording when completing a verified action, rather than
    // substituting a stock pitch. Completion cannot authorize a different tool
    // named in the reply or an arbitrary link.
    const recommendation = completed ? independentConversation(handoff, destinationId) : handoff;
    if (!recommendation) return rejectAction("decision_invalid");
    const message = destinationId === "create_a_dish" && !request
      ? `${recommendation}\n\nI couldn't verify the request text for transfer. You can enter it in Create a Dish.`
      : recommendation;
    const response = envelope(message, destinationId, request);
    response.presentation!.navigation = {
      state: confirmed ? "navigation_confirmed" : "direct_navigation", destinationId, goal: decision.goal,
    };
    diagnostic(response.presentation!.navigation.state);
    return response;
  } catch (error) {
    // Static outcome only: never log the conversation, clinical context or provider payload.
    const outcome = error instanceof DecisionFailure ? error.reason : "response_unavailable";
    const status = stage === "provider" && error && typeof error === "object" && "status" in error &&
      typeof error.status === "number" && error.status >= 400 && error.status <= 599 ? error.status : undefined;
    console.warn(`[ChefConcierge] decision_outcome=${outcome} failure_stage=${stage}${status ? ` provider_status=${status}` : ""}${correlation}`);
    const response = envelope("I couldn't complete that response. Please try your request again.");
    if (retainPendingOnFailure && error instanceof DecisionFailure && error.reason === "missing_handoff_wording" &&
      params.pendingRecommendation && params.pendingRecommendation.state === "recommendation_pending") {
      response.presentation!.navigation = params.pendingRecommendation;
    }
    response.meta.concierge = { revision: CHEF_CONCIERGE_REVISION, reasoning: "unavailable", rendering: "retry" };
    return response;
  }
}
