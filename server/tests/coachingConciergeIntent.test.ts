// Deterministic provider fixtures exercise the real two-pass prompt/selection code.
// They do not establish that a live model understands these requests correctly.
jest.mock("../db", () => ({ db: { execute: jest.fn() } }));
jest.mock("../services/coaching/adapters", () => ({ getAdapter: jest.fn() }));
jest.mock("../services/coaching/observers/stubs", () => ({
  runObservers: jest.fn(), selectObservers: jest.fn(),
}));
jest.mock("../services/coaching/patternMatcher", () => ({ matchPatterns: jest.fn() }));
jest.mock("../services/coaching/conversationSummarizer", () => ({ loadBoundedHistory: jest.fn() }));
jest.mock("../services/coaching/memoryExtractor", () => ({ extractAndPersistMemories: jest.fn() }));
jest.mock("../services/coaching/reasoningFamilyMatcher", () => ({
  matchReasoningFamily: jest.fn(), renderReasoningBriefForPrompt: jest.fn(),
}));
const mockCreate = jest.fn();
jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ chat: { completions: { create: mockCreate } } })),
}));

import { runReasoningPass, runRenderingPass } from "../services/coaching/engine";
import { ConciergeDecisionSchema, ReasoningResultSchema, type ConciergeDecision } from "../../shared/coaching/schemas";
import { COACH_DESTINATIONS } from "../../shared/coaching/navigation";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";

const oldEnvironment = process.env.NODE_ENV;
beforeEach(() => { process.env.NODE_ENV = "development"; mockCreate.mockReset(); });
afterAll(() => { process.env.NODE_ENV = oldEnvironment; });
const confidence = {
  level: "low" as const, coverageScore: 0, evidenceSatisfied: [], evidenceMissing: [],
  hasConflict: false, suppressCausal: true,
};
const tools = () => getCornerCapabilities(["all"]).map(cap => ({
  id: cap.id, label: cap.label, description: cap.description, featureTarget: cap.id,
}));
const reasoning = (decision?: ConciergeDecision) => ({
  primaryConcern: "Help with the member's current request.",
  hypotheses: [{
    explanation: "Provide assistance appropriate to the member's request.",
    evidenceCitationIds: [], likelihood: "most_likely",
  }],
  leadHypothesis: "Respond to the current request without unrelated interpretation.",
  proposedConfidence: "low", redFlag: false, missingData: [],
  ...(decision ? { conciergeDecision: decision } : {}),
});
const response = (destinationId: string | null, overrides: Record<string, unknown> = {}) => ({
  whatIFound: "That sounds good. I can help you with that.",
  whatItCouldMean: "Choose the option that suits what you want to make.",
  todayPlan: {
    why: "Here is a relevant next step for your request.",
    items: [{
      horizon: "today", kind: destinationId ? "use_feature" : "other",
      text: destinationId ? "Open the appropriate feature" : "Continue our conversation",
      ...(destinationId ? { featureTarget: destinationId } : {}),
    }],
    successMetric: "You got help with your request.",
    nextCheckIn: "Whenever you need more help",
  },
  learningOpportunity: null,
  ...overrides,
});
function enqueue(value: unknown) {
  mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(value) } }] });
}
async function render(decision?: ConciergeDecision, userMessage = "I want sushi.") {
  return runRenderingPass({
    userMessage, reasoning: reasoning(decision),
    styleResolution: { mode: "encouragement", instructions: "Be warm and direct." },
    confidence, patterns: [], additionalContext: {}, availableTools: tools(), specialization: "corner",
  });
}
async function reason(userMessage: string, history: Array<{ role: string; content: string }> = []) {
  return runReasoningPass({
    userMessage, history, evidence: [], patterns: [], confidence,
    coachingMemories: [], nutritionMemories: [], additionalContext: {},
    specialization: "corner", availableTools: tools(),
  });
}

