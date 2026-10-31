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
import { getDevelopmentPlatformKnowledge } from "../services/coaching/platformKnowledge";
import { COACH_DESTINATIONS } from "../../shared/coaching/navigation";

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

test.each([
  ["I want to start making meals, but I'm not sure where to begin.",
    "Would you like suggested ideas, or do you have your own in mind?"],
  ["I want to make something sweet, but I don't know how much.",
    "Are you thinking of a small treat or a larger dessert?"],
  ["I want to make a drink, but I'm not sure what kind.",
    "Is it an everyday drink or something for a workout?"],
])("unresolved destination choice stays conversational without a premature action: %s", async (message, question) => {
  reply(question, null, unknown, { conciergeDecision: null });
  const result = await run(message);
  expect(result.presentation).toEqual({ kind: "concierge", message: question });
  expect(result.todayPlan.items).toEqual([]);
  expect(mockCreate).toHaveBeenCalledTimes(1);
  const instructions = mockCreate.mock.calls[0][0].messages[0].content;
  expect(instructions).toContain("UNRESOLVED DESTINATION CHOICE");
  expect(instructions).toContain("set conciergeDecision=null for that clarification");
  expect(instructions).toContain("does not choose Menu or Builders");
  expect(instructions).toContain("small craving-sized dessert portions");
  expect(instructions).toContain("ordinary beverage versus an athletic-performance/workout beverage");
  expect(instructions).toContain("never repeat a distinction already answered");
});

