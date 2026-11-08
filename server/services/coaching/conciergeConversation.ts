import type OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { createHash } from "node:crypto";
import { isUnambiguousChefClosing, chefClosingAcknowledgement } from "./conversationReliability";
import type { CoachResponse, CoachingTool } from "../../../shared/coaching/types";
import { ConciergeDecisionSchema, ConciergeGoalSchema, ConciergeMessageSchema } from "../../../shared/coaching/schemas";
import { validateConciergeGoal } from "./conciergeGoal";
import { CHEF_CONCIERGE_REVISION, getChefConversationInstructions } from "./conciergeInstructions";
import { inspectConversationPurpose, MemberNeedSchema, ResponsePurposeSchema, responseFieldMetrics,
  responseContractIndicators, navigationEmissionIndicators } from "./conversationPurpose";
import { fallbackQuality, selectRejectedConversation, HANDOFF_RECOVERY, CONVERSATION_RECOVERY, MISSING_PENDING_RECOVERY } from "./conciergeFallback";
import { navigationPermissionQuestion, screenIndependentConversation, screenOrdinaryConversation, screenConversationalContinuation,
  type ReplyScreenReason } from "./conciergeReplyScreening";
import { buildSafetyResponse } from "./safety";
import { getLanguageInstruction } from "../../utils/languageInstruction";
import { CreatorRequestEvidenceSchema, groundedCreatorRequest } from "./creatorRequest";
import { COACH_DESTINATIONS, mentionsCoachDestination, type CoachDestinationId } from "../../../shared/coaching/navigation";
import { CORNER_UNSUPPORTED_FEATURES } from "./capabilityRegistry";
import type { ChefCreatorRequest } from "../../../shared/coaching/creatorRequest";
import { getDevelopmentPlatformKnowledge, getPlatformGuidanceInstructions } from "./platformKnowledge";
import type { PendingRecommendation } from "./conciergeNavigationState";
import { explicitNavigationRequest, navigationDestinationQuestion, acceptsPendingFeature, navigationGoal,
  verifiedDiabeticBuilderExplanation, verifiedNavigationText } from "./verifiedNavigation";
import { verifiedNavigationOffer } from "../../../shared/coaching/navigationGuidance";
import {
  NAVIGATION_RECOVERY_WINDOW_MS, isNavigationFailureComplaint, complaintMatchesDestination,
} from "./navigationRecovery";
import {
  NAVIGATION_CONTINUITY_INSTRUCTIONS, PendingNavigationDispositionSchema,
  pendingNavigationIsFresh, retainInformationalOffer,
  isConfirmableNavigation,
} from "./conciergeNavigationContinuity";
import type { ChefKnowledgeAccess } from "./platformKnowledgeAccess";
import { explainFeatureQuestion, featureIntelligenceEnabled, projectFeatureKnowledge, safeScreenContext,
  type FeatureScreenContext } from "./featureIntelligence";
import type { FeatureExplanation } from "./featureIntelligence";
import { loadFeatureIntelligenceRegistry } from "./featureIntelligenceRegistry";
import {
  ChefFoodDeclarationsSchema, CHEF_FOOD_COMPATIBILITY_INSTRUCTIONS,
  inspectChefFoodDeclarations, chefFoodCheckNotice, projectChefFoodEducation,
} from "./foodCompatibility";

const TurnSchema = ConciergeMessageSchema.extend({
  // Semantic consent is separate from choosing a suitable food destination.
  // Unknown/missing values cannot authorize a button.
  message: z.string().trim().min(1).max(8000).nullish().catch(undefined),
  navigationIntent: z.unknown().optional(),
  pendingNavigationDisposition: PendingNavigationDispositionSchema.optional().catch(undefined),
  responsePurpose: z.unknown().optional(),
  memberNeed: z.unknown().optional(),
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
  message: z.string().describe("Actual useful reply. A question offering to open/use a feature or help carry out its workflow MUST include the corresponding food_assistance conciergeDecision, ready goal and recommendation navigationIntent. Never ask unstructured permission to assist."),
  conversationMessage: z.string().nullable(),
  navigationIntent: z.enum(["none", "recommendation", "confirmed", "direct_request"]),
  pendingNavigationDisposition: PendingNavigationDispositionSchema.describe(
    "Preserve only an existing same-workflow pending offer across a relevant informational answer. Clear on rejection, topic/destination change or safety. This field never grants consent."),
  recommendationMessage: z.string().nullable(),
  handoffMessage: z.string().nullable().describe("Required on confirmed/direct navigation: concise acknowledgement and verified starting instructions, no repeated permission question. Null only when no handoff is intended."),
  conciergeDecision: z.object({
    mode: z.enum(["food_assistance", "nutrition_education", "behavioral_coaching", "clarification"]),
    destinationId: z.enum(destinationIds).nullable(),
    goal: ConciergeGoalSchema.extend({ explicitFeatureId: z.enum(destinationIds).nullable() }),
  }).nullable().describe("Required for every feature/workflow permission offer, even before consent. Null only for ordinary discussion or unresolved clarification, never for an offer to proceed with a single ready workflow."),
  creatorRequest: z.object({ idea: z.string(), memberTurns: z.array(z.number().int()) }).nullable(),
  redFlag: z.boolean(),
  redFlagReason: z.string().nullable(),
  contactCare: z.string().nullable(),
  careDisposition: z.enum(["none", "routine_caveat", "referral", "emergency"]),
});