test.each([
  ["I want sushi.", "sushi_creator"],
  ["I'm craving cheesecake.", "dessert_creator"],
  ["I want a smoothie.", "beverage_creator"],
  ["I want a cocktail.", "beverage_creator"],
  ["I need a pre-workout drink.", "athlete_beverage_creator"],
  ["I need a post-workout recovery shake.", "athlete_beverage_creator"],
  ["I feel dehydrated.", "hydration_center"],
  ["I'm going out to eat.", "restaurant_guide"],
  ["I know what food I want but not where to get it.", "find_meals_near_me"],
  ["I'm at a buffet.", "my_perfect_buffet"],
  ["I want to make lasagna.", "create_a_dish"],
])("two-pass fixture retains the selected destination for %s", async (message, id) => {
  const decision = ConciergeDecisionSchema.parse({ mode: "food_assistance", destinationId: id });
  enqueue(reasoning(decision));
  const first = await reason(message);
  const firstPrompt = mockCreate.mock.calls[0][0];
  expect(firstPrompt.model).toBe("gpt-4o");
  expect(firstPrompt.messages[0].content).toContain("INTENT FIRST");
  expect(firstPrompt.messages[1].content).toContain(message);
  expect(firstPrompt.messages[1].content).toContain("AVAILABLE CONCIERGE FEATURES");
  expect(firstPrompt.messages[1].content).toContain('"sushi_creator"');
  enqueue(response(id));
  const result = await render(first.conciergeDecision, message);
  expect(result.todayPlan.items[0].destinationId).toBe(id);
  expect(result.learningOpportunity).toBeNull();
  expect(mockCreate).toHaveBeenCalledTimes(2);
  const renderingPrompt = mockCreate.mock.calls[1][0];
  expect(renderingPrompt.messages[1].content).toContain(`LATEST MEMBER MESSAGE: ${message}`);
  expect(renderingPrompt.messages[0].content).toContain("you may NOT select another destination");
  expect(JSON.stringify(result)).not.toMatch(/deficien|missing.*log|stress|emotional eating/i);
});

test("renderer cannot switch a sushi decision to Craving Creator", async () => {
  enqueue(response("craving_creator"));
  enqueue(response("sushi_creator"));
  const result = await render({ mode: "food_assistance", destinationId: "sushi_creator" });
  expect(mockCreate).toHaveBeenCalledTimes(2);
  expect(result.todayPlan.items[0].destinationId).toBe("sushi_creator");
});

test("nutrition education retains a useful answer and removes forced navigation", async () => {
  const education = response("sushi_creator", {
    whatIFound: "Sushi can be part of a balanced meal; its nutrition depends on the ingredients and preparation.",
    whatItCouldMean: "Fish can provide protein; rice contributes carbohydrates. Soy sauce can add sodium, while tempura and creamy sauces add fat. Cooked fish or vegetable rolls are alternatives to raw fish.",
  });
  education.todayPlan.items.push({ horizon: "today", kind: "other", text: "Compare ingredients and preparation." });
  enqueue(education);
  const result = await render({ mode: "nutrition_education", destinationId: null }, "Is sushi healthy?");
  expect(JSON.stringify(result)).toMatch(/protein/);
  expect(JSON.stringify(result)).toMatch(/carbohydrate/);
  expect(JSON.stringify(result)).toMatch(/sodium/);
  expect(result.todayPlan.items.every(item => item.kind !== "use_feature")).toBe(true);
  expect(result.learningOpportunity).toBeNull();
});

test("an ambiguous salty-food request can clarify without navigation or a logging reminder", async () => {
  enqueue(response(null, {
    whatIFound: "Are you looking for a salty snack, or something more like a meal?",
    whatItCouldMean: "Either is fine; knowing that helps me offer the right kind of help.",
  }));
  const result = await render({ mode: "clarification", destinationId: null }, "I want something salty.");
  expect(result.whatIFound).toContain("snack");
  expect(result.todayPlan.items.some(item => item.kind === "use_feature")).toBe(false);
  expect(result.learningOpportunity).toBeNull();
});

test("changed preference is preserved in reasoning history and replaces the earlier destination", async () => {
  const decision = { mode: "food_assistance" as const, destinationId: "athlete_beverage_creator" as const };
  enqueue(reasoning(decision));
  const result = await reason("Actually, I need a pre-workout drink.", [
    { role: "user", content: "I want a cocktail." },
    { role: "assistant", content: "We can use Beverage Creator." },
  ]);
  const prompt = mockCreate.mock.calls[0][0];
  expect(prompt.messages[0].content).toContain("changed preference supersedes");
  expect(prompt.messages[1].content).toContain("I want a cocktail.");
  expect(prompt.messages[1].content).toContain("Actually, I need a pre-workout drink.");
  enqueue(response("athlete_beverage_creator"));
  expect((await render(result.conciergeDecision)).todayPlan.items[0].destinationId)
    .toBe("athlete_beverage_creator");
});

