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
import { COACH_DESTINATIONS, type CoachDestinationId } from "../../../shared/coaching/navigation";
import { CORNER_UNSUPPORTED_FEATURES } from "./capabilityRegistry";
import type { ChefCreatorRequest } from "../../../shared/coaching/creatorRequest";
import { getDevelopmentPlatformKnowledge, PLATFORM_GUIDANCE_INSTRUCTIONS } from "./platformKnowledge";

const TurnSchema = ConciergeMessageSchema.extend({
  // Semantic consent is separate from choosing a suitable food destination.
  // Unknown/missing values cannot authorize a button.
  navigationIntent: z.unknown().optional(),
  // An independent, model-authored continuation must survive a rejected action.
  conversationMessage: z.string().trim().min(1).max(8000).optional().catch(undefined),
  // Validate after safety escalation: malformed navigation must never erase care.
  conciergeDecision: z.unknown().optional(),
  redFlag: z.boolean().default(false),
  redFlagReason: z.string().max(1000).nullish().transform(value => value ?? undefined),
  contactCare: z.string().max(1000).nullish().transform(value => value ?? undefined),
  creatorRequest: CreatorRequestEvidenceSchema.optional().catch(undefined),
});

const destinationIds = Object.keys(COACH_DESTINATIONS) as [CoachDestinationId, ...CoachDestinationId[]];
// Provider-enforced structure, not another reasoning/rendering pass. Nullable
// fields are explicit because strict structured output requires every key.
const ModelTurnSchema = z.object({
  message: z.string(),
  conversationMessage: z.string(),
  navigationIntent: z.enum(["none", "recommendation", "confirmed", "direct_request"]),
  conciergeDecision: z.object({
    mode: z.enum(["food_assistance", "nutrition_education", "behavioral_coaching", "clarification"]),
    destinationId: z.enum(destinationIds).nullable(),
    goal: ConciergeGoalSchema.extend({ explicitFeatureId: z.enum(destinationIds).nullable() }),
  }).nullable(),
  creatorRequest: z.object({ idea: z.string(), memberTurns: z.array(z.number().int()) }).nullable(),
  redFlag: z.boolean(),
  redFlagReason: z.string().nullable(),
  contactCare: z.string().nullable(),
});