test.each([
  ["Please open My Perfect Menu.", "my_perfect_menu", { ...unknown, activity: "plan_meals", explicitFeatureId: "my_perfect_menu" }],
  ["Take me to the builders.", "meal_builders", { ...unknown, activity: "plan_meals", explicitFeatureId: "meal_builders" }],
  ["I'd like to make a small sweet treat.", "craving_creator", { ...unknown, activity: "prepare", occasion: "snack" }],
  ["I want to bake a whole cake.", "dessert_creator", { ...unknown, activity: "prepare", occasion: "dessert" }],
  ["I'd like to make an ordinary lemonade.", "beverage_creator", { ...unknown, activity: "prepare", occasion: "beverage" }],
  ["I want to make a post-workout recovery drink.", "athlete_beverage_creator", { ...unknown, activity: "prepare", occasion: "beverage", specialty: "workout" }],
])("clear intent retains direct validated navigation: %s", async (message, id, goal) => {
  reply("You can create it there.", id, goal);
  const result = await run(message);
  expect(result.presentation?.destinationId).toBe(id);
  expect(result.presentation?.message).toBe("You can create it there.");
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test.each([
  ["Would you like suggested ideas, or do you have your own in mind?", "I already have my own ideas.",
    "meal_builders", { ...unknown, activity: "plan_meals", explicitFeatureId: "meal_builders" }],
  ["Small treat or a larger dessert?", "Actually, a full cake for a party, not a small treat.",
    "dessert_creator", { ...unknown, activity: "prepare", occasion: "dessert" }],
  ["Everyday drink or workout drink?", "Not for workouts. Just an ordinary drink.",
    "beverage_creator", { ...unknown, activity: "prepare", occasion: "beverage" }],
])("an answered distinction or correction retains history and does not restart discovery: %s", async (question, correction, id, goal) => {
  const history = [
    { role: "user", content: "I'm not sure which experience to use." },
    { role: "assistant", content: question },
    { role: "user", content: correction },
  ];
  (loadBoundedHistory as jest.Mock).mockResolvedValue({ recentMessages: history, rollingContext: null });
  reply("You can start there.", id, goal);
  const result = await run("Yes, let's do that.");
  expect(result.presentation?.destinationId).toBe(id);
  expect(result.presentation?.message).toBe("You can start there.");
  const payload = JSON.parse(mockCreate.mock.calls[0][0].messages[1].content);
  expect(payload.history).toEqual(history);
  expect(payload.latestMemberMessage).toBe("Yes, let's do that.");
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test("a requested comparison can explain the distinction without selecting either tool", async () => {
  const explanation = "Craving Creator is for smaller treats; Dessert Creator is for larger recipes such as a whole cake.";
  reply(explanation, null, unknown, { conciergeDecision: null });
  const result = await run("What's the difference between Craving Creator and Dessert Creator?");
  expect(result.presentation).toEqual({ kind: "concierge", message: explanation });
  expect(result.todayPlan.items).toEqual([]);
});

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
  const modelMessage = "You've settled on chicken Caesar salad. Create a Dish can take it from here.";
  reply(modelMessage,
    null, { ...unknown, activity: "prepare", occasion: "meal", dishChosen: true },
    { creatorRequest: { idea: "Chicken Caesar salad", memberTurns: [0, 1] } });
  const result = await run("Yeah, a chicken, that's like a chicken salad, a chicken Caesar, what do you think about that?");
  expect(result.presentation).toEqual({
    kind: "concierge", message: modelMessage, destinationId: "create_a_dish",
    creatorRequest: { destinationId: "create_a_dish", idea: "Chicken Caesar salad" },
  });
  expect(result.todayPlan.items).toHaveLength(1);
  expect(result.todayPlan.items[0].destinationId).toBe("create_a_dish");
  expect(mockCreate).toHaveBeenCalledTimes(1);
  const wire = mockCreate.mock.calls[0][0];
  expect(wire.response_format.type).toBe("json_schema");
  expect(wire.response_format.json_schema.strict).toBe(true);
  const decisionProperty = wire.response_format.json_schema.schema.properties.conciergeDecision;
  const decisionSchema = decisionProperty.anyOf.find((schema: any) => schema.type === "object");
  expect(decisionProperty.anyOf).toContainEqual({ type: "null" });
  expect(decisionSchema.required).toEqual(expect.arrayContaining(["mode", "destinationId", "goal"]));
  expect(wire.messages[1].content).toContain("a chicken Caesar, what do you think"); // Actual member context, not a scripted prompt example.
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

test.each([undefined, null, { mode: "food_assistance", destinationId: null }])(
  "ordinary conversation needs no action or food-goal classification: %j", async conciergeDecision => {
    reply("What flavor sounds good?", null, unknown, { conciergeDecision });
    const result = await run("Maybe a shake.");
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.presentation?.message).toBe("What flavor sounds good?");
    expect(result.meta.concierge?.rendering).toBe("primary");
    expect(result.todayPlan.items).toEqual([]);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  },
);

const breakfastRequest = "I'm in the mood. I need to eat breakfast, but I don't want nothing heavy. I want maybe a shake. What do you think?";
const breakfastReply = "A shake sounds great for a light breakfast! Are you thinking something fruity and refreshing or something creamy and filling?";

test("exact live breakfast failure preserves a same-call conversation when its premature action is vetoed", async () => {
  const uncheckedPitch = "UNCHECKED_PITCH Open Beverage Creator now.";
  reply(uncheckedPitch, "beverage_creator", { ...unknown, occasion: "meal" },
    { conversationMessage: breakfastReply, creatorRequest: { idea: "Invented recipe", memberTurns: [0] } });
  const result = await run(breakfastRequest);
  expect(result.presentation).toEqual({ kind: "concierge", message: breakfastReply });
  expect(result.todayPlan.items).toEqual([]);
  expect(result.meta.concierge?.rendering).toBe("primary");
  const persisted = JSON.stringify((db.execute as jest.Mock).mock.calls);
  expect(persisted).toContain(breakfastReply);
  expect(persisted).not.toContain("UNCHECKED_PITCH");
  expect(persisted).not.toContain("Invented recipe");
  expect(mockCreate).toHaveBeenCalledTimes(1);

  (loadBoundedHistory as jest.Mock).mockResolvedValue({
    recentMessages: [{ role: "user", content: breakfastRequest }, { role: "assistant", content: breakfastReply }],
    rollingContext: null,
  });
  reply("Let's use Beverage Creator.", "beverage_creator",
    { ...unknown, activity: "prepare", occasion: "beverage" },
    { conversationMessage: "A fruity, light shake sounds good." });
  const ready = await run("Fruity and refreshing. Help me make a light breakfast shake.");
  expect(ready.presentation?.destinationId).toBe("beverage_creator");
  expect(ready.todayPlan.items).toHaveLength(1);
  expect(ready.presentation?.creatorRequest).toBeUndefined(); // No invented general beverage handoff.
  expect(mockCreate).toHaveBeenCalledTimes(2); // One call per turn, no repair call.
  const context = mockCreate.mock.calls[1][0].messages[1].content;
  expect(context).toContain(breakfastRequest);
  expect(context).toContain(breakfastReply);
  expect(context).toContain("availableFeatures");
  expect(context).toContain("beverage_creator");
});

test("breakfast discovery with a null action is a complete response through the active engine", async () => {
  reply(breakfastReply, null, unknown, { conciergeDecision: null, conversationMessage: breakfastReply });
  const result = await run(breakfastRequest);
  expect(result.presentation).toEqual({ kind: "concierge", message: breakfastReply });
  expect(result.todayPlan.items).toEqual([]);
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test.each([
  ["I don't know how to use My Perfect Meals.", "There are several ways to get started. Would you like help making meals, shopping, or tracking your nutrition?"],
  ["How do I make my meals?", "Meal Builders, Create a Dish and Fridge Rescue help with different starting points. Do you have a dish in mind or ingredients you want to use?"],
  ["Help me plan seven days of meals.", "Your existing builder holds dated meal boards. My Perfect Menu helps choose ideas for that workflow. I can't open those planning tools from Chef yet."],
  ["Find grocery products that fit my nutrition needs.", "Grocery Store Coach's product mode is inside Shopping List. I can't provide its navigation button here yet."],
  ["Where can I keep a private daily journal?", "Use Daily Journal & Inspiration. I can't open it from Chef yet."],
  ["How do I track my weight?", "My Biometrics includes weight tracking and trends. I can't open that page from Chef yet."],
])("platform guidance stays conversational without a forced action: %s", async (question, answer) => {
  reply(answer, null, unknown, { conciergeDecision: null, conversationMessage: answer });
  const result = await run(question);
  expect(result.presentation).toEqual({ kind: "concierge", message: answer });
  expect(result.todayPlan.items).toEqual([]);
  expect(result.meta.concierge?.rendering).toBe("primary");
  expect(mockCreate).toHaveBeenCalledTimes(1);
  const wire = mockCreate.mock.calls[0][0];
  const data = JSON.parse(wire.messages[1].content);
  expect(data.platformKnowledge.features.map((feature: any) => feature.id)).toEqual(expect.arrayContaining([
    "meal_builders", "my_perfect_menu", "grocery_coach", "daily_journal", "biometrics", "nutrition_education",
  ]));
  expect(wire.messages[0].content).toContain("Skip the introduction when their activity is clear");
  expect(wire.messages[0].content).toContain("not a fixed script, an intent tree");
  expect(wire.messages[0].content).toContain("Only action-ready food_assistance may select a feature");
  expect(data.authorizedNutritionContext).toContain("vegetarian");
});

test("adaptive conversation instructions apply to every turn without old question templates", async () => {
  reply("You can keep using this conversation.", null, unknown, { conciergeDecision: null });
  await run("I'd rather keep chatting.");
  const system = mockCreate.mock.calls[0][0].messages[0].content;
  expect(system).toContain("on every turn, not just the first welcome");
  expect(system).toContain("latest explicit correction or change of mind");
  expect(system).toContain("do not end every reply with a question");
  expect(system).toContain("Orientation can be useful at any point");
  expect(system).toContain("Only action-ready food_assistance may select a feature");
  expect(system).toContain("Medical emergencies or serious symptoms take priority");
  expect(system).toContain("Existing destinations own meal and beverage generation");
  expect(system).not.toMatch(/For simple food discovery use one or two|Breakfast and 'maybe a shake'|DISH SELECTION COMPLETES DISCOVERY|then ask what they would like to do|A chicken Caesar salad selected/);
});

test.each([
  ["How do I use Craving Creator?", "Describe what you're craving, choose your servings, and use Create when you're ready. Cooking method and Craving Category are optional."],
  ["Is the cooking method required there?", "No. Cooking method is optional; you can leave it unselected."],
  ["What does dessert recipe yield mean?", "It's how much the whole recipe makes, not how much one person eats."],
])("contextual feature help is model-authored guidance, not automatic generation: %s", async (question, answer) => {
  (loadBoundedHistory as jest.Mock).mockResolvedValue({
    recentMessages: [{ role: "user", content: "I'm learning to use Craving Creator." },
      { role: "assistant", content: "I can explain the controls you're looking at." }],
    rollingContext: null,
  });
  reply(answer, null, unknown, { conciergeDecision: null });
  const result = await run(question);
  expect(result.presentation).toEqual({ kind: "concierge", message: answer });
  expect(result.todayPlan.items).toEqual([]);
  expect(mockCreate).toHaveBeenCalledTimes(1);
  const wire = mockCreate.mock.calls[0][0];
  const context = JSON.parse(wire.messages[1].content);
  expect(context.platformKnowledge.featureUsage.craving_creator.controls.join(" ")).toContain("Cooking method is optional");
  expect(context.history[0].content).toContain("learning to use Craving Creator");
  expect(wire.messages[0].content).toContain("not scripts or mandatory tutorials");
  expect(wire.messages[0].content).toContain("Never advise disabling safety controls");
  expect(wire.messages[0].content).toContain("A how-to question is guidance");
});

test("later turns retain model-authored explanations, corrections, orientation and a direct action", async () => {
  const history = [
    { role: "user", content: "I like spicy food and want help using the app." },
    { role: "assistant", content: "We can focus on whichever part you need." },
  ];
  const exchanges = [
    ["Actually, mild food for now. Please don't give me a tour.", "Understood—mild food, and no tour.", null],
    ["Explain how fiber works. No follow-up question, please.", "Fiber helps support digestion and can affect fullness.\n\nDifferent kinds of fiber behave differently in the digestive system. Your existing dietary guidance still applies.", null],
    ["Wait, how does planning differ from creating one dish here?", "Your builder holds dated meal boards. My Perfect Menu helps choose ideas for that workflow, while Create a Dish starts with a particular dish. I can't open the planning pages from Chef yet.", null],
    ["Thanks. I'd like to keep talking, not open anything.", "Of course—we can stay here.", null],
    ["Now help me use the vegetables I already have.", "Fridge Rescue is the relevant next step for using those vegetables.", "fridge_rescue"],
  ] as const;
  for (const [message, answer, id] of exchanges) {
    (loadBoundedHistory as jest.Mock).mockResolvedValue({
      recentMessages: [...history], rollingContext: "Older context: member preferred spicy food.",
    });
    reply(answer, id, id ? { ...unknown, activity: "use_ingredients" } : unknown,
      id ? {} : { conciergeDecision: null });
    const result = await run(message);
    expect(result.presentation?.message).toBe(answer);
    expect(result.presentation?.destinationId).toBe(id ?? undefined);
    expect(result.todayPlan.items).toHaveLength(id ? 1 : 0);
    const data = JSON.parse(mockCreate.mock.calls.at(-1)[0].messages[1].content);
    expect(data.history).toEqual(history);
    expect(data.latestMemberMessage).toBe(message);
    expect(data.earlierConversation).toContain("preferred spicy");
    expect(data.authorizedNutritionContext).toContain("vegetarian");
    history.push({ role: "user", content: message }, { role: "assistant", content: answer });
  }
  expect(mockCreate).toHaveBeenCalledTimes(exchanges.length);
  const persisted = JSON.stringify((db.execute as jest.Mock).mock.calls);
  expect(persisted).toContain("Of course—we can stay here.");
  expect(resolveStyle).not.toHaveBeenCalled();
  expect(runObservers).not.toHaveBeenCalled();
});

test.each([
  "Open Craving Creator now.",
  "Open https://untrusted.example.",
  "Go to /lifestyle/create-a-dish.",
])("completed actions cannot preserve a mismatched pitch or link: %s", async message => {
  reply(message, null, { ...unknown, activity: "prepare", occasion: "meal", dishChosen: true }, {
    conversationMessage: "I can explain the next step without opening a tool.",
    creatorRequest: { idea: "Vegetable soup", memberTurns: [0] },
  });
  const result = await run("Help me make vegetable soup.");
  expect(result.presentation?.message).toBe("I can explain the next step without opening a tool.");
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.presentation?.creatorRequest).toBeUndefined();
  expect(result.todayPlan.items).toEqual([]);
  expect(JSON.stringify((db.execute as jest.Mock).mock.calls)).not.toContain(message);
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test.each([
  ["none", "Beverage Creator can help with that ordinary drink.", "beverage_creator"],
  ["workout", "Athlete Beverage Creator can help with that recovery drink.", "athlete_beverage_creator"],
  ["none", "Athlete Beverage Creator can help with that ordinary drink.", undefined],
  ["workout", "Athlete Beverage Creator or Beverage Creator can help.", undefined],
])("completed beverage wording preserves only the verified tool, including overlapping labels: %s / %s", async (specialty, message, expectedId) => {
  reply(message, null, { ...unknown, activity: "prepare", occasion: "beverage", specialty }, {
    conversationMessage: "I can help explain the next step.",
  });
  const result = await run("Help me prepare the drink.");
  expect(result.presentation?.destinationId).toBe(expectedId);
  expect(result.presentation?.message).toBe(expectedId ? message : "I can help explain the next step.");
  expect(result.todayPlan.items).toHaveLength(expectedId ? 1 : 0);
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test.each([
  ["I want to use the chicken and vegetables in my refrigerator.", "fridge_rescue", { ...unknown, activity: "use_ingredients" }],
  ["Help me make chicken nuggets.", "create_a_dish", { ...unknown, activity: "prepare", occasion: "meal", dishChosen: true }],
  ["Help me make a small brownie snack.", "craving_creator", { ...unknown, activity: "prepare", occasion: "snack" }],
  ["I want to bake a whole chocolate cake.", "dessert_creator", { ...unknown, activity: "prepare", occasion: "dessert" }],
  ["Make an everyday fruit shake.", "beverage_creator", { ...unknown, activity: "prepare", occasion: "beverage" }],
  ["Help me make a cocktail.", "beverage_creator", { ...unknown, activity: "prepare", occasion: "beverage" }],
  ["Make a post-workout recovery drink.", "athlete_beverage_creator", { ...unknown, activity: "prepare", occasion: "beverage", specialty: "workout" }],
  ["Plan food for my holiday gathering.", "my_perfect_gatherings", { ...unknown, activity: "gathering" }],
  ["Help with food for an airport trip.", "my_perfect_getaway", { ...unknown, activity: "travel" }],
])("clear member activity preserves its existing approved recommendation: %s", async (question, destinationId, goal) => {
  reply("Let's use the appropriate tool.", destinationId, goal);
  const result = await run(question);
  expect(result.presentation?.destinationId).toBe(destinationId);
  expect(result.todayPlan.items).toHaveLength(1);
  expect(result.todayPlan.items[0].destinationId).toBe(destinationId);
  expect(result.presentation?.creatorRequest).toBeUndefined();
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test("entry-page approval never authorizes choosing a specialized builder or a new handoff", async () => {
  const before = Object.keys(COACH_DESTINATIONS);
  const knowledge = getDevelopmentPlatformKnowledge()!;
  expect(knowledge.features.find(feature => feature.id === "meal_builders")?.purpose).toContain("Do not choose or activate");
  expect(knowledge.features.find(feature => feature.id === "my_perfect_menu")?.purpose).toContain("not an independent seven-day");
  expect(knowledge.features.find(feature => feature.id === "grocery_coach")?.purpose).toContain("both meal help and product help");
  expect(knowledge.features.every(feature => feature.status === "available")).toBe(true);
  expect(knowledge.unavailableFeatures.map(feature => feature.id)).toEqual(expect.arrayContaining([
    "pregnancy", "ai_pairing_advisor", "cafeteria", "templates",
  ]));
  expect(JSON.stringify(knowledge)).not.toMatch(/\/admin|professional_dashboard|business_dashboard|https?:\/\//);
  reply("UNCHECKED BUILDER PITCH", null, unknown, {
    conciergeDecision: { mode: "food_assistance", destinationId: "meal_builders", goal: unknown },
    conversationMessage: "You can review the choices on the existing selection page.",
    creatorRequest: { idea: "Invented request", memberTurns: [0] },
  });
  const result = await run("Choose a specialized builder for me.");
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.presentation?.creatorRequest).toBeUndefined();
  expect(result.presentation?.message).not.toContain("UNCHECKED");
  expect(result.todayPlan.items).toEqual([]);
  expect(Object.keys(COACH_DESTINATIONS)).toEqual(before);
});

test.each([
  ["Take me to the builders.", "meal_builders"],
  ["I'd like to start with menu ideas.", "my_perfect_menu"],
])("chosen planning approach supports ordinary wording without another question: %s", async (message, id) => {
  reply("You can start there.", id, { ...unknown, activity: "plan_meals", explicitFeatureId: id }, {
    creatorRequest: { idea: "Invented meal", memberTurns: [0] },
  });
  const result = await run(message);
  expect(result.presentation?.destinationId).toBe(id);
  expect(result.presentation?.message).toBe("You can start there.");
  expect(result.presentation?.creatorRequest).toBeUndefined();
  expect(result.todayPlan.items).toHaveLength(1);
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test.each(["my_perfect_menu", "meal_builders"])("general planning cannot authorize an unchosen %s", async id => {
  reply("UNCHECKED PITCH", id, { ...unknown, activity: "plan_meals" }, {
    conversationMessage: "Would you like ideas first, or to review your planning tools?",
  });
  const result = await run("I want to make some meals.");
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.presentation?.message).not.toContain("UNCHECKED");
});

test("comparison is conversation; latest choice replaces a previous Menu request", async () => {
  (loadBoundedHistory as jest.Mock).mockResolvedValue({
    recentMessages: [
      { role: "user", content: "Open My Perfect Menu." },
      { role: "assistant", content: "You can start with ideas there." },
    ], rollingContext: null,
  });
  reply("Menu starts with ideas; builders create and hold your meals.", null, unknown);
  const comparison = await run("What's the difference?");
  expect(comparison.presentation?.destinationId).toBeUndefined();
  reply("You can review the builders instead.", "meal_builders",
    { ...unknown, activity: "plan_meals", explicitFeatureId: "meal_builders" });
  const changed = await run("Actually, take me to the builders instead.");
  expect(changed.presentation?.destinationId).toBe("meal_builders");
  expect(mockCreate).toHaveBeenCalledTimes(2);
  const payload = JSON.parse(mockCreate.mock.calls[1][0].messages[1].content);
  expect(payload.history[0].content).toBe("Open My Perfect Menu.");
  expect(payload.latestMemberMessage).toContain("instead");
});

test.each(["my_perfect_menu", "meal_builders"])("care escalation suppresses %s even for a clear request", async id => {
  reply("Please get urgent medical help.", id,
    { ...unknown, activity: "plan_meals", explicitFeatureId: id },
    { redFlag: true, redFlagReason: "Please get urgent medical help." });
  const result = await run("Open it, but I have serious chest pain.");
  expect(result.meta.redFlag).toBe(true);
  expect(result.presentation?.destinationId).toBeUndefined();
});

test("Development knowledge refines portion-size distinctions without changing Production capabilities", () => {
  const development = getCornerCapabilities(["all"]);
  expect(development.find(feature => feature.id === "craving_creator")?.description).toContain("including small dessert portions");
  expect(development.find(feature => feature.id === "dessert_creator")?.description).toContain("larger dessert recipes");
  process.env.NODE_ENV = "production";
  expect(getDevelopmentPlatformKnowledge()).toBeUndefined();
  expect(getCornerCapabilities(["all"]).find(feature => feature.id === "dessert_creator")?.description)
    .not.toContain("Small dessert cravings belong to Craving Creator");
});

test("malformed action metadata cannot erase an independently valid model conversation", async () => {
  reply("UNSAFE_FEATURE_PITCH", null, unknown, {
    conciergeDecision: { mode: "not_a_mode", destinationId: "https://untrusted.example" },
    conversationMessage: breakfastReply,
  });
  const result = await run(breakfastRequest);
  expect(result.presentation).toEqual({ kind: "concierge", message: breakfastReply });
  expect(result.todayPlan.items).toEqual([]);
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test.each([
  undefined, "", "Open Beverage Creator now.", "Go to /auth.", "Use https://untrusted.example.",
])("a rejected action without a safe independent reply stays an explicit failure: %j", async conversationMessage => {
  reply("UNSAFE_FEATURE_PITCH", "beverage_creator", unknown, { conversationMessage });
  const result = await run(breakfastRequest);
  expect(result.meta.concierge?.rendering).toBe("retry");
  expect(result.presentation?.message).not.toContain("UNSAFE_FEATURE_PITCH");
  expect(result.todayPlan.items).toEqual([]);
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test("provider and parsing failures never become fabricated successful food replies", async () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  try {
    mockCreate.mockRejectedValueOnce(Object.assign(new Error("PRIVATE_PROVIDER_PAYLOAD"), { status: 429 }));
    const provider = await run(breakfastRequest);
    expect(provider.meta.concierge?.rendering).toBe("retry");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("failure_stage=provider provider_status=429"));
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: "invalid JSON" } }] });
    const parsing = await run(breakfastRequest);
    expect(parsing.meta.concierge?.rendering).toBe("retry");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("failure_stage=parsing"));
    expect(JSON.stringify(warn.mock.calls)).not.toContain("PRIVATE_PROVIDER_PAYLOAD");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  } finally { warn.mockRestore(); }
});

test("an incomplete structured response cannot publish partial conversation or an action", async () => {
  mockCreate.mockResolvedValueOnce({ choices: [{ message: {
    content: '{"message":"PARTIAL_PRIVATE_REPLY","conciergeDecision":{"mode":"food_assistance","destinationId":"create_a_dish"',
  } }] });
  const result = await run("How do I use Create a Dish?");
  expect(result.meta.concierge?.rendering).toBe("retry");
  expect(result.presentation?.message).not.toContain("PARTIAL_PRIVATE_REPLY");
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.todayPlan.items).toEqual([]);
  expect(JSON.stringify((db.execute as jest.Mock).mock.calls)).not.toContain("PARTIAL_PRIVATE_REPLY");
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test("a provider connection interruption stays truthful without replay or a second call", async () => {
  mockCreate.mockRejectedValueOnce(Object.assign(new Error("simulated connection interruption"), { code: "ECONNRESET" }));
  const result = await run("Explain the servings control.");
  expect(result.meta.concierge?.rendering).toBe("retry");
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.presentation?.message).toContain("try your request again");
  expect(result.todayPlan.items).toEqual([]);
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

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
