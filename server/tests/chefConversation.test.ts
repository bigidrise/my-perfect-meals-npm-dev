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

test("preferences, food ideas and changed intent remain in the actual one-call history", async () => {
  const history = [
    { role: "user", content: "I want something light." },
    { role: "assistant", content: "Spicy, tangy, or fresh?" },
    { role: "user", content: "Spicy." },
    { role: "assistant", content: "Seafood, chicken, or plant-based?" },
  ];
  (loadBoundedHistory as jest.Mock).mockResolvedValue({ recentMessages: history,
    rollingContext: "The member wants something light, not a heavy meal." });
  reply("How about spicy shrimp tacos or shrimp lettuce wraps?");
  const first = await run("Actually, I'd rather have seafood.");
  expect(first.presentation?.message).toContain("shrimp");
  expect(first.presentation?.destinationId).toBeUndefined();
  const sent = mockCreate.mock.calls[0][0].messages[1].content;
  for (const item of history) expect(sent).toContain(item.content);
  expect(sent).toContain("Actually, I'd rather have seafood.");
  reply("Making them or going out?");
  expect((await run("Shrimp tacos sound good.")).presentation?.message).toContain("Making");
  expect(mockCreate).toHaveBeenCalledTimes(2); // One per turn, not two.
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
