// Historical structured-engine compatibility fixtures. The active Development
// conversation path is exercised separately in chefConversation.test.ts.
// Deterministic provider fixtures exercise the preserved two-pass prompt/selection code.
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

import { StructuredCoachingEngine as CoachingEngine, runReasoningPass, runRenderingPass } from "../services/coaching/engine";
import { db } from "../db";
import { getAdapter } from "../services/coaching/adapters";
import { selectObservers, runObservers } from "../services/coaching/observers/stubs";
import { matchPatterns } from "../services/coaching/patternMatcher";
import { loadBoundedHistory } from "../services/coaching/conversationSummarizer";
import { renderReasoningBriefForPrompt } from "../services/coaching/reasoningFamilyMatcher";
import { extractAndPersistMemories } from "../services/coaching/memoryExtractor";
import { ConciergeDecisionSchema, ReasoningResultSchema, type ConciergeDecision, type ConciergeGoal } from "../../shared/coaching/schemas";
import { validateConciergeGoal } from "../services/coaching/conciergeGoal";
import { CHEF_CONCIERGE_REVISION } from "../services/coaching/conciergeInstructions";
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
const unknownGoal: ConciergeGoal = {
  activity: "unknown", occasion: "unknown", restaurant: "unknown",
  dishChosen: false, specialty: "none", explicitFeatureId: null,
};
// Provider fixtures declare semantic goals; they do not prove live interpretation.
function fixtureGoal(id: string | null): ConciergeGoal {
  const goal = { ...unknownGoal };
  switch (id) {
    case "craving_creator": return { ...goal, activity: "prepare", occasion: "snack" };
    case "create_a_dish": return { ...goal, activity: "prepare", occasion: "meal", dishChosen: true };
    case "dessert_creator": return { ...goal, activity: "prepare", occasion: "dessert" };
    case "sushi_creator": return { ...goal, activity: "prepare", specialty: "sushi", dishChosen: true };
    case "beverage_creator": return { ...goal, activity: "prepare", occasion: "beverage" };
    case "athlete_beverage_creator": return { ...goal, activity: "prepare", occasion: "beverage", specialty: "workout" };
    case "restaurant_guide": return { ...goal, activity: "eat_out", restaurant: "chosen" };
    case "find_meals_near_me": return { ...goal, activity: "eat_out", restaurant: "not_chosen" };
    case "fridge_rescue": return { ...goal, activity: "use_ingredients" };
    case "hydration_center": return { ...goal, activity: "hydration" };
    case "my_perfect_buffet": return { ...goal, activity: "buffet" };
    default: return goal;
  }
}
const reasoning = (decision?: ConciergeDecision) => ({
  primaryConcern: "Help with the member's current request.",
  hypotheses: [{
    explanation: "Provide assistance appropriate to the member's request.",
    evidenceCitationIds: [], likelihood: "most_likely",
  }],
  leadHypothesis: "Respond to the current request without unrelated interpretation.",
  proposedConfidence: "low", redFlag: false, missingData: [],
  ...(decision ? { conciergeDecision: {
    ...decision, goal: decision.goal ?? fixtureGoal(decision.destinationId),
  } } : {}),
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
async function render(
  decision?: ConciergeDecision,
  userMessage = "I want sushi.",
  history: Array<{ role: string; content: string }> = [],
  rollingContext?: string,
) {
  return runRenderingPass({
    userMessage, reasoning: reasoning(decision),
    styleResolution: { mode: "encouragement", instructions: "Be warm and direct." },
    confidence, patterns: [], additionalContext: {}, availableTools: tools(), specialization: "corner",
    history, rollingContext,
  });
}
async function reason(
  userMessage: string,
  history: Array<{ role: string; content: string }> = [],
  rollingContext?: string,
) {
  return runReasoningPass({
    userMessage, history, evidence: [], patterns: [], confidence,
    coachingMemories: [], nutritionMemories: [], additionalContext: {},
    specialization: "corner", availableTools: tools(), rollingContext,
  });
}

test.each([
  ["I want to make sushi.", "sushi_creator"],
  ["I want to bake cheesecake.", "dessert_creator"],
  ["I want to make a smoothie.", "beverage_creator"],
  ["I want to make a cocktail.", "beverage_creator"],
  ["I need a pre-workout drink.", "athlete_beverage_creator"],
  ["I need a post-workout recovery shake.", "athlete_beverage_creator"],
  ["I feel dehydrated.", "hydration_center"],
  ["I've chosen Chili's. Help me decide what to order.", "restaurant_guide"],
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
  const result = await render({ mode: "food_assistance", destinationId: "sushi_creator" },
    "I want sushi.", [{ role: "user", content: "DEV_ONLY_HISTORY_SENTINEL" }], "DEV_ONLY_SUMMARY_SENTINEL");
  expect(result.todayPlan.items[0].featureTarget).toBe("craving_creator");
  expect(result.todayPlan.items[0].destinationId).toBeUndefined();
  expect(result.learningOpportunity).toContain("log");
  const prompts = JSON.stringify(mockCreate.mock.calls);
  expect(prompts).not.toMatch(/NATURAL DISCOVERY|DISCOVERY EXPRESSION|DEV_ONLY_HISTORY_SENTINEL|DEV_ONLY_SUMMARY_SENTINEL/);
});

// Stage 1B: provider responses below are scripted fixtures, not model accuracy tests.
test("ambiguous hunger stays conversational through both passes without Fridge Rescue", async () => {
  const message = "I'm hungry, but I don't know what I want.";
  const decision = { mode: "clarification" as const, destinationId: null };
  enqueue(reasoning(decision));
  const first = await reason(message);
  enqueue(response(null, {
    whatIFound: "Let's narrow it down. Does something savory, sweet, or light sound good?",
    whatItCouldMean: "We can start with whichever sounds most appealing.",
  }));
  const result = await render(first.conciergeDecision, message);
  expect(mockCreate).toHaveBeenCalledTimes(2);
  expect(result.whatIFound).toContain("savory");
  expect(JSON.stringify(result)).not.toMatch(/fridge|deficien|missing.*log|cook at home/i);
  expect(result.todayPlan.items[0].kind).toBe("other");
  expect(result.todayPlan.items.every(item => !item.destinationId)).toBe(true);
  expect(mockCreate.mock.calls[0][0].messages[0].content).toContain("rather than guessing a tool");
  expect(mockCreate.mock.calls[1][0].messages[0].content).toContain('{"message":"the complete member-facing conversation"}');
});

test("multi-turn discovery retains savory and burger choices until the member chooses going out", async () => {
  const history: Array<{ role: string; content: string }> = [];
  const turns = [
    { message: "I'm hungry, but I don't know what I want.", mode: "clarification", id: null,
      answer: "Would something savory, sweet, or light appeal to you?" },
    { message: "Something savory.", mode: "clarification", id: null,
      answer: "Would a burger, pasta, or seafood sound good?" },
    { message: "A burger sounds good.", mode: "clarification", id: null,
      answer: "Would you like to make one or find somewhere to get one?" },
    { message: "I'd rather go out. Help me find somewhere.", mode: "food_assistance", id: "find_meals_near_me",
      answer: "Let's find you a burger. You can open Find Meals Near Me." },
  ] as const;
  for (const [index, turn] of turns.entries()) {
    const decision = ConciergeDecisionSchema.parse({ mode: turn.mode, destinationId: turn.id });
    enqueue(reasoning(decision));
    const first = await reason(turn.message, history);
    enqueue(response(turn.id, {
      whatIFound: turn.answer,
      whatItCouldMean: index === 3 ? "Choose a nearby place that suits you." : "We'll use your preference to narrow the choices.",
    }));
    const result = await render(first.conciergeDecision, turn.message, history);
    for (const prior of history) {
      expect(mockCreate.mock.calls[index * 2][0].messages[1].content).toContain(prior.content);
      expect(mockCreate.mock.calls[index * 2 + 1][0].messages[1].content).toContain(prior.content);
    }
    expect(result.todayPlan.items[0].destinationId).toBe(turn.id ?? undefined);
    expect(result.whatIFound).toBe(turn.answer);
    expect(JSON.stringify(result)).not.toMatch(/fridge|deficien|missing.*log/i);
    history.push({ role: "user", content: turn.message }, { role: "assistant", content: result.whatIFound });
  }
  expect(mockCreate).toHaveBeenCalledTimes(8);
  expect(mockCreate.mock.calls[7][0].messages[0].content).toContain("questions already answered");
});

test.each([
  ["I have chicken, rice, and broccoli in my refrigerator. What can I make?",
    "food_assistance", "fridge_rescue",
    "A chicken, rice, and broccoli bowl could work. Fridge Rescue can help you use those ingredients."],
  ["Please open Fridge Rescue.", "food_assistance", "fridge_rescue",
    "You can open Fridge Rescue and choose the ingredients you want to use."],
  ["Just give me a few ideas, no more questions.", "food_assistance", null,
    "Some savory options are a burger, a vegetable omelet, or a rice bowl."],
  ["What's the difference between protein, carbohydrates, and fats?", "nutrition_education", null,
    "Protein supports tissue maintenance. Carbohydrates supply energy. Fats support cell function and vitamin absorption."],
  ["How do I meal prep for the week?", "nutrition_education", null,
    "Choose a few meals, check what you have, make a shopping list, and batch-cook components. Portion and refrigerate or freeze them safely."],
  ["I keep stress-eating at night.", "behavioral_coaching", null,
    "Let's look at what tends to happen before nighttime eating and which coping strategies feel workable."],
])("Stage 1B two-pass fixture: %s", async (message, mode, id, answer) => {
  const decision = ConciergeDecisionSchema.parse({ mode, destinationId: id });
  const history = [{ role: "user", content: "Something savory." }];
  enqueue(reasoning(decision));
  const first = await reason(message, history);
  enqueue(response(id, { whatIFound: answer, whatItCouldMean: "We can take the next step at your pace." }));
  const result = await render(first.conciergeDecision, message, history);
  expect(result.whatIFound).toBe(answer);
  expect(result.todayPlan.items[0].destinationId).toBe(id ?? undefined);
  expect(result.learningOpportunity === null).toBe(mode !== "behavioral_coaching");
  expect(mockCreate).toHaveBeenCalledTimes(2);
  const prompt = mockCreate.mock.calls[0][0].messages[0].content;
  expect(prompt).toContain("no required number or sequence");
  expect(prompt).toContain("explain the process first");
  expect(prompt).toContain("wants suggestions instead of more questions");
  expect(prompt).toContain("explicitly requested available feature");
  expect(prompt).toContain("Recommend Fridge Rescue when explicitly requested");
});

test("changed beverage preference reaches both reasoning and expression", async () => {
  const history = [
    { role: "user", content: "I'd like a cocktail." },
    { role: "assistant", content: "Beverage Creator can help with that." },
  ];
  const message = "Actually, make it a pre-workout drink.";
  enqueue(reasoning({ mode: "food_assistance", destinationId: "athlete_beverage_creator" }));
  const first = await reason(message, history);
  enqueue(response("athlete_beverage_creator"));
  const result = await render(first.conciergeDecision, message, history);
  expect(result.todayPlan.items[0].destinationId).toBe("athlete_beverage_creator");
  for (const call of mockCreate.mock.calls) {
    expect(call[0].messages[1].content).toContain(message);
    expect(call[0].messages[1].content).toContain("I'd like a cocktail.");
  }
});

test("rolling summary and the already-bounded history reach both passes without a second tail cut", async () => {
  const history = Array.from({ length: 12 }, (_, i) => ({ role: "user", content: `context-item-${i};` }));
  const summary = "Earlier the member chose savory food and a burger, not seafood.";
  enqueue(reasoning({ mode: "clarification", destinationId: null }));
  const first = await reason("What next?", history, summary);
  enqueue(response(null));
  await render(first.conciergeDecision, "What next?", history, summary);
  for (const call of mockCreate.mock.calls) expect(call[0].messages[1].content).toContain(summary);
  const renderPrompt = mockCreate.mock.calls[1][0].messages[1].content;
  for (const message of history) expect(renderPrompt).toContain(message.content);
});

test("clarification cannot acquire an unsolicited feature action from rendering", async () => {
  enqueue(reasoning({ mode: "clarification", destinationId: null }));
  const first = await reason("I'm hungry and undecided.");
  const attempted = response("fridge_rescue");
  attempted.todayPlan.items.push({ horizon: "today", kind: "other", text: "Continue narrowing down what sounds good." });
  enqueue(attempted);
  const result = await render(first.conciergeDecision, "I'm hungry and undecided.");
  expect(result.todayPlan.items).toHaveLength(1);
  expect(result.todayPlan.items[0].kind).toBe("other");
  expect(result.todayPlan.items[0].destinationId).toBeUndefined();
  expect(mockCreate).toHaveBeenCalledTimes(2);
});

test("mini fallback retains discovery history and no-navigation authority", async () => {
  for (let i = 0; i < 3; i++) enqueue({ invalid: "simulated invalid renderer payload" });
  enqueue({
    whatIFound: "You picked a burger. Would you like to make one or go out?",
    whatItCouldMean: "Either way, we can take it from there.",
    planWhy: "Decide whether to make or find your burger.",
    action1: "Continue with your preference.",
  });
  const result = await render({ mode: "clarification", destinationId: null }, "A burger sounds good.",
    [{ role: "user", content: "Something savory." }], "The member is choosing a meal.");
  const fallbackPrompt = mockCreate.mock.calls[3][0];
  expect(fallbackPrompt.model).toBe("gpt-4o-mini");
  expect(fallbackPrompt.messages[1].content).toContain("Something savory.");
  expect(fallbackPrompt.messages[1].content).toContain("The member is choosing a meal.");
  expect(fallbackPrompt.messages[0].content).toContain("no mandatory sequence");
  expect(result.todayPlan.items.every(item => !item.destinationId)).toBe(true);
  expect(result.learningOpportunity).toBeNull();
});

test("Fridge Rescue discovery restriction exists only in the Development registry", () => {
  const cap = getCornerCapabilities(["all"]).find(cap => cap.id === "fridge_rescue")!;
  expect(cap.description).toContain("not hunger, indecision");
  expect(cap.applicableSituations).toEqual(["has_ingredients", "use_available_ingredients"]);
  process.env.NODE_ENV = "production";
  const original = getCornerCapabilities(["all"]).find(cap => cap.id === "fridge_rescue")!;
  expect(original.description).not.toContain("not hunger, indecision");
  expect(original.applicableSituations).toContain("meal_planning");
});

// Exercise subject authorization, safety, history/context loading, both actual
// model-call functions, postprocessing and persistence; only dependencies are mocked.
function prepareFullPipeline(history: Array<{ role: string; content: string }> = []) {
  const subject = { subjectType: "user", subjectId: "fixture-member", ownerId: "fixture-member" };
  (db.execute as jest.Mock).mockResolvedValue({ rows: [{ id: "fixture-row" }] });
  (getAdapter as jest.Mock).mockReturnValue({
    loadSubject: jest.fn().mockResolvedValue(subject), safetyRules: [], supportedObservers: [],
    knowledgeScopes: ["all"], availableTools: tools(),
    loadAdditionalContext: jest.fn().mockResolvedValue({
      coachingContextBlock: "GAP_CONTEXT_SENTINEL: hypothetical missing platform data.",
    }),
  });
  (selectObservers as jest.Mock).mockReturnValue([]);
  (runObservers as jest.Mock).mockResolvedValue([]);
  (matchPatterns as jest.Mock).mockResolvedValue([]);
  (loadBoundedHistory as jest.Mock).mockResolvedValue({
    recentMessages: history, rollingContext: "The member is choosing food.", totalCount: history.length,
  });
  (renderReasoningBriefForPrompt as jest.Mock).mockReturnValue("BEHAVIORAL_REFERENCE_SENTINEL");
  (extractAndPersistMemories as jest.Mock).mockResolvedValue(undefined);
  return (message: string) => new CoachingEngine().run({
    specialization: "corner", subject: subject as any, conversationId: "", userMessage: message,
  }, { authUser: { id: "fixture-member" } } as any);
}

function compactResponse(text: string, id: string | null = null) {
  return response(id, {
    whatIFound: text, whatItCouldMean: "",
    todayPlan: {
      why: "", items: id ? [{ horizon: "today", kind: "use_feature", text: "Open the feature", featureTarget: id }] : [],
      successMetric: "Member chose a next step.", nextCheckIn: "When ready",
    },
  });
}

test("full pipeline isolates ordinary discovery from coaching templates and appends no logging reminder", async () => {
  const run = prepareFullPipeline();
  enqueue(reasoning({ mode: "clarification", destinationId: null }));
  enqueue(compactResponse("What sounds good: something savory, sweet, or light?"));
  const result = await run("I'm hungry, but I don't know what I want to eat.");
  expect(result.whatIFound).toContain("savory");
  expect(result.whatItCouldMean).toBe("");
  expect(result.todayPlan.items).toEqual([]);
  expect(result.learningOpportunity).toBeNull();
  const renderer = mockCreate.mock.calls[1][0];
  expect(renderer.messages[0].content).not.toMatch(/hypotheses|LOW:|Always close with what logging|EXPRESSION PIPELINE/);
  expect(renderer.messages[1].content).not.toMatch(/GAP_CONTEXT_SENTINEL|BEHAVIORAL_REFERENCE_SENTINEL|BEHAVIOR SIGNAL/);
  expect(result.meta.concierge).toEqual({ revision: CHEF_CONCIERGE_REVISION, reasoning: "validated", rendering: "primary" });
  expect(db.execute).toHaveBeenCalled();
  expect(mockCreate).toHaveBeenCalledTimes(2);
});

test("full pipeline reasoning failure uses neutral context rather than synthetic nutrient/log analysis", async () => {
  const run = prepareFullPipeline();
  mockCreate.mockRejectedValueOnce(new Error("fixture provider failure"));
  enqueue(compactResponse("Would you prefer something warm or something fresh?"));
  const result = await run("I'm hungry and undecided.");
  const renderingContext = mockCreate.mock.calls[1][0].messages[1].content;
  expect(renderingContext).not.toMatch(/Insufficient platform evidence|meal logs|prescription adherence|GAP_CONTEXT_SENTINEL/);
  expect(result.learningOpportunity).toBeNull();
  expect(result.todayPlan.items).toEqual([]);
  expect(result.meta.concierge?.reasoning).toBe("unavailable");
  expect(mockCreate).toHaveBeenCalledTimes(2);
});

test("missing semantic decision fails closed through the full pipeline without guessed navigation", async () => {
  const run = prepareFullPipeline();
  enqueue(reasoning());
  enqueue(compactResponse("Would you like a few ideas or help narrowing down a preference?"));
  const result = await run("Help me decide what to eat.");
  expect(result.meta.concierge?.reasoning).toBe("unavailable");
  expect(result.todayPlan.items).toEqual([]);
});

test.each([
  ["I'll make the spicy tofu lettuce wraps.", "create_a_dish"],
  ["I want sushi.", "sushi_creator"],
  ["Let's make cheesecake.", "dessert_creator"],
  ["Help me satisfy a general salty-food craving.", "craving_creator"],
  ["I need a pre-workout drink.", "athlete_beverage_creator"],
  ["Let's find somewhere serving a burger.", "find_meals_near_me"],
  ["I want help choosing at the restaurant I picked.", "restaurant_guide"],
])("full pipeline decision completion produces one validated click action: %s", async (message, id) => {
  const run = prepareFullPipeline([
    { role: "user", content: "Something light, handheld, spicy, and plant-based." },
    { role: "assistant", content: "How about spicy tofu lettuce wraps or chickpea tacos?" },
  ]);
  enqueue(reasoning(ConciergeDecisionSchema.parse({ mode: "food_assistance", destinationId: id })));
  enqueue(compactResponse(`You can continue in ${COACH_DESTINATIONS[id as keyof typeof COACH_DESTINATIONS].label}.`, id));
  const result = await run(message);
  expect(result.todayPlan.items).toHaveLength(1);
  expect(result.todayPlan.items[0].destinationId).toBe(id);
  expect(result.whatItCouldMean).toBe("");
  expect(result.todayPlan.why).toBe("");
  expect(result.whatIFound).not.toContain("?");
  expect(mockCreate.mock.calls[1][0].messages[1].content).toContain("handheld, spicy, and plant-based");
  expect(mockCreate).toHaveBeenCalledTimes(2);
});

test.each([
  "Help me build meals.", "Plan my week in My Perfect Menu.", "Help me use a diabetes meal builder.",
  "I need the GLP-1 meal builder.", "Open anti-inflammatory meal building.", "I want performance meal planning.",
])("unsupported builder requests cannot bypass entry hubs: %s", async message => {
  const run = prepareFullPipeline();
  enqueue(reasoning({ mode: "food_assistance", destinationId: null }));
  enqueue(compactResponse("That entry page is not supported by Chef's current navigation buttons."));
  const result = await run(message);
  expect(result.todayPlan.items).toEqual([]);
  expect(mockCreate.mock.calls[0][0].messages[0].content).toContain("do not bypass a hub");
  expect(tools().every(tool => Object.prototype.hasOwnProperty.call(COACH_DESTINATIONS, tool.id))).toBe(true);
});

test("full pipeline safety gate precedes both model calls", async () => {
  const run = prepareFullPipeline();
  const result = await run("I have chest pain and want a pre-workout drink.");
  expect(result.meta.redFlag).toBe(true);
  expect(result.todayPlan.items.every(item => !item.destinationId)).toBe(true);
  expect(mockCreate).not.toHaveBeenCalled();
});

test("reasoning safety flag survives malformed concierge metadata in the full pipeline", async () => {
  const run = prepareFullPipeline();
  enqueue({ ...reasoning(), redFlag: true, redFlagReason: "fixture urgent concern",
    conciergeDecision: { mode: "invalid-mode", destinationId: "made_up" } });
  const result = await run("Help me with a concerning symptom.");
  expect(result.meta.redFlag).toBe(true);
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test("full pipeline preserves behavioral methodology rather than the concise concierge prompt", async () => {
  const run = prepareFullPipeline();
  enqueue(reasoning({ mode: "behavioral_coaching", destinationId: null }));
  enqueue(response(null));
  const result = await run("I want help changing my stress-eating pattern.");
  const renderer = mockCreate.mock.calls[1][0];
  expect(renderer.messages[0].content).toContain("EXPRESSION PIPELINE");
  expect(renderer.messages[1].content).toContain("BEHAVIORAL_REFERENCE_SENTINEL");
  expect(result.learningOpportunity).toContain("log");
});

test("minimal discovery response stays one question through the full pipeline and stored JSON", async () => {
  const run = prepareFullPipeline();
  enqueue(reasoning({ mode: "clarification", destinationId: null }));
  enqueue({ message: "All right! Are you in the mood for something savory, sweet, or light?" });
  const result = await run("I'm hungry, but I don't know what I want to eat.");
  expect(result.presentation).toEqual({
    kind: "concierge", message: "All right! Are you in the mood for something savory, sweet, or light?",
  });
  expect(result.whatItCouldMean).toBe("");
  expect(result.todayPlan.why).toBe("");
  expect(result.todayPlan.items).toEqual([]);
  expect(result.learningOpportunity).toBeNull();
  expect(JSON.parse(JSON.stringify(result)).presentation).toEqual(result.presentation);
  expect(mockCreate).toHaveBeenCalledTimes(2);
});

test("legacy-format provider rationale is internal, never promoted into the presentation", async () => {
  enqueue(response(null, {
    whatIFound: "Savory, sweet, or light?", whatItCouldMean: "INTERNAL_EXPLANATION",
    todayPlan: { why: "To help you decide on a meal that satisfies your hunger.", items: [],
      successMetric: "INTERNAL_METRIC", nextCheckIn: "INTERNAL_CHECK_IN" },
  }));
  const result = await render({ mode: "clarification", destinationId: null });
  expect(result.todayPlan.why).toContain("To help you decide");
  expect(result.presentation).toEqual({ kind: "concierge", message: "Savory, sweet, or light?" });
  expect(JSON.stringify(result.presentation)).not.toMatch(/INTERNAL|satisfies your hunger/);
});

test.each([
  ["I'll make spicy tofu lettuce wraps.", "create_a_dish"],
  ["I want sushi.", "sushi_creator"],
])("minimal completed decision retains one server-owned action: %s", async (message, id) => {
  const run = prepareFullPipeline([{ role: "user", content: "Light, spicy, handheld and plant-based." }]);
  enqueue(reasoning(ConciergeDecisionSchema.parse({ mode: "food_assistance", destinationId: id })));
  enqueue({ message: id === "sushi_creator" ? "Let's head to Sushi Creator." : "Perfect! Let's make those in Create a Dish.",
    destinationId: "https://evil.example" });
  const result = await run(message);
  expect(result.presentation?.destinationId).toBe(id);
  expect(result.todayPlan.items).toHaveLength(1);
  expect(result.todayPlan.items[0].destinationId).toBe(id);
  expect(result.presentation?.message).not.toContain("?");
  expect(mockCreate.mock.calls[1][0].messages[1].content).toContain("Light, spicy, handheld");
});

test("minimal education preserves detail in its one message without forcing navigation", async () => {
  const message = "Protein supplies amino acids for tissue maintenance and repair.\n\nCarbohydrates supply energy. Both can contribute to a balanced eating pattern.";
  enqueue({ message });
  const result = await render({ mode: "nutrition_education", destinationId: null },
    "What's the difference between protein and carbohydrates?");
  expect(result.presentation?.message).toBe(message);
  expect(result.todayPlan.items).toEqual([]);
});

test("minimal renderer care escalation bypasses compact presentation and navigation", async () => {
  enqueue({ message: "Seek urgent medical help for these symptoms.", contactCare: "Call emergency services now." });
  const result = await render({ mode: "food_assistance", destinationId: "sushi_creator" });
  expect(result.presentation).toBeUndefined();
  expect(result.todayPlan.items[0].kind).toBe("contact_care");
  expect(result.todayPlan.items[0].destinationId).toBeUndefined();
});

test("mini fallback hides legacy plan fragments behind the same minimal presentation", async () => {
  for (let i = 0; i < 3; i++) enqueue({ invalid: true });
  enqueue({ whatIFound: "Would you prefer savory, sweet, or light?", whatItCouldMean: "FALLBACK_EXPLANATION",
    planWhy: "DISCONNECTED_FALLBACK_RATIONALE", action1: "INTERNAL_ACTION" });
  const result = await render({ mode: "clarification", destinationId: null });
  expect(result.presentation).toEqual({ kind: "concierge", message: "Would you prefer savory, sweet, or light?" });
  expect(result.todayPlan.why).toBe("DISCONNECTED_FALLBACK_RATIONALE");
  expect(result.meta.concierge?.rendering).toBe("mini_fallback");
});

test("mini fallback accepts the new one-message response with no extra call", async () => {
  for (let i = 0; i < 3; i++) enqueue({ invalid: true });
  enqueue({ message: "What sounds better: warm or fresh?" });
  const result = await render({ mode: "clarification", destinationId: null });
  expect(result.presentation?.message).toBe("What sounds better: warm or fresh?");
  expect(mockCreate).toHaveBeenCalledTimes(4);
});

test.each([
  ["I'm hungry, but I don't know what I want.", unknownGoal, "Thinking savory, sweet, or something light?"],
  ["I want something light, but with a lot of flavor. Nothing too heavy.", unknownGoal, "Spicy, tangy, or savory?"],
  ["Spicy.", unknownGoal, "Seafood, chicken, or plant-based?"],
  ["Something small and spicy.", { ...unknownGoal, occasion: "snack" as const }, "Thinking crunchy or soft?"],
])("Stage 1E orchestration vetoes premature Craving Creator: %s", async (message, goal, answer) => {
  const run = prepareFullPipeline();
  // Deliberately reproduce the bad destination, not a pre-corrected decision.
  enqueue(reasoning({ mode: "food_assistance", destinationId: "craving_creator", goal }));
  enqueue({ message: answer });
  const result = await run(message);
  expect(result.presentation).toEqual({ kind: "concierge", message: answer });
  expect(result.todayPlan.items).toEqual([]);
  expect(result.learningOpportunity).toBeNull();
  const expression = mockCreate.mock.calls[1][0].messages[0].content;
  expect(expression).toContain('"mode":"clarification"');
  expect(expression).toContain('"destinationId":null');
  expect(mockCreate).toHaveBeenCalledTimes(2);
});

test("Stage 1E actual reasoning rejects a legacy destination with no goal proof", async () => {
  const raw = reasoning({ mode: "food_assistance", destinationId: "craving_creator" });
  delete (raw.conciergeDecision as any).goal;
  enqueue(raw);
  const result = await reason("Light and flavorful.");
  expect(result.conciergeDecision.mode).toBe("clarification");
  expect(result.conciergeDecision.destinationId).toBeNull();
  expect(mockCreate).toHaveBeenCalledTimes(1); // No repair/classifier call added.
});

test.each([
  ["I want to prepare spicy chickpeas as a small snack.", "craving_creator"],
  ["I want to make shrimp tacos for dinner.", "create_a_dish"],
  ["I want to prepare a full meal.", "create_a_dish"],
  ["I want to bake a small dessert.", "dessert_creator"],
  ["I want to bake a whole pie.", "dessert_creator"],
  ["I want to make sushi.", "sushi_creator"],
  ["I want to make a smoothie.", "beverage_creator"],
  ["Make a pre-workout drink.", "athlete_beverage_creator"],
  ["Use my leftover chicken and rice.", "fridge_rescue"],
  ["I'm going to Chili's tonight. Help me choose a light meal.", "restaurant_guide"],
  ["Help me find a restaurant for dinner. I haven't chosen one.", "find_meals_near_me"],
])("Stage 1E complete goal immediately retains one appropriate action: %s", async (message, id) => {
  const run = prepareFullPipeline();
  enqueue(reasoning({ mode: "food_assistance", destinationId: id, goal: fixtureGoal(id) }));
  enqueue({ message: "Let's do that." });
  const result = await run(message);
  expect(result.presentation).toEqual({ kind: "concierge", message: "Let's do that.", destinationId: id });
  expect(result.todayPlan.items).toHaveLength(1);
  expect(result.todayPlan.items[0].destinationId).toBe(id);
  expect(result.presentation?.message).not.toContain("?");
  expect(mockCreate).toHaveBeenCalledTimes(2);
});

test.each([
  ["craving_creator", { ...unknownGoal, activity: "prepare", occasion: "meal", dishChosen: true }],
  ["create_a_dish", { ...unknownGoal, activity: "prepare", occasion: "snack", dishChosen: true }],
  ["restaurant_guide", { ...unknownGoal, activity: "eat_out", restaurant: "not_chosen" }],
  ["find_meals_near_me", { ...unknownGoal, activity: "eat_out", restaurant: "chosen" }],
  ["restaurant_guide", { ...unknownGoal, activity: "eat_out", restaurant: "unknown" }],
  ["sushi_creator", { ...unknownGoal, activity: "eat_out", restaurant: "not_chosen", specialty: "sushi" }],
  ["dessert_creator", { ...unknownGoal, occasion: "dessert" }],
  ["fridge_rescue", { ...unknownGoal, activity: "prepare", occasion: "meal" }],
])("Stage 1E expression independently vetoes inconsistent %s readiness", async (id, goal) => {
  enqueue({ message: "Making it or going out?" });
  const result = await render({
    mode: "food_assistance", destinationId: id, goal: goal as ConciergeGoal,
  }, "Help me choose.");
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.todayPlan.items).toEqual([]);
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test("Stage 1E multi-turn discovery retains preferences and budget, offers ideas, then opens only after destination is clear", async () => {
  const history: Array<{ role: string; content: string }> = [];
  const turns: Array<{ message: string; answer: string; proposed: string | null; goal: ConciergeGoal; expected: string | null }> = [
    { message: "I'm hungry, but I don't know what I want.", answer: "Thinking savory, sweet, or something light?",
      proposed: "craving_creator", goal: { ...unknownGoal }, expected: null },
    { message: "Something light, but with a lot of flavor.", answer: "Spicy, tangy, or savory?",
      proposed: "craving_creator", goal: { ...unknownGoal }, expected: null },
    { message: "Spicy.", answer: "Seafood, chicken, or plant-based?",
      proposed: null, goal: { ...unknownGoal }, expected: null },
    { message: "Seafood.", answer: "How about spicy shrimp tacos or shrimp lettuce wraps?",
      proposed: null, goal: { ...unknownGoal }, expected: null },
    { message: "Shrimp tacos sound good.", answer: "Making them or going out?",
      proposed: "create_a_dish", goal: { ...unknownGoal, dishChosen: true }, expected: null },
    { message: "Going out. I'd like to stay under $20.", answer: "Already have a restaurant in mind?",
      proposed: "restaurant_guide", goal: { ...unknownGoal, activity: "eat_out", dishChosen: true }, expected: null },
    { message: "No, let's find somewhere.", answer: "Let's find one.",
      proposed: "find_meals_near_me", goal: fixtureGoal("find_meals_near_me"), expected: "find_meals_near_me" },
  ];
  for (const [index, turn] of turns.entries()) {
    const run = prepareFullPipeline([...history]);
    enqueue(reasoning({ mode: "food_assistance", destinationId: turn.proposed, goal: turn.goal }));
    enqueue({ message: turn.answer });
    const result = await run(turn.message);
    expect(result.presentation?.message).toBe(turn.answer);
    expect(result.presentation?.destinationId).toBe(turn.expected ?? undefined);
    expect(result.todayPlan.items).toHaveLength(turn.expected ? 1 : 0);
    const expression = mockCreate.mock.calls[index * 2 + 1][0].messages[1].content;
    for (const previous of history) expect(expression).toContain(previous.content);
    if (index === turns.length - 1) {
      expect(expression).toContain("under $20");
      expect(mockCreate.mock.calls[index * 2][0].messages[1].content).toContain("under $20");
    }
    history.push({ role: "user", content: turn.message }, { role: "assistant", content: turn.answer });
  }
  expect(mockCreate).toHaveBeenCalledTimes(turns.length * 2);
});

test("Stage 1E a changed mind replaces the prior snack destination with the chosen restaurant", async () => {
  const history = [
    { role: "user", content: "I want to make a small spicy snack." },
    { role: "assistant", content: "Let's use Craving Creator." },
  ];
  const run = prepareFullPipeline(history);
  enqueue(reasoning({ mode: "food_assistance", destinationId: "restaurant_guide",
    goal: fixtureGoal("restaurant_guide") }));
  enqueue({ message: "Let's choose something there." });
  const result = await run("Actually, I'm going to Chili's. Help me order instead.");
  expect(result.presentation?.destinationId).toBe("restaurant_guide");
  expect(result.todayPlan.items).toHaveLength(1);
  expect(result.presentation?.message).not.toContain("Craving Creator");
  expect(mockCreate.mock.calls[1][0].messages[1].content).toContain("Actually, I'm going to Chili's");
});

test("Stage 1E explicit available-feature requests need no discovery checklist", async () => {
  const run = prepareFullPipeline();
  enqueue(reasoning({ mode: "food_assistance", destinationId: "craving_creator",
    goal: { ...unknownGoal, explicitFeatureId: "craving_creator" } }));
  enqueue({ message: "Let's open Craving Creator." });
  expect((await run("Please open Craving Creator.")).presentation?.destinationId).toBe("craving_creator");
  expect(mockCreate).toHaveBeenCalledTimes(2);
});

test("Stage 1E an assistant mention or invented explicit request cannot bypass goal readiness", async () => {
  enqueue(reasoning({ mode: "food_assistance", destinationId: "craving_creator",
    goal: { ...unknownGoal, explicitFeatureId: "craving_creator" } }));
  const result = await reason("Light and flavorful.", [
    { role: "assistant", content: "Let's use Craving Creator." },
  ]);
  expect(result.conciergeDecision.destinationId).toBeNull();
});

test("Stage 1E the allowlist alone cannot authorize an unavailable capability", () => {
  expect(validateConciergeGoal({
    mode: "food_assistance", destinationId: "sushi_creator", goal: fixtureGoal("sushi_creator"),
  }, [], ["I want to make sushi."])?.destinationId).toBeNull();
});

test("Stage 1E invalid goal metadata never suppresses a genuine reasoning red flag", async () => {
  const run = prepareFullPipeline();
  enqueue({ ...reasoning({ mode: "food_assistance", destinationId: "craving_creator" }),
    redFlag: true, redFlagReason: "Urgent symptoms.",
    conciergeDecision: { mode: "food_assistance", destinationId: "craving_creator", goal: { activity: "invented" } } });
  const result = await run("I need help with concerning symptoms.");
  expect(result.meta.redFlag).toBe(true);
  expect(result.presentation).toBeUndefined();
  expect(result.todayPlan.items.every(item => !item.destinationId)).toBe(true);
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test("Stage 1E mini fallback cannot resurrect a destination rejected for insufficient goal context", async () => {
  for (let i = 0; i < 3; i++) enqueue({ invalid: true });
  enqueue({ message: "Spicy, tangy, or savory?", destinationId: "craving_creator" });
  const result = await render({
    mode: "food_assistance", destinationId: "craving_creator", goal: { ...unknownGoal },
  }, "Something light and flavorful.");
  expect(result.presentation).toEqual({ kind: "concierge", message: "Spicy, tangy, or savory?" });
  expect(result.todayPlan.items.every(item => item.kind !== "use_feature" && !item.destinationId)).toBe(true);
  expect(result.meta.concierge?.rendering).toBe("mini_fallback");
  expect(mockCreate).toHaveBeenCalledTimes(4);
});