/** Output isolation, not intent routing: never reuse a rejected feature pitch. */
function independentConversation(message: string | null | undefined, allowedDestinationId?: CoachDestinationId,
  allowFeatureMentions = false): string | undefined {
  return screenIndependentConversation(message, allowedDestinationId, allowFeatureMentions).text;
}

function ordinaryConversation(message: string | null | undefined): string | undefined {
  return screenOrdinaryConversation(message).text;
}

// Output screening only, never interpretation of member intent or authorization.
// A feature name is harmless in a standalone explanation. Opening/transfer claims
// and instructions are not an independent continuation of a rejected action.
function conversationalContinuation(message: string | null | undefined, structuredOffer = false): string | undefined {
  return screenConversationalContinuation(message, structuredOffer).text;
}

type DecisionReason = "missing_recommendation_wording" | "missing_handoff_wording" |
  "navigation_not_authorized" | "missing_pending_recommendation" | "decision_invalid" |
  "invalid_destination" | "entitlement_rejected" | "goal_not_ready" | "unusable_conversational_response" |
  "purpose_missing" | "purpose_invalid" | "purpose_conflict";
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
  navigationContext?: PendingRecommendation;
  /** Bounded owner-scoped context only. Never counts as pending consent. */
  navigationRecoveryContext?: PendingRecommendation;
  knowledgeAccess?: ChefKnowledgeAccess;
  featureScreenContext?: FeatureScreenContext;
  requestId?: string;
}): Promise<CoachResponse> {
  // Normally enforced by the owner-scoped loader; recheck timestamped offers
  // before using them, including callers that bypass the engine in tests.
  if (params.pendingRecommendation?.offeredAt &&
    !pendingNavigationIsFresh(params.pendingRecommendation.offeredAt)) {
    params = { ...params, pendingRecommendation: undefined };
  }
  if (params.pendingRecommendation?.performedAt) {
    params = { ...params, pendingRecommendation: undefined };
  }
  if (params.navigationContext &&
    !pendingNavigationIsFresh(params.navigationContext.offeredAt)) {
    params = { ...params, navigationContext: undefined };
  }
  let intelligenceKnowledge: FeatureExplanation[] | undefined;
  if (featureIntelligenceEnabled(process.env)) {
    const registry = loadFeatureIntelligenceRegistry();
    intelligenceKnowledge = registry ? projectFeatureKnowledge(registry, params.knowledgeAccess, params.tools.map(tool => tool.id)) : [];
    const answer = explainFeatureQuestion({
      message: params.userMessage, context: safeScreenContext(params.featureScreenContext),
      records: intelligenceKnowledge,
      withheldLabels: registry?.features.flatMap(record => record.name ? [record.name, ...record.aliases] : []),
    });
    if (answer) return envelope(answer.message);
    // Only while explicitly enabled in Development. Existing authorization still
    // validates every navigation; intelligence may narrow tools, never add them.
    params = { ...params, tools: params.tools.filter(tool => intelligenceKnowledge!.some(record => record.id === `feature:${tool.id}`)) };
  }
  const memberMessages = [...params.history.filter(m => m.role === "user").map(m => m.content), params.userMessage];
  // Approved response contracts apply in published builds as well as preview.
  const developmentPurpose = true;
  const developmentDiagnostics = process.env.NODE_ENV === "development";
  // Only correlation IDs in the existing UUID format are safe for logs.
  const correlation = /^[a-f0-9-]{36}$/i.test(params.requestId ?? "") ? ` request_id=${params.requestId}` : "";
  if (developmentDiagnostics) {
    // Counts and presence only: never retain member prose, summaries or profile values.
    console.info(`[ChefConcierge] freshness${correlation} ${JSON.stringify({
      historyCount: params.history.length,
      summaryPresent: !!params.rollingContext,
      pendingNavigationPresent: !!params.pendingRecommendation,
    })}`);
  }
  // The authenticated self adapter owns activation; model/client data cannot
  // authorize a profile or opt a real Ask Chef turn out of this contract.
  const foodCompatibilityRequired = developmentPurpose && !!params.context.chefFoodCompatibility;
  const foodInstructions = foodCompatibilityRequired ? CHEF_FOOD_COMPATIBILITY_INSTRUCTIONS : "";
  const instructions = getChefConversationInstructions(process.env.NODE_ENV);
  const platformInstructions = getPlatformGuidanceInstructions(process.env.NODE_ENV);
  const schema = developmentPurpose ? ModelTurnSchema.extend({
    memberNeed: MemberNeedSchema.describe("The actual member need: nutrition_guidance for advice; feature_help for choosing or offering a useful workflow; navigation for accepting a valid pending recommendation or explicitly opening a named feature; unclear only while the actual task is unresolved. A clear preparation request may warrant feature_help and an offer, not a confirmed handoff."),
    responsePurpose: ResponsePurposeSchema.describe("answer/clarify: navigationIntent=none, no food_assistance action. answer_with_offer: useful answer plus offer, navigationIntent=recommendation, food_assistance decision/goal, memberNeed=nutrition_guidance or feature_help. feature_only_offer: same recommendation metadata, memberNeed=feature_help. handoff: memberNeed=navigation, navigationIntent=confirmed with valid pending state or direct_request for an explicit named feature. care never grants navigation; actual safety flags remain authoritative."),
    message: z.string().describe("Canonical complete reply. For answer_with_offer, answer FIRST and include the permission offer in this SAME message. Every permission offer MUST carry navigationIntent=recommendation and a matching ready food_assistance conciergeDecision/goal. An offer is not a confirmed handoff. Never replace guidance with a feature pitch."),
    conversationMessage: z.string().nullable().describe("Optional independently useful answer or clarification if the proposed action is rejected. No rejected offer, opening claim, emoji-only text or generic acknowledgment. Null when there is no useful independent continuation."),
    handoffMessage: z.string().nullable().describe("Concise verified starting guidance only for responsePurpose=handoff with confirmed/direct navigation. Null for answers, clarification and unaccepted offers. Never claim a feature already opened."),
    recommendationMessage: z.null().describe("Unused: the canonical message contains the entire answer and any feature offer."),
    ...(foodCompatibilityRequired ? { foodDeclarations: ChefFoodDeclarationsSchema } : {}),
  }) : ModelTurnSchema;
  const responseFormat = zodResponseFormat(schema, "chef_conversation");
  const fingerprint = developmentDiagnostics ? createHash("sha256")
    .update(instructions + platformInstructions + foodInstructions + JSON.stringify(responseFormat)).digest("hex").slice(0, 16) : undefined;
  let foodDeclarations: unknown;
  let purpose: string = "unavailable";
  let selectedField = "none";
  let metrics = responseFieldMetrics();
  let stage: "provider" | "parsing" | "decision" = "provider";
  let pendingDisposition: unknown;
  let retainPendingOnFailure = false;
  let contract: ReturnType<typeof responseContractIndicators> | undefined;
  let fallback: ReturnType<typeof selectRejectedConversation>["outcomes"] | undefined;
  let screening: { message: ReplyScreenReason; conversationMessage: ReplyScreenReason } | undefined;
  const diagnostic = (outcome: string, reason?: DecisionReason | "safety_escalation", response?: CoachResponse) =>
    console.info(`[ChefConcierge] decision_outcome=${outcome}${reason ? ` reason=${reason}` : ""}${correlation}` +
      (developmentDiagnostics ? ` ${JSON.stringify({ implementation: "conversation-purpose-v1", fingerprint, purpose, selectedField,
        fields: metrics, contract, fallback, screening, ...(response ? navigationEmissionIndicators(response) : {}) })}` : ""));
  const finish = (response: CoachResponse, informational = false) => {
    if (informational && !response.presentation?.navigation &&
      !response.presentation?.destinationId && !response.meta.redFlag) {
      const retained = retainInformationalOffer(
        params.pendingRecommendation ?? params.navigationContext, pendingDisposition,
      );
      if (retained && response.presentation) response.presentation.navigation = retained;
    }
    if (foodCompatibilityRequired) {
      const check = inspectChefFoodDeclarations(foodDeclarations, selectedField, params.context);
      if (check.status === "blocked" || check.status === "unavailable") {
        // Replace the whole selected reply. Do not expose a rejected proposal
        // in another display field or retain its action/creator handoff.
        response = envelope(chefFoodCheckNotice(check));
      } else if (check.status === "screened" && response.presentation) {
        const message = `${response.presentation.message}\n\n${chefFoodCheckNotice(check)}`;
        response = { ...response, presentation: { ...response.presentation, message }, whatIFound: message };
      }
      if (check.status !== "not_applicable") response.foodCompatibility = check;
    }
    if (developmentDiagnostics) diagnostic("response_ready", undefined, response);
    return response;
  };
  const rejectedContinuation = (turn: { message?: string | null; conversationMessage?: string | null },
    screen = conversationalContinuation) => {
    if (developmentPurpose && screen === conversationalContinuation) {
      screening = {
        message: screenConversationalContinuation(turn.message).reason,
        conversationMessage: screenConversationalContinuation(turn.conversationMessage).reason,
      };
    }
    const selection = selectRejectedConversation(turn, screen);
    selectedField = selection.selectedField;
    fallback = selection.outcomes;
    return selection.text;
  };
  try {
    const completion = await params.client.chat.completions.create({
      model: "gpt-4o", response_format: responseFormat,
      temperature: 0.4, max_tokens: 2000,
      messages: [
        { role: "system", content: [
          instructions,
          getLanguageInstruction(params.preferredLanguage),
          platformInstructions,
          NAVIGATION_CONTINUITY_INSTRUCTIONS,
          foodInstructions,
        ].filter(Boolean).join("\n") },
        { role: "user", content: JSON.stringify({
          authorizedNutritionContext: params.context.coachingContextBlock ?? params.context,
          ...(foodCompatibilityRequired ? { nutritionPriorityEducation: projectChefFoodEducation(params.userMessage) } : {}),
          availableFeatures: params.tools.map(({ id, label, description }) => ({ id, label, description })),
          platformKnowledge: intelligenceKnowledge === undefined ? getDevelopmentPlatformKnowledge(params.knowledgeAccess)
            : { source: "verified_feature_intelligence", explanationOnly: true,
              features: intelligenceKnowledge.map(({ id, name, description, workflows, limitations }) =>
                ({ id, name, description, workflows, limitations })) },
          unsupportedFeatures: CORNER_UNSUPPORTED_FEATURES,
          earlierConversation: params.rollingContext,
          pendingRecommendation: params.pendingRecommendation ?? null,
          recentNavigationContext: params.navigationContext ?? null,
          history: params.history,
          latestMemberMessage: params.userMessage,
          memberStatements: memberMessages.map((text, index) => ({ index, text })),
        }) },
      ],
    });
    stage = "parsing";
    const rawTurn = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    foodDeclarations = rawTurn.foodDeclarations;
    if (developmentPurpose) {
      metrics = responseFieldMetrics(rawTurn);
      contract = responseContractIndicators(rawTurn, !!params.pendingRecommendation);
    }
    const turn = TurnSchema.parse(rawTurn);
    if (developmentPurpose) {
      purpose = ResponsePurposeSchema.safeParse(turn.responsePurpose).success
        ? String(turn.responsePurpose) : turn.responsePurpose === undefined ? "missing" : "invalid";
    }
    const classifiedCare = turn.careDisposition === "referral" || turn.careDisposition === "emergency";
    // Explicit no-care classifications own inactive fields. Live structured
    // outputs can fill unused nullable strings with placeholders; presence alone
    // is not a clinical decision. Unclassified legacy care still fails closed.
    const requiredCare = !!turn.contactCare?.trim() && turn.careDisposition === undefined;
    if (turn.redFlag || classifiedCare || requiredCare) {
      selectedField = "care";
      diagnostic("safety_rejected_navigation", "safety_escalation");
      return finish(buildSafetyResponse({
        triggered: true, class: turn.careDisposition === "emergency" ? "emergency" : "escalate",
        reason: "concierge_care_escalation",
        suggestedResponse: turn.contactCare
          ? [...new Set([turn.message, turn.contactCare].filter(Boolean))].join("\n\n")
          : turn.redFlagReason ?? turn.message ?? undefined,
      }) as CoachResponse);
    }
    // Whole named requests bind reviewed UI records AFTER model/input care gates.
    // Educational and ordinary food/clinical questions never become consent.
    const diabeticExplanation = verifiedDiabeticBuilderExplanation(params.userMessage);
    if (diabeticExplanation) {
      selectedField = "verified_feature_explanation";
      return finish(envelope(diabeticExplanation));
    }
    const questionDestination = navigationDestinationQuestion(params.userMessage);
    if (questionDestination && params.tools.some(tool => tool.id === questionDestination)) {
      selectedField = "verified_destination_offer";
      const response = envelope(verifiedNavigationOffer(questionDestination));
      response.presentation!.navigation = {
        state: "recommendation_pending", destinationId: questionDestination,
        goal: navigationGoal(questionDestination), offeredAt: new Date().toISOString(),
      };
      return finish(response);
    }
    const namedRequest = explicitNavigationRequest(params.userMessage);
    const boundNamedRequest = namedRequest && params.tools.some(tool => tool.id === namedRequest)
      ? namedRequest : undefined;
    if (process.env.NODE_ENV === "development" && !boundNamedRequest && !namedRequest) {
      const complaint = isNavigationFailureComplaint(params.userMessage);
      const recovery = params.navigationRecoveryContext;
      const age = recovery?.offeredAt ? Date.now() - Date.parse(recovery.offeredAt) : NaN;
      const eligible = recovery && !recovery.performedAt && Number.isFinite(age) &&
        age >= 0 && age < NAVIGATION_RECOVERY_WINDOW_MS &&
        params.tools.some(tool => tool.id === recovery.destinationId) &&
        validateConciergeGoal({
          mode: "food_assistance", destinationId: recovery.destinationId, goal: recovery.goal,
        }, params.tools, memberMessages, {
          // Revalidate the server-loaded goal/name evidence, NOT current consent.
          acceptedPendingRecommendation: true,
        })?.destinationId === recovery.destinationId;
      const renewExpired = eligible && !pendingNavigationIsFresh(recovery.offeredAt) &&
        acceptsPendingFeature(params.userMessage);
      if (renewExpired || (eligible && complaintMatchesDestination(params.userMessage, recovery.destinationId))) {
        // Previously authorized, still-fresh actions can be displayed again after
        // a failed handoff. Expired actions ALWAYS need a new confirmation.
        const restoreAction = pendingNavigationIsFresh(recovery.offeredAt) &&
          recovery.state !== "recommendation_pending";
        const response = restoreAction
          ? envelope(verifiedNavigationText(recovery.destinationId), recovery.destinationId)
          : envelope(`${renewExpired ? "That earlier confirmation window has expired. " : ""}${verifiedNavigationOffer(recovery.destinationId)}`);
        response.presentation!.navigation = restoreAction ? recovery : {
          ...recovery, state: "recommendation_pending",
          offeredAt: pendingNavigationIsFresh(recovery.offeredAt) ? recovery.offeredAt : new Date().toISOString(),
        };
        selectedField = "verified_navigation_recovery";
        diagnostic(restoreAction ? "handoff_restored" : "navigation_confirmation_requested");
        return finish(response);
      }
      if (complaint) {
        // No valid matching context: don't guess from a complaint or search prose.
        selectedField = "unresolved_handoff_recovery";
        return finish(envelope("I couldn't complete that handoff. Which feature would you like to open?"));
      }
    }
    const acceptedStoredOffer = !namedRequest && params.pendingRecommendation &&
      isConfirmableNavigation(params.pendingRecommendation) && acceptsPendingFeature(params.userMessage);
    if (boundNamedRequest || acceptedStoredOffer) {
      const destinationId = boundNamedRequest ?? params.pendingRecommendation!.destinationId;
      turn.navigationIntent = boundNamedRequest ? "direct_request" : "confirmed";
      turn.conciergeDecision = {
        mode: "food_assistance", destinationId,
        goal: boundNamedRequest ? navigationGoal(destinationId) : params.pendingRecommendation!.goal,
      };
      turn.memberNeed = "navigation";
      turn.responsePurpose = "handoff";
      const includeSteps = !/\b(?:skip|without|no)\b[^.!?]{0,30}\binstructions\b/iu.test(params.userMessage);
      turn.handoffMessage = verifiedNavigationText(destinationId, includeSteps);
    }
    // A business starting-point offer grants no administrator permissions.
    const proposedBusiness = ConciergeDecisionSchema.safeParse(turn.conciergeDecision);
    const businessDestination = proposedBusiness.success ? proposedBusiness.data.destinationId : null;
    const businessActivity = proposedBusiness.success ? proposedBusiness.data.goal?.activity : undefined;
    if (!boundNamedRequest && !acceptedStoredOffer && proposedBusiness.success &&
      proposedBusiness.data.mode === "food_assistance" &&
      ((businessDestination === "business_suite" && businessActivity === "business") ||
        (businessDestination === "business_organization" && businessActivity === "manage_business")) &&
      params.tools.some(tool => tool.id === businessDestination)) {
      turn.memberNeed = "feature_help";
      turn.responsePurpose = "feature_only_offer";
      turn.navigationIntent = "recommendation";
      turn.message = verifiedNavigationOffer(businessDestination);
    }
    // The input emergency gate runs first in the engine, and model-detected
    // care above still wins. Do not add calls or let a closing phrase hide care.
    if (developmentPurpose && isUnambiguousChefClosing(params.userMessage)) {
      selectedField = "closing_acknowledgement";
      return finish(envelope(chefClosingAcknowledgement(params.preferredLanguage)));
    }
    stage = "decision";
    pendingDisposition = turn.pendingNavigationDisposition;
    const acceptingPending = turn.navigationIntent === "confirmed" && params.pendingRecommendation;
    if (developmentPurpose) {
      const inspected = inspectConversationPurpose(turn);
      if (!inspected.valid) {
        retainPendingOnFailure = !!acceptingPending && inspected.reason !== "purpose_conflict";
        // Screen the entire independent reply; never strip an unsafe offer out
        // of a field or rescue it with an unchecked recommendation variant.
        const continuation = rejectedContinuation(turn);
        diagnostic("purpose_rejected", inspected.reason);
        if (!continuation) throw new DecisionFailure(inspected.reason!);
        const response = envelope(continuation);
        if (retainPendingOnFailure && acceptingPending) response.presentation!.navigation = acceptingPending;
        return finish(response);
      }
    }
    if (turn.conciergeDecision == null && !acceptingPending) {
      if (developmentPurpose && turn.navigationIntent === "confirmed" && !params.pendingRecommendation) {
        // An honest "can't open" explanation is not an opening claim. Screen
        // every other clause unchanged; never remove an actual action or link.
        const continuation = rejectedContinuation(turn, text => conversationalContinuation(
          text?.replace(/\b(?:can't|cannot)\s+open\b/gi, "cannot access")) ? text ?? undefined : undefined);
        diagnostic("no_navigation", "missing_pending_recommendation");
        if (!continuation) selectedField = "retry";
        return finish(envelope(continuation ?? MISSING_PENDING_RECOVERY));
      }
      if (developmentPurpose) screening = {
        message: screenOrdinaryConversation(turn.message).reason,
        conversationMessage: screenConversationalContinuation(turn.conversationMessage).reason,
      };
      const message = (turn.navigationIntent === "recommendation" ? undefined : ordinaryConversation(turn.message)) ??
        conversationalContinuation(turn.conversationMessage);
      if (!message) throw new DecisionFailure("unusable_conversational_response");
      selectedField = ordinaryConversation(turn.message) === message ? "message" : "conversationMessage";
      diagnostic("no_navigation", turn.navigationIntent === "confirmed" ? "missing_pending_recommendation" : undefined);
      return finish(envelope(message), turn.navigationIntent === "none");
    }
    const rejectAction = (reason: DecisionReason, preservePending = false): CoachResponse => {
      retainPendingOnFailure = preservePending && !!acceptingPending;
      const message = developmentPurpose ? rejectedContinuation(turn) : conversationalContinuation(turn.conversationMessage);
      if (!message) {
        diagnostic("conversation_rejected", "unusable_conversational_response");
        throw new DecisionFailure(reason);
      }
      if (!developmentPurpose) selectedField = "conversationMessage";
      diagnostic("action_rejected_conversation_preserved", reason);
      // Neither the unchecked pitch nor its request text reaches display/persistence.
      const response = envelope(message);
      if (preservePending && acceptingPending) {
        response.presentation!.navigation = acceptingPending;
      }
      return finish(response);
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
      memberMessages, {
        completeMissingDestination: true,
        explicitNavigationDestination: boundNamedRequest,
        acceptedPendingRecommendation: !!acceptingPending &&
          acceptingPending.destinationId === parsedDecision.data.destinationId,
      });
    // Reject the action, not an independently valid conversational continuation.
    if (parsedDecision.data.destinationId && !decision?.destinationId) {
      return rejectAction(params.tools.some(tool => tool.id === parsedDecision.data.destinationId)
        ? "goal_not_ready" : "entitlement_rejected");
    }
    const destinationId = decision?.destinationId as NonNullable<CoachResponse["presentation"]>["destinationId"];
    if (!destinationId || !decision?.goal) {
      const message = ordinaryConversation(turn.message) ??
        conversationalContinuation(turn.conversationMessage);
      if (!message) throw new DecisionFailure("unusable_conversational_response");
      selectedField = ordinaryConversation(turn.message) === message ? "message" : "conversationMessage";
      if (developmentPurpose) diagnostic("no_navigation");
      return finish(envelope(message));
    }
    const confirmed = !!acceptingPending && acceptingPending.destinationId === destinationId &&
      !!independentConversation(params.userMessage, destinationId);
    // This is evidence binding, not a keyword router: the model still interprets
    // request vs mention/negation. An unnamed assistance request cannot qualify
    // for the explicit-feature exception, regardless of the model's intent tag.
    const direct = boundNamedRequest === destinationId || (turn.navigationIntent === "direct_request" &&
      decision.goal.explicitFeatureId === destinationId &&
      mentionsCoachDestination(params.userMessage, destinationId, process.env.NODE_ENV,
        params.navigationContext?.destinationId) &&
      !!independentConversation(params.userMessage, destinationId));
    if (!confirmed && !direct) {
      if (turn.navigationIntent === "confirmed" && !params.pendingRecommendation) {
        diagnostic("navigation_downgraded", "missing_pending_recommendation");
      } else if (turn.navigationIntent === "direct_request" || acceptingPending) {
        diagnostic("navigation_downgraded", "navigation_not_authorized");
      }
      // Reuse existing model wording only as a proposal, never as consent.
      // A primary reply must name the validated target so an unrelated question
      // cannot silently create a pending destination.
      const conciseOffer = turn.responsePurpose === "feature_only_offer" ||
        ((destinationId === "business_suite" || destinationId === "business_organization") &&
          turn.memberNeed === "feature_help");
      // Preserve a naturally brief offer; replace explanations, not every
      // acceptable wording. Never truncate clinical or nutrition guidance.
      const offerTooLong = !turn.message || turn.message.trim().split(/\s+/u).length > 40 ||
        /\n\s*\n/u.test(turn.message);
      let candidates = conciseOffer && offerTooLong ? [verifiedNavigationOffer(destinationId)] : developmentPurpose ? [turn.message] :
        [turn.recommendationMessage, turn.message, turn.conversationMessage];
      // Repair wording only after purpose, goal, destination and tool eligibility
      // validation. Never infer a destination from prose, repair unsafe text,
      // replace nutrition advice or turn an ordinary answer into an offer.
      if (process.env.NODE_ENV === "development" &&
        turn.responsePurpose === "feature_only_offer" && turn.navigationIntent === "recommendation" &&
        (!turn.message || !/[?？؟]/u.test(turn.message))) {
        const explanation = !/\b(?:opening|launching|navigating|redirecting|transferring|going to|go to)\b/i.test(turn.message ?? "")
          ? conversationalContinuation(turn.message) : undefined;
        const empty = !turn.message || fallbackQuality(turn.message) === "empty_closing";
        if (explanation || empty) {
          candidates = [explanation
            ? `${explanation}\n\n${verifiedNavigationOffer(destinationId)}`
            : verifiedNavigationOffer(destinationId)];
        }
      }
      const recommendation = candidates
        .map((text, index) => ({ text: independentConversation(text, destinationId), dedicated: index === 0 }))
        .find(({ text, dedicated }) => {
          if (!text || !/[?？؟]/u.test(text) ||
            (!dedicated && !mentionsCoachDestination(text, destinationId, process.env.NODE_ENV))) return false;
          // Only an explicit future permission QUESTION may say "take you
          // there"; a claim, transfer, URL or opening instruction still fails.
          const wording = developmentPurpose ? text.replace(
            /\b((?:want me to|would you like me to|shall I|should I|may I)\s+)take you there(?=\s*[?？؟])/gi,
            "$1continue") : text;
          return !!conversationalContinuation(wording.replace(/\b(?:open|use)\b/gi, ""), true);
        });
      if (!recommendation) {
        // The canonical answer can stand without an offer. Never append or
        // substitute the shorter recommendationMessage to manufacture one.
        const answer = developmentPurpose && conversationalContinuation(turn.message);
        if (answer) {
          selectedField = "message";
          diagnostic("answer_preserved_without_action", "missing_recommendation_wording");
          return finish(envelope(answer));
        }
        return rejectAction("missing_recommendation_wording");
      }
      if (!recommendation.dedicated) diagnostic("recommendation_recovered", "missing_recommendation_wording");
      const response = envelope(recommendation.text!);
      response.presentation!.navigation = {
        state: "recommendation_pending", destinationId, goal: decision.goal,
        offeredAt: new Date().toISOString(),
      };
      selectedField = developmentPurpose || !recommendation.dedicated ? "message" : "recommendationMessage";
      diagnostic("recommendation_pending");
      return finish(response);
    }
    // Consent, readiness, destination and current entitlement have already been
    // validated above. Missing model wording must not ask for that consent again.
    // Recovery changes text ONLY, never destination or authorization.
    // Unsafe links or mismatched destinations remain rejected; this recovery is
    // for absent/unusable wording and repeat permission, not rejected content.
    if (!boundNamedRequest && !acceptedStoredOffer && turn.handoffMessage && /[\p{L}\p{N}]/u.test(turn.handoffMessage) &&
      !independentConversation(turn.handoffMessage, destinationId)) {
      return rejectAction("missing_handoff_wording", !!confirmed);
    }
    const reviewedHandoff = !!boundNamedRequest || !!acceptedStoredOffer;
    // Consent and readiness have already been validated. Entry directions are
    // reviewed UI facts, not model-authored workflow instructions.
    const handoff = verifiedNavigationText(destinationId,
      !/\b(?:skip|without|no)\b[^.!?]{0,30}\binstructions\b/iu.test(params.userMessage));
    if (!handoff) return rejectAction("missing_handoff_wording", !!confirmed);
    const completed = !!destinationId && !parsedDecision.data.destinationId;
    if (completed && !reviewedHandoff &&
      !independentConversation(turn.handoffMessage ?? turn.message, destinationId)) {
      return rejectAction("decision_invalid");
    }
    diagnostic(completed ? "completed_from_goal" : "validated_destination");
    const request = groundedCreatorRequest(turn.creatorRequest, destinationId, memberMessages);
    // Keep the model's wording when completing a verified action, rather than
    // substituting a stock pitch. Completion cannot authorize a different tool
    // named in the reply or an arbitrary link.
    const recommendation = completed && !reviewedHandoff ? independentConversation(handoff, destinationId) : handoff;
    if (!recommendation) return rejectAction("decision_invalid");
    const message = destinationId === "create_a_dish" && rawTurn.creatorRequest != null && !request
      ? `${recommendation}\n\nI couldn't verify the request text for transfer. You can enter it in Create a Dish.`
      : recommendation;
    const response = envelope(message, destinationId, request);
    response.presentation!.navigation = {
      state: confirmed ? "navigation_confirmed" : "direct_navigation", destinationId, goal: decision.goal,
      offeredAt: confirmed && acceptingPending
        ? acceptingPending.offeredAt ?? new Date().toISOString() : new Date().toISOString(),
    };
    selectedField = reviewedHandoff ? "verified_handoff_recovery" :
      handoff === turn.handoffMessage ? "handoffMessage" : "verified_handoff_recovery";
    diagnostic(response.presentation!.navigation.state);
    return finish(response);
  } catch (error) {
    // Static outcome only: never log the conversation, clinical context or provider payload.
    const outcome = error instanceof DecisionFailure ? error.reason : "response_unavailable";
    const status = stage === "provider" && error && typeof error === "object" && "status" in error &&
      typeof error.status === "number" && error.status >= 400 && error.status <= 599 ? error.status : undefined;
    console.warn(`[ChefConcierge] decision_outcome=${outcome} failure_stage=${stage}${status ? ` provider_status=${status}` : ""}${correlation}`);
    if (developmentPurpose) { selectedField = "retry"; diagnostic("response_rejected", error instanceof DecisionFailure ? error.reason : undefined); }
    const response = envelope(developmentPurpose && error instanceof DecisionFailure
      ? !params.pendingRecommendation && contract?.navigationIntent === "confirmed"
        ? MISSING_PENDING_RECOVERY
        : contract?.navigationIntent === "none" && !contract.decisionPresent
          ? CONVERSATION_RECOVERY : HANDOFF_RECOVERY
      : "I couldn't complete that response. Please try your request again.");
    if (retainPendingOnFailure && error instanceof DecisionFailure &&
      ["missing_handoff_wording", "purpose_missing", "purpose_invalid"].includes(error.reason) &&
      params.pendingRecommendation && params.pendingRecommendation.state === "recommendation_pending") {
      response.presentation!.navigation = params.pendingRecommendation;
    }
    response.meta.concierge = { revision: CHEF_CONCIERGE_REVISION, reasoning: "unavailable", rendering: "retry" };
    return finish(response);
  }
}