test("requested behavioral coaching keeps evidence instructions, styles, and learning support", async () => {
  enqueue(response(null, {
    whatIFound: "You want help understanding the connection between stress and eating.",
    whatItCouldMean: "Let's explore what tends to happen before the urge and what helps you respond.",
  }));
  const result = await render({ mode: "behavioral_coaching", destinationId: null },
    "Why do I struggle with emotional eating?");
  expect(result.learningOpportunity).toContain("log");
  const prompt = mockCreate.mock.calls[0][0];
  expect(prompt.messages[0].content).toContain("retain the existing coaching methodology");
  expect(prompt.messages[1].content).toContain("Be warm and direct.");
});

test("bad optional intent metadata cannot suppress a reasoning safety flag", () => {
  const parsed = ReasoningResultSchema.parse({
    ...reasoning(), redFlag: true, redFlagReason: "acute medical concern",
    conciergeDecision: { mode: "food_assistance", destinationId: "made_up_feature" },
  });
  expect(parsed.redFlag).toBe(true);
  expect(parsed.conciergeDecision).toBeUndefined();
});

test("a rendered care escalation overrides even a valid food destination", async () => {
  const safe = response(null);
  safe.todayPlan.items[0] = { horizon: "today", kind: "contact_care", text: "Seek urgent medical help." };
  enqueue(safe);
  const result = await render({ mode: "food_assistance", destinationId: "hydration_center" });
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(result.todayPlan.items[0].kind).toBe("contact_care");
  expect(result.todayPlan.items[0].destinationId).toBeUndefined();
});

test("unknown rendering targets are rejected, not silently relabeled", async () => {
  enqueue(response("https://evil.example"));
  enqueue(response("sushi_creator"));
  expect((await render({ mode: "food_assistance", destinationId: "sushi_creator" }))
    .todayPlan.items[0].destinationId).toBe("sushi_creator");
  expect(mockCreate).toHaveBeenCalledTimes(2);
});

test("missing reasoning decision cannot produce a guessed navigation", async () => {
  const guessed = response("sushi_creator");
  guessed.todayPlan.items.push({ horizon: "today", kind: "other", text: "Tell me what you would like help with." });
  enqueue(guessed);
  expect((await render()).todayPlan.items.every(item => !item.destinationId)).toBe(true);
});

test("mini fallback preserves the selection instead of reintroducing logging or another creator", async () => {
  for (let i = 0; i < 3; i++) enqueue(response("craving_creator"));
  enqueue({
    whatIFound: "Sushi sounds good. I can take you to Sushi Creator.",
    whatItCouldMean: "You can choose the kind you want there.",
    planWhy: "Use the dedicated sushi feature.",
  });
  const result = await render({ mode: "food_assistance", destinationId: "sushi_creator" });
  expect(mockCreate.mock.calls[3][0].model).toBe("gpt-4o-mini");
  expect(result.todayPlan.items[0].destinationId).toBe("sushi_creator");
  expect(result.learningOpportunity).toBeNull();
  expect(JSON.stringify(result)).not.toMatch(/logging|meal logs|deficien/i);
});

test("total provider failure gives an explicit retry without invented advice or navigation", async () => {
  mockCreate.mockRejectedValue(new Error("simulated provider failure"));
  const result = await render({ mode: "food_assistance", destinationId: "sushi_creator" });
  expect(result.whatIFound).toContain("try your request again");
  expect(result.todayPlan.items.every(item => !item.destinationId)).toBe(true);
});

test("Production retains the original prompt and rendering behavior", async () => {
  process.env.NODE_ENV = "production";
  enqueue(reasoning());
  await reason("I want sushi.");
  expect(mockCreate.mock.calls[0][0].messages[0].content).not.toContain("CONCIERGE — INTENT FIRST");
  enqueue(response("craving_creator"));
  const result = await render({ mode: "food_assistance", destinationId: "sushi_creator" });
  expect(result.todayPlan.items[0].featureTarget).toBe("craving_creator");
  expect(result.todayPlan.items[0].destinationId).toBeUndefined();
  expect(result.learningOpportunity).toContain("log");
});
