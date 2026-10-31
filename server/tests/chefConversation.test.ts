// Active Development API engine, not the preserved structured compatibility engine.
jest.mock("../db", () => ({ db: { execute: jest.fn() } }));
jest.mock("../services/coaching/adapters", () => ({ getAdapter: jest.fn() }));
jest.mock("../services/coaching/conversationSummarizer", () => ({ loadBoundedHistory: jest.fn() }));
jest.mock("../services/coaching/styleResolver", () => ({ resolveStyle: jest.fn() }));
jest.mock("../services/coaching/observers/stubs", () => ({ runObservers: jest.fn(), selectObservers: jest.fn() }));
jest.mock("../services/coaching/memoryExtractor", () => ({ extractAndPersistMemories: jest.fn() }));
const mockCreate = jest.fn();
jest.mock("openai", () => ({
  __esModule: true, default: jest.fn().mockImplementation(() => ({ chat: { completions: { create: mockCreate } } })),
}));
import { engine, StructuredCoachingEngine } from "../services/coaching/engine";
import { db } from "../db";
import { getAdapter } from "../services/coaching/adapters";
import { loadBoundedHistory } from "../services/coaching/conversationSummarizer";
import { resolveStyle } from "../services/coaching/styleResolver";
import { runObservers } from "../services/coaching/observers/stubs";
import { extractAndPersistMemories } from "../services/coaching/memoryExtractor";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";

const oldEnvironment = process.env.NODE_ENV;
const user = { id: "fixture-user" };
const subject = { subjectType: "user" as const, subjectId: user.id, ownerId: user.id };
const unknown = { activity: "unknown", occasion: "unknown", restaurant: "unknown",
  dishChosen: false, specialty: "none", explicitFeatureId: null };
beforeEach(() => {
  process.env.NODE_ENV = "development";
  jest.clearAllMocks(); mockCreate.mockReset();
  (db.execute as jest.Mock).mockResolvedValue({ rows: [{ id: "fixture-row" }] });
  (loadBoundedHistory as jest.Mock).mockResolvedValue({ recentMessages: [], rollingContext: null });
  (getAdapter as jest.Mock).mockReturnValue({
    loadSubject: jest.fn().mockResolvedValue(subject), safetyRules: [],
    availableTools: getCornerCapabilities(["all"]).map(cap => ({ ...cap, scope: "adult", featureTarget: cap.id })),
    loadAdditionalContext: jest.fn().mockResolvedValue({ coachingContextBlock: "Verified dietary restrictions: vegetarian. No permission for clinical labs." }),
  });
});
afterAll(() => { process.env.NODE_ENV = oldEnvironment; });
function reply(message: string, id: string | null = null, goal = unknown, extra = {}) {
  mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({
    message, conciergeDecision: { mode: "food_assistance", destinationId: id, goal }, ...extra,
  }) } }] });
}
const run = (message: string) => engine.run({
  specialization: "corner", subject, userMessage: message, conversationId: "",
}, { authUser: user } as any);

test("actual Development engine answers without assessment, styles, observers or background extraction in one call", async () => {
  reply("Thinking savory, sweet, or something light?");
  const result = await run("I'm hungry, but I don't know what I want.");
  expect(result.presentation).toEqual({ kind: "concierge", message: "Thinking savory, sweet, or something light?" });
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(resolveStyle).not.toHaveBeenCalled();
  expect(runObservers).not.toHaveBeenCalled();
  expect(extractAndPersistMemories).not.toHaveBeenCalled();
  expect(result.todayPlan.items).toEqual([]);
  expect(result.conversationId).toBe("fixture-row");
  expect(result.messageId).toBe("fixture-row");
  expect(mockCreate.mock.calls[0][0].messages[1].content).toContain("Verified dietary restrictions: vegetarian");
  const queries = (db.execute as jest.Mock).mock.calls.map(([query]) => JSON.stringify(query)).join("\n");
  expect(queries).not.toMatch(/coaching_profiles|coaching_memories/);
});