/** Output isolation, not intent routing: never reuse a rejected feature pitch. */
function independentConversation(message: string | undefined, allowedDestinationId?: CoachDestinationId): string | undefined {
  if (!message) return undefined;
  const lower = message.toLocaleLowerCase();
  // Match longer labels first: "Athlete Beverage Creator" includes "Beverage
  // Creator", but authorizing one must not authorize an additional other tool.
  let remaining = lower;
  for (const [id, destination] of Object.entries(COACH_DESTINATIONS)
    .sort((a, b) => b[1].label.length - a[1].label.length)) {
    const label = destination.label.toLocaleLowerCase();
    if (remaining.includes(label)) {
      if (id !== allowedDestinationId) return undefined;
      remaining = remaining.split(label).join("");
    }
    if (lower.includes(destination.route)) return undefined;
  }
  if (/https?:\/\/|www\.|javascript:|data:|href\s*=|\]\s*\(|(?:^|\s)\/[a-z]/i.test(message)) return undefined;
  return message;
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
}): Promise<CoachResponse> {
  const memberMessages = [...params.history.filter(m => m.role === "user").map(m => m.content), params.userMessage];
  let stage: "provider" | "parsing" | "decision" = "provider";
  try {
    const completion = await params.client.chat.completions.create({
      model: "gpt-4o", response_format: zodResponseFormat(ModelTurnSchema, "chef_conversation"),
      temperature: 0.4, max_tokens: 1500,
      messages: [
        { role: "system", content: [
          CHEF_CONVERSATION_INSTRUCTIONS,
          getLanguageInstruction(params.preferredLanguage),
          PLATFORM_GUIDANCE_INSTRUCTIONS,
        ].filter(Boolean).join("\n") },
        { role: "user", content: JSON.stringify({
          authorizedNutritionContext: params.context.coachingContextBlock ?? params.context,
          availableFeatures: params.tools.map(({ id, label, description }) => ({ id, label, description })),
          platformKnowledge: getDevelopmentPlatformKnowledge(),
          unsupportedFeatures: CORNER_UNSUPPORTED_FEATURES,
          earlierConversation: params.rollingContext,
          history: params.history,
          latestMemberMessage: params.userMessage,
          memberStatements: memberMessages.map((text, index) => ({ index, text })),
        }) },
      ],
    });
    stage = "parsing";
    const turn = TurnSchema.parse(JSON.parse(completion.choices[0]?.message?.content ?? "{}"));
    if (turn.redFlag || turn.contactCare) {
      return buildSafetyResponse({
        triggered: true, class: "escalate", reason: "concierge_care_escalation",
        suggestedResponse: turn.contactCare ? `${turn.message}\n\n${turn.contactCare}` : turn.redFlagReason ?? turn.message,
      }) as CoachResponse;
    }
    stage = "decision";
    if (turn.conciergeDecision == null) {
      console.info("[ChefConcierge] decision_outcome=no_navigation");
      return envelope(turn.message);
    }
    const rejectAction = (reason: "decision_invalid" | "goal_not_ready" | "navigation_not_authorized"): CoachResponse => {
      const message = independentConversation(turn.conversationMessage);
      if (!message) throw new Error(reason);
      console.info(`[ChefConcierge] decision_outcome=action_rejected_conversation_preserved reason=${reason}`);
      // Neither the unchecked pitch nor its request text reaches display/persistence.
      return envelope(message);
    };
    const parsedDecision = ConciergeDecisionSchema.safeParse(turn.conciergeDecision);
    if (!parsedDecision.success) return rejectAction("decision_invalid");
    if (turn.navigationIntent === "recommendation" || turn.navigationIntent === "none") {
      console.info("[ChefConcierge] decision_outcome=recommendation_without_navigation");
      return envelope(turn.message);
    }
    if (turn.navigationIntent !== "confirmed" && turn.navigationIntent !== "direct_request") {
      return rejectAction("navigation_not_authorized");
    }
    const decision = validateConciergeGoal(parsedDecision.data, params.tools,
      memberMessages, { completeMissingDestination: true });
    // Reject the action, not an independently valid conversational continuation.
    if (parsedDecision.data.destinationId && !decision?.destinationId) return rejectAction("goal_not_ready");
    const destinationId = decision?.destinationId as NonNullable<CoachResponse["presentation"]>["destinationId"];
    const completed = !!destinationId && !parsedDecision.data.destinationId;
    console.info(`[ChefConcierge] decision_outcome=${completed ? "completed_from_goal" : destinationId ? "validated_destination" : "no_navigation"}`);
    const request = groundedCreatorRequest(turn.creatorRequest, destinationId, memberMessages);
    // Keep the model's wording when completing a verified action, rather than
    // substituting a stock pitch. Completion cannot authorize a different tool
    // named in the reply or an arbitrary link.
    const recommendation = completed ? independentConversation(turn.message, destinationId) : turn.message;
    if (!recommendation) return rejectAction("decision_invalid");
    const message = destinationId === "create_a_dish" && !request
      ? `${recommendation}\n\nI couldn't verify the request text for transfer. You can enter it in Create a Dish.`
      : recommendation;
    return envelope(message, destinationId, request);
  } catch (error) {
    // Static outcome only: never log the conversation, clinical context or provider payload.
    const outcome = stage === "decision" && error instanceof Error && ["decision_invalid", "goal_not_ready"].includes(error.message)
      ? error.message : "response_unavailable";
    const status = stage === "provider" && error && typeof error === "object" && "status" in error &&
      typeof error.status === "number" && error.status >= 400 && error.status <= 599 ? error.status : undefined;
    console.warn(`[ChefConcierge] decision_outcome=${outcome} failure_stage=${stage}${status ? ` provider_status=${status}` : ""}`);
    const response = envelope("I couldn't complete that response. Please try your request again.");
    response.meta.concierge = { revision: CHEF_CONCIERGE_REVISION, reasoning: "unavailable", rendering: "retry" };
    return response;
  }
}
