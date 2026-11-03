import { runConciergeConversation } from "../../server/services/coaching/conciergeConversation";
import { getCornerCapabilities } from "../../server/services/coaching/capabilityRegistry";
import { buildSafetyResponse, runSafetyGate } from "../../server/services/coaching/safety";
import { createReviewContext, type ReviewFixture } from "./fixtures";

type ConversationClient = Parameters<typeof runConciergeConversation>[0]["client"];
type Pending = Parameters<typeof runConciergeConversation>[0]["pendingRecommendation"];
type Response = Awaited<ReturnType<typeof runConciergeConversation>>;
type Message = { role: string; content: string };
export const MAX_REVIEW_TURNS = 10;

export function requireReviewDevelopment() {
  if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT) {
    throw new Error("Ask Chef review is restricted to unpublished Development processes");
  }
}

/** No singleton/session store, persistence, account adapters or summary workers.
 * The caller must supply a provider; this module never constructs a paid client. */
export function createReviewSession(options: { fixture: ReviewFixture; client: ConversationClient }) {
  requireReviewDevelopment();
  const context = createReviewContext(options.fixture);
  const history: Message[] = [];
  let pendingRecommendation: Pending;
  let inFlight = false;
  let turns = 0;
  return {
    transcript: () => structuredClone(history),
    async send(userMessage: string): Promise<Response> {
      requireReviewDevelopment();
      if (!userMessage.trim() || userMessage.length > 2000) throw new Error("Review messages must contain 1–2000 characters");
      if (inFlight) throw new Error("A review turn is already in progress");
      if (turns >= MAX_REVIEW_TURNS) throw new Error("Review turn limit reached; create a new isolated session");
      inFlight = true;
      try {
        // Preserve the existing pre-model emergency gate as well as the normal
        // conversation function's food, care and navigation validation.
        const safety = await runSafetyGate(userMessage, []);
        const response = safety.triggered
          ? buildSafetyResponse(safety) as Response
          : await runConciergeConversation({
            client: options.client, userMessage, history: structuredClone(history),
            rollingContext: null, pendingRecommendation,
            context: structuredClone(context),
            tools: getCornerCapabilities(["all"]).map(cap => ({
              ...cap, scope: "adult" as const, featureTarget: cap.id,
            })),
            knowledgeAccess: { organizationAdmin: false, professional: false },
            preferredLanguage: "en",
          });
        const navigation = response.presentation?.navigation;
        pendingRecommendation = navigation?.state === "recommendation_pending"
          ? structuredClone(navigation) : undefined;
        const care = response.todayPlan?.items.filter(item => item.kind === "contact_care")
          .map(item => item.text).join("\n\n");
        const displayed = care || response.presentation?.message ||
          [response.whatIFound, response.whatItCouldMean].filter(Boolean).join("\n\n");
        history.push({ role: "user", content: userMessage }, { role: "assistant", content: displayed });
        turns++;
        return structuredClone(response);
      } finally {
        inFlight = false;
      }
    },
  };
}

/** Deliberately artificial responses: tests plumbing, never model adherence. */
export function reviewAnswer(message: string) {
  return {
    message, memberNeed: "nutrition_guidance", responsePurpose: "answer",
    navigationIntent: "none", conciergeDecision: null, redFlag: false,
    careDisposition: "none", conversationMessage: null, handoffMessage: null,
    recommendationMessage: null, creatorRequest: null, contactCare: null, redFlagReason: null,
    foodDeclarations: {
      message: { mode: "none", foods: [] }, conversationMessage: null, handoffMessage: null,
    },
  };
}

export function injectedReviewClient(replies: ReadonlyArray<Record<string, unknown>>): ConversationClient {
  let index = 0;
  return { chat: { completions: { create: async () => {
    const reply = replies[index++];
    if (!reply) throw new Error("No injected review response remains");
    return { choices: [{ message: { content: JSON.stringify(reply) } }] };
  } } } } as unknown as ConversationClient;
}
