// Mocked response contracts only: never bootstrap, access a database or call AI.
jest.mock("../db", () => ({ db: { execute: jest.fn(() => { throw new Error("Unexpected database access"); }) } }));
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { CHEF_CONVERSATION_INSTRUCTIONS, getChefConversationInstructions } from "../services/coaching/conciergeInstructions";
import { FEATURE_USAGE_KNOWLEDGE, getFeatureUsageKnowledge } from "../services/coaching/featureUsageKnowledge";
import { COACH_DESTINATIONS } from "../../shared/coaching/navigation";
import { verifiedNavigationText } from "../../shared/coaching/navigationGuidance";

const environment = process.env.NODE_ENV;
beforeEach(() => { process.env.NODE_ENV = "development"; });
afterAll(() => { process.env.NODE_ENV = environment; });

const cases = [
  {
    id: "sushi_creator" as const,
    request: "Open Sushi Creator",
    goal: { activity: "prepare", occasion: "unknown", restaurant: "unknown",
      dishChosen: true, specialty: "sushi", explicitFeatureId: "sushi_creator" },
    text: "Open Sushi Creator to start making your sushi. Choose a style such as rolls, nigiri or a sushi bowl, adjust your dietary preference and servings if needed, then select Create My Sushi.",
  },
  {
    id: "create_a_dish" as const,
    request: "Open Create a Dish for vegetable soup",
    goal: { activity: "prepare", occasion: "meal", restaurant: "unknown",
      dishChosen: true, specialty: "none", explicitFeatureId: "create_a_dish" },
    text: "Open Create a Dish and review your vegetable soup description. You can adjust the diet, cuisine and cooking method, such as Stovetop or Oven, then select Create My Dish.",
  },
];

test("Development handoffs explain relevant verified controls then stop without a sign-off", () => {
  const instructions = getChefConversationInstructions("development");
  const handoff = instructions.split("\n").find(line => line.startsWith("CONFIRMED NAVIGATION:"))!;
  expect(handoff).toContain("both confirmed and qualifying direct handoffs");
  expect(handoff).toContain("a few relevant starting actions or optional controls");
  expect(handoff).toContain("not controls borrowed from another creator");
  expect(handoff).toContain("Keep natural warmth");
  expect(handoff).toContain("end the reply naturally");
  expect(handoff).toContain("no appended sign-off");
  expect(handoff).toContain("skip a tutorial if the member asks");
  expect(handoff).toContain("never remove necessary clinical safety guidance");
  // This is a generative instruction, not a runtime phrase-deletion mechanism.
  expect(handoff).not.toContain("Enjoy your culinary adventure");
});

test("Development creator facts match actual distinct controls without changing Production knowledge", () => {
  const usage = getFeatureUsageKnowledge("development");
  expect(usage.sushi_creator?.controls).toEqual(expect.arrayContaining([
    expect.stringContaining("Roll, Nigiri, Sashimi, Sushi Bowl"),
    "Optional Dietary Preference.",
    "Number of Servings: 1–10 recipe servings.",
    "Flavor Preference.",
  ]));
  expect(usage.sushi_creator?.descriptionInput).toContain("optional text field");
  expect(usage.sushi_creator?.generationAction).toContain("Create My Sushi");
  expect(usage.sushi_creator?.controls.join(" ")).not.toMatch(/cuisine|stovetop|oven/i);
  expect(usage.create_a_dish?.controls.join(" ")).toContain("diet and cuisine overrides");
  expect(usage.create_a_dish?.controls.join(" ")).toContain("Stovetop and Oven");
  expect(usage.create_a_dish?.generationAction).toContain("Create My Dish");
  expect(getFeatureUsageKnowledge("production")).toEqual(getFeatureUsageKnowledge("development"));
  expect(getChefConversationInstructions("production")).toBe(getChefConversationInstructions("development"));
  expect(FEATURE_USAGE_KNOWLEDGE.create_a_dish?.controls.join(" ")).not.toContain("diet and cuisine overrides");
});

describe.each(cases)("$id concise handoff", example => {
  test.each(["confirmed", "direct_request"] as const)("%s retains the existing authorized button and complete reply", async intent => {
    const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      memberNeed: "navigation", responsePurpose: "handoff", navigationIntent: intent,
      message: example.text, handoffMessage: example.text, recommendationMessage: null, conversationMessage: null,
      conciergeDecision: { mode: "food_assistance", destinationId: example.id, goal: example.goal },
      creatorRequest: example.id === "create_a_dish" ? { idea: "vegetable soup", memberTurns: [0] } : null,
      redFlag: false, redFlagReason: null, contactCare: null, careDisposition: "none",
    }) } }] });
    const result = await runConciergeConversation({
      client: { chat: { completions: { create } } } as any,
      userMessage: intent === "confirmed" ? "Yes" : example.request,
      history: intent === "confirmed" ? [{ role: "user", content: example.request }] : [],
      rollingContext: null, context: {},
      pendingRecommendation: intent === "confirmed" ? {
        state: "recommendation_pending", destinationId: example.id, goal: example.goal as any,
      } : undefined,
      tools: [{ id: example.id, label: COACH_DESTINATIONS[example.id].label, description: "Verified creator.",
        featureTarget: example.id, scope: "adult" }],
    });
    expect(create).toHaveBeenCalledTimes(1);
    const call = create.mock.calls[0][0];
    expect(call.messages[0].content).toContain(getChefConversationInstructions("development"));
    const wire = JSON.parse(call.messages[1].content);
    expect(wire.platformKnowledge.featureUsage[example.id]).toEqual(getFeatureUsageKnowledge("development")[example.id]);
    // Only the whole named Sushi command is bound by reviewed navigation.
    // The soup request retains semantic interpretation and grounded dish text.
    const expected = verifiedNavigationText(example.id);
    expect(result.presentation?.message).toBe(expected);
    expect(result.whatIFound).toBe(expected);
    expect(result.presentation?.navigation?.state).toBe(intent === "confirmed" ? "navigation_confirmed" : "direct_navigation");
    expect(result.presentation?.destinationId).toBe(example.id);
    expect(result.todayPlan.items).toEqual([expect.objectContaining({ kind: "use_feature", destinationId: example.id })]);
  });
});
