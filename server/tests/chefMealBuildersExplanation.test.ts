jest.mock("../db", () => ({
  db: { execute: jest.fn(() => { throw new Error("Unexpected database access"); }) },
}));
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { verifiedMealBuildersExplanation } from "../services/coaching/verifiedNavigation";
import { fallbackQuality, selectRejectedConversation } from "../services/coaching/conciergeFallback";
import { screenConversationalContinuation } from "../services/coaching/conciergeReplyScreening";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";

const oldEnvironment = process.env.NODE_ENV;
beforeEach(() => { process.env.NODE_ENV = "development"; });
afterAll(() => { process.env.NODE_ENV = oldEnvironment; });
const closing = ": If you have any more questions about using Meal Builders or need further assistance, feel free to ask!";
const useful = "Choose a day and meal slot, then select Create With Chef.";
const tools = getCornerCapabilities(["all"]).map(cap => ({ ...cap, scope: "adult" as const, featureTarget: cap.id }));
const unknown = { activity: "unknown", occasion: "unknown", restaurant: "unknown",
  dishChosen: false, specialty: "none", explicitFeatureId: null };
async function run(raw: Record<string, unknown>, extra: Record<string, unknown> = {}, question = "How do I use Meal Builders?") {
  const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    message: "To use Meal Builders, open the landing page, choose a day and a meal slot, then select Create With Chef.",
    conversationMessage: closing, navigationIntent: "none", pendingNavigationDisposition: "clear",
    memberNeed: "feature_help", responsePurpose: "answer", conciergeDecision: null,
    redFlag: false, careDisposition: "none", ...raw,
  }) } }] });
  const response = await runConciergeConversation({
    client: { chat: { completions: { create } } } as any, tools,
    userMessage: question, history: [], rollingContext: null,
    context: { chefFoodCompatibility: { subjectUserId: "synthetic-self" } }, ...extra,
  });
  expect(create).toHaveBeenCalledTimes(1);
  return response;
}

test.each([undefined, null, ":)", closing])("education survives unusable inactive continuation %s and its food declarations", async conversationMessage => {
  const response = await run({
    conversationMessage,
    foodDeclarations: { message: { mode: "none", foods: [] }, conversationMessage: null, handoffMessage: null },
  });
  expect(response.presentation?.message).toBe(verifiedMealBuildersExplanation("How do I use Meal Builders?"));
  expect(response.presentation?.message).toContain("app navigation");
  expect(response.presentation?.message).toContain("assigned builder");
  expect(response.presentation?.message).toContain("required setup");
  expect(response.presentation?.message).toContain("day and a meal slot");
  expect(response.presentation?.message).toContain("Create With Chef");
  expect(response.presentation?.message).toContain("Subscription");
  expect(response.presentation?.destinationId).toBeUndefined();
  expect(response.presentation?.navigation).toBeUndefined();
  expect(response.presentation?.creatorRequest).toBeUndefined();
  expect(response.todayPlan.items).toEqual([]);
  expect(response.foodCompatibility).toBeUndefined();
});

test("the exact observed generic closing is never a useful independent explanation", async () => {
  expect(fallbackQuality(closing)).toBe("acknowledgment");
  const selection = selectRejectedConversation({ message: ":", conversationMessage: closing },
    text => screenConversationalContinuation(text).text);
  expect(selection.text).toBeUndefined();
  const response = await run({ message: closing, conversationMessage: ":)" });
  expect(response.presentation?.message).toContain("Create With Chef");
  expect(response.presentation?.message).not.toContain("feel free to ask");
});

test("a useful answer ending with a closing is not rejected as closing-only", () => {
  expect(fallbackQuality(`${useful} If you have more questions, feel free to ask!`)).toBe("useful");
});

test("a stale restaurant offer does not become authority to open a builder", async () => {
  const response = await run({}, {
    history: [{ role: "user", content: "I need to eat at a restaurant." },
      { role: "assistant", content: "Would you like to find a restaurant?" }],
    pendingRecommendation: { state: "recommendation_pending", destinationId: "find_meals_near_me",
      goal: unknown, offeredAt: new Date().toISOString() },
  });
  expect(response.presentation?.message).toContain("Create With Chef");
  expect(response.presentation?.navigation).toBeUndefined();
  expect(response.presentation?.destinationId).toBeUndefined();
});

test("care escalation wins over educational recovery", async () => {
  const response = await run({ redFlag: true, careDisposition: "emergency", contactCare: "Seek urgent medical help now." });
  expect(response.meta.redFlag).toBe(true);
  expect(response.presentation?.destinationId).toBeUndefined();
  expect(response.presentation).toBeUndefined();
});

test.each(["How can I use Meal Builders?", "Please explain how to use Meal Builders.",
  "How do Meal Builders work?"])("recognizes bounded educational wording: %s", question => {
  expect(verifiedMealBuildersExplanation(question)).toContain("Create With Chef");
});

test.each(["Open Meal Builders.", "How do I use Meal Builders with my milk allergy?",
  "How do I use Meal Builders and change my macro targets?", "Don't explain how to use Meal Builders.",
  "Compare Meal Builders and Create a Dish."])("does not replace other intents: %s", question => {
  expect(verifiedMealBuildersExplanation(question)).toBeUndefined();
});

test("verified location recovery is not attributed to an inactive model food field", async () => {
  const response = await run({
    message: "Open Shopping List to find Fridge Rescue.", conversationMessage: null,
    foodDeclarations: { message: { mode: "none", foods: [] }, conversationMessage: null, handoffMessage: null },
  }, {}, "How can Fridge Rescue help?");
  expect(response.presentation?.message).toContain("Lifestyle → Fridge Rescue");
  expect(response.presentation?.message).not.toContain("couldn't reliably check");
  expect(response.foodCompatibility).toBeUndefined();
  expect(response.presentation?.destinationId).toBeUndefined();
});

test("non-platform food replies still fail closed when evidence is unavailable", async () => {
  const response = await run({
    message: "Try a milk shake.", conversationMessage: null,
    foodDeclarations: { message: { mode: "recommendations", foods: [
      { name: "milk shake", ingredients: ["milk"], ingredientCoverage: "listed" },
    ] }, conversationMessage: null, handoffMessage: null },
  }, {}, "What should I drink?");
  expect(response.presentation?.message).not.toContain("Try a milk shake");
  expect(response.foodCompatibility?.status).toBe("unavailable");
});

test("Production retains its existing explanation handling", async () => {
  process.env.NODE_ENV = "production";
  const response = await run({ message: useful, conversationMessage: null });
  expect(response.presentation?.message).toBe(useful);
});