test("preferences and changed intent remain in the actual one-call history without inventing dishes", async () => {
  const history = [
    { role: "user", content: "I want something light." },
    { role: "assistant", content: "Spicy, tangy, or fresh?" },
    { role: "user", content: "Spicy." },
    { role: "assistant", content: "Seafood, chicken, or plant-based?" },
  ];
  (loadBoundedHistory as jest.Mock).mockResolvedValue({ recentMessages: history,
    rollingContext: "The member wants something light, not a heavy meal." });
  reply("Making it at home or going out?");
  const first = await run("Actually, I'd rather have seafood.");
  expect(first.presentation?.message).toBe("Making it at home or going out?");
  expect(first.presentation?.destinationId).toBeUndefined();
  const sent = mockCreate.mock.calls[0][0].messages[1].content;
  for (const item of history) expect(sent).toContain(item.content);
  expect(sent).toContain("Actually, I'd rather have seafood.");
  reply("Making them or going out?");
  expect((await run("Shrimp tacos sound good.")).presentation?.message).toContain("Making");
  expect(mockCreate).toHaveBeenCalledTimes(2); // One per turn, not two.
});

test("reference soup conversation retains member preferences and grounds the final Create a Dish prefill", async () => {
  const history: Array<{ role: string; content: string }> = [];
  const exchanges = [
    ["I'm hungry, but I don't know what to eat.", "Are you in the mood for something light, a snack, or a full meal?"],
    ["Something light but with a lot of flavor.", "Are you thinking a salad, soup, or something else?"],
    ["Soup.", "Something creamy or more broth-based?"],
    ["Broth.", "Spicy or more savory and mild?"],
    ["Savory.", "Vegetables, chicken, or seafood?"],
    ["Chicken.", "Making it at home or ordering out?"],
  ];
  for (const [message, answer] of exchanges) {
    (loadBoundedHistory as jest.Mock).mockResolvedValue({ recentMessages: [...history], rollingContext: null });
    reply(answer);
    const response = await run(message);
    expect(response.presentation).toEqual({ kind: "concierge", message: answer });
    expect(response.todayPlan.items).toEqual([]);
    history.push({ role: "user", content: message }, { role: "assistant", content: answer });
  }
  (loadBoundedHistory as jest.Mock).mockResolvedValue({ recentMessages: history, rollingContext: null });
  const idea = "Light, flavorful, savory, broth-based chicken soup to make at home.";
  reply("Let's use Create a Dish for your light, savory chicken broth soup.", "create_a_dish",
    { ...unknown, activity: "prepare", occasion: "meal", dishChosen: true },
    { creatorRequest: { idea, memberTurns: [1, 2, 3, 4, 5, 6] } });
  const final = await run("Home.");
  expect(final.presentation?.creatorRequest).toEqual({ destinationId: "create_a_dish", idea });
  expect(final.todayPlan.items).toHaveLength(1);
  expect(final.presentation?.destinationId).toBe("create_a_dish");
  expect(mockCreate).toHaveBeenCalledTimes(7); // One call per member turn, no rendering/repair call.
  const persisted = JSON.stringify((db.execute as jest.Mock).mock.calls);
  expect(persisted).toContain("creatorRequest");
  expect(persisted).toContain(idea);
});

test("a complete one-turn request immediately receives an editable grounded handoff", async () => {
  const idea = "Savory chicken soup to make at home.";
  reply("Let's use Create a Dish.", "create_a_dish",
    { ...unknown, activity: "prepare", occasion: "meal", dishChosen: true },
    { creatorRequest: { idea, memberTurns: [0] } });
  const result = await run("I want to make savory chicken soup at home.");
  expect(result.presentation?.creatorRequest?.idea).toBe(idea);
  expect(result.todayPlan.items).toHaveLength(1);
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test("exact chicken Caesar conversation completes the omitted action from the ready semantic goal", async () => {
  (getAdapter as jest.Mock)().loadAdditionalContext.mockResolvedValue({ coachingContextBlock: "No dietary restrictions supplied." });
  (loadBoundedHistory as jest.Mock).mockResolvedValue({
    recentMessages: [
      { role: "user", content: "I don't know, maybe a salad." },
      { role: "assistant", content: "A salad sounds like a great option! Would you like something light and refreshing, or perhaps a more hearty salad with protein?" },
    ], rollingContext: null,
  });
  reply("A chicken Caesar salad sounds delicious and satisfying! Let's help you prepare it just the way you like. You can customize it with your favorite ingredients and dressing.",
    null, { ...unknown, activity: "prepare", occasion: "meal", dishChosen: true },
    { creatorRequest: { idea: "Chicken Caesar salad", memberTurns: [0, 1] } });
  const result = await run("Yeah, a chicken, that's like a chicken salad, a chicken Caesar, what do you think about that?");
  expect(result.presentation).toEqual({
    kind: "concierge", message: "Let's use Create a Dish for that.", destinationId: "create_a_dish",
    creatorRequest: { destinationId: "create_a_dish", idea: "Chicken Caesar salad" },
  });
  expect(result.todayPlan.items).toHaveLength(1);
  expect(result.todayPlan.items[0].destinationId).toBe("create_a_dish");
  expect(mockCreate).toHaveBeenCalledTimes(1);
  const wire = mockCreate.mock.calls[0][0];
  expect(wire.response_format.type).toBe("json_schema");
  expect(wire.response_format.json_schema.strict).toBe(true);
  const decisionSchema = wire.response_format.json_schema.schema.properties.conciergeDecision;
  expect(decisionSchema.required).toEqual(expect.arrayContaining(["mode", "destinationId", "goal"]));
  expect(wire.messages[1].content).toContain("chicken Caesar salad"); // Verified capability guidance is in this actual call.
  expect(JSON.stringify((db.execute as jest.Mock).mock.calls)).toContain("Chicken Caesar salad");
});

test.each([
  ["craving_creator", "Help me make a small savory snack.", { ...unknown, activity: "prepare", occasion: "snack" }],
  ["dessert_creator", "I want to make a whole chocolate cake.", { ...unknown, activity: "prepare", occasion: "dessert" }],
  ["sushi_creator", "Help me make sushi rolls.", { ...unknown, activity: "prepare", specialty: "sushi" }],
  ["beverage_creator", "Make a regular fruit smoothie.", { ...unknown, activity: "prepare", occasion: "beverage" }],
  ["athlete_beverage_creator", "Help me make a post-workout recovery drink.", { ...unknown, activity: "prepare", occasion: "beverage", specialty: "workout" }],
  ["fridge_rescue", "Use the ingredients already in my fridge.", { ...unknown, activity: "use_ingredients" }],
  ["restaurant_guide", "What should I order at the restaurant I chose?", { ...unknown, activity: "eat_out", restaurant: "chosen" }],
  ["find_meals_near_me", "Find me somewhere nearby to eat.", { ...unknown, activity: "eat_out", restaurant: "not_chosen" }],
  ["my_perfect_buffet", "Help me choose from this buffet.", { ...unknown, activity: "buffet" }],
  ["hydration_center", "Open my hydration support.", { ...unknown, activity: "hydration" }],
])("ready %s semantic goal cannot silently lose its destination", async (id, message, goal) => {
  reply("Let's do that.", null, goal);
  const result = await run(message);
  expect(result.presentation?.destinationId).toBe(id);
  expect(result.todayPlan.items).toHaveLength(1);
  expect(result.presentation?.creatorRequest).toBeUndefined();
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test.each([
  ["I don't know, maybe a salad.", "clarification", unknown],
  ["What nutrients are in chicken Caesar salad?", "nutrition_education", { ...unknown, dishChosen: true, activity: "prepare", occasion: "meal" }],
  ["I had chicken Caesar salad yesterday.", "clarification", { ...unknown, dishChosen: false }],
  ["Help me plan my week's meals.", "food_assistance", { ...unknown, activity: "plan_meals" }],
  ["Explain diabetes meal planning.", "nutrition_education", unknown],
])("no forced destination for discussion, education, uncertainty or unsupported intent: %s", async (message, mode, goal) => {
  reply("Here's how I can help.", null, goal, { conciergeDecision: { mode, destinationId: null, goal } });
  const result = await run(message);
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.todayPlan.items).toEqual([]);
  expect(result.meta.concierge?.rendering).toBe("primary");
});

test.each([undefined, { mode: "food_assistance", destinationId: null }])(
  "missing decision or missing food goal fails explicitly instead of pretending discovery succeeded: %j", async conciergeDecision => {
    reply("Let's help you prepare it.", null, unknown, { conciergeDecision });
    const result = await run("Make chicken Caesar salad.");
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.meta.concierge?.rendering).toBe("retry");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  },
);

test("strict provider null fields preserve ordinary conversation and care escalation", async () => {
  reply("What sounds good?", null, unknown, { creatorRequest: null, redFlagReason: null, contactCare: null });
  expect((await run("I'm hungry.")).presentation?.message).toBe("What sounds good?");
  reply("Please get urgent care.", null, unknown, { creatorRequest: null, redFlag: true,
    redFlagReason: null, contactCare: "Contact urgent medical care now." });
  const result = await run("I feel unwell.");
  expect(result.meta.redFlag).toBe(true);
  expect(result.presentation).toBeUndefined();
});

test("goal completion never invents an unavailable destination or picks between competing matches", async () => {
  (getAdapter as jest.Mock)().availableTools = [];
  reply("This feature isn't available here.", null,
    { ...unknown, activity: "prepare", occasion: "meal", dishChosen: true });
  expect((await run("Help me make chicken Caesar salad.")).presentation?.destinationId).toBeUndefined();
  (getAdapter as jest.Mock)().availableTools = getCornerCapabilities(["all"]);
  reply("Which kind of preparation do you mean?", null,
    { ...unknown, activity: "prepare", occasion: "dessert", specialty: "sushi" });
  expect((await run("I'm undecided.")).presentation?.destinationId).toBeUndefined();
});

test.each([
  { idea: "Chicken soup with tomatoes.", memberTurns: [0] },
  { idea: "Chicken soup.", memberTurns: [200] },
  { idea: "Chicken soup.", memberTurns: [-1] },
])("unverifiable request cannot introduce an invented prefill: %j", async creatorRequest => {
  reply("Let's use Create a Dish.", "create_a_dish",
    { ...unknown, activity: "prepare", occasion: "meal", dishChosen: true }, { creatorRequest });
  const result = await run("Make chicken soup.");
  expect(result.presentation?.destinationId).toBe("create_a_dish");
  expect(result.presentation?.creatorRequest).toBeUndefined();
  expect(result.presentation?.message).toContain("couldn't verify the request text");
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test("assistant suggestions cannot supply handoff ingredients or override a changed member request", async () => {
  (loadBoundedHistory as jest.Mock).mockResolvedValue({
    recentMessages: [{ role: "assistant", content: "Try creamy chicken soup with tomatoes." }], rollingContext: null,
  });
  reply("Let's use Create a Dish.", "create_a_dish",
    { ...unknown, activity: "prepare", occasion: "meal", dishChosen: true },
    { creatorRequest: { idea: "Creamy chicken soup with tomatoes.", memberTurns: [0] } });
  const result = await run("Actually, seafood soup without cream.");
  expect(result.presentation?.creatorRequest).toBeUndefined();
});

test("the member's changed request replaces earlier preferences in the prefill", async () => {
  (loadBoundedHistory as jest.Mock).mockResolvedValue({
    recentMessages: [{ role: "user", content: "Make chicken soup." }], rollingContext: null,
  });
  reply("Let's use Create a Dish.", "create_a_dish",
    { ...unknown, activity: "prepare", occasion: "meal", dishChosen: true },
    { creatorRequest: { idea: "Seafood soup without cream.", memberTurns: [1] } });
  const result = await run("Actually, seafood soup without cream.");
  expect(result.presentation?.creatorRequest?.idea).toBe("Seafood soup without cream.");
});

test.each([
  ["craving_creator", { ...unknown, activity: "prepare", occasion: "snack" }],
  ["create_a_dish", { ...unknown, activity: "prepare", occasion: "meal", dishChosen: true }],
  ["dessert_creator", { ...unknown, activity: "prepare", occasion: "dessert" }],
  ["sushi_creator", { ...unknown, activity: "prepare", specialty: "sushi" }],
  ["restaurant_guide", { ...unknown, activity: "eat_out", restaurant: "chosen" }],
  ["find_meals_near_me", { ...unknown, activity: "eat_out", restaurant: "not_chosen" }],
  ["athlete_beverage_creator", { ...unknown, activity: "prepare", occasion: "beverage", specialty: "workout" }],
  ["fridge_rescue", { ...unknown, activity: "use_ingredients" }],
])("one-call %s selection retains exactly one validated action and stored presentation", async (id, goal) => {
  reply("Let's do that.", id, goal);
  const result = await run("Please help me with that.");
  expect(result.presentation?.destinationId).toBe(id);
  expect(result.todayPlan.items).toHaveLength(1);
  expect(result.todayPlan.items[0].destinationId).toBe(id);
  const queries = JSON.stringify((db.execute as jest.Mock).mock.calls);
  expect(queries).toContain("concierge");
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test("premature navigation fails explicitly without an unchecked feature pitch or extra call", async () => {
  reply("Let's open Craving Creator.", "craving_creator");
  const result = await run("Something light and flavorful.");
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.presentation?.message).not.toContain("Craving Creator");
  expect(result.meta.concierge?.rendering).toBe("retry");
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test("substantive nutrition education remains detailed and does not require logs or a profile", async () => {
  const message = "Protein supplies amino acids for tissue repair.\n\nCarbohydrates supply energy. Both have useful roles in a balanced eating pattern.";
  reply(message, null, unknown, { conciergeDecision: { mode: "nutrition_education", destinationId: null } });
  expect((await run("Explain protein versus carbohydrates.")).presentation?.message).toBe(message);
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test("safety screening precedes history, assessment and AI", async () => {
  const result = await run("I have chest pain.");
  expect(result.meta.redFlag).toBe(true);
  expect(result.presentation).toBeUndefined();
  expect(mockCreate).not.toHaveBeenCalled();
  expect(loadBoundedHistory).not.toHaveBeenCalled();
});

test("model-recognized escalation wins over malformed navigation and preserves care guidance", async () => {
  reply("Please seek urgent medical assistance.", null, unknown, {
    redFlag: true, redFlagReason: "Seek urgent medical assistance now.",
    conciergeDecision: { mode: "bad", destinationId: "https://invalid.example" },
  });
  const result = await run("I need help with worrying symptoms.");
  expect(result.meta.redFlag).toBe(true);
  expect(result.presentation).toBeUndefined();
  expect(result.todayPlan.items.every(item => !item.destinationId)).toBe(true);
});

test("provider failure returns an explicit retry and keeps the turn persisted without another paid attempt", async () => {
  mockCreate.mockRejectedValueOnce(new Error("simulated failure"));
  const result = await run("Something light.");
  expect(result.presentation?.message).toContain("try your request again");
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(result.messageId).toBeTruthy();
});

test("subject authorization cannot be bypassed by removing assessment", async () => {
  (getAdapter as jest.Mock).mockReturnValue({ loadSubject: jest.fn().mockRejectedValue(new Error("Unauthorized")) });
  await expect(run("Hello")).rejects.toThrow("Unauthorized");
  expect(mockCreate).not.toHaveBeenCalled();
});

test("Production delegates to the preserved structured engine", async () => {
  process.env.NODE_ENV = "production";
  const spy = jest.spyOn(StructuredCoachingEngine.prototype, "run").mockResolvedValueOnce({ legacy: true } as any);
  expect(await run("Hello")).toEqual({ legacy: true });
  expect(mockCreate).not.toHaveBeenCalled();
  spy.mockRestore();
});
