// Offline prompt/response contracts, not live-model judgment. No database/provider
// may be contacted; conversation responses below are explicitly synthetic.
jest.mock("../db", () => ({
  db: { execute: jest.fn(() => { throw new Error("Unexpected database access"); }) },
}));
import { getDevelopmentPlatformKnowledge } from "../services/coaching/platformKnowledge";
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { COACH_DESTINATIONS, resolveCoachDestinationId } from "../../shared/coaching/navigation";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";
import { featureIntelligenceEnabled } from "../services/coaching/featureIntelligence";

const originalEnvironment = process.env.NODE_ENV;
beforeEach(() => { process.env.NODE_ENV = "development"; });
afterAll(() => { process.env.NODE_ENV = originalEnvironment; });
const knowledge = () => getDevelopmentPlatformKnowledge()!;
const feature = (id: string) => knowledge().features.find(item => item.id === id)!;
const tools = getCornerCapabilities(["all"], "development").map(cap => ({
  id: cap.id, label: cap.label, description: cap.description,
  featureTarget: cap.id, scope: "adult" as const,
}));

test("separates App Library, tutorial media and source-dialog knowledge", () => {
  expect(feature("nutrition_education").label).toBe("App Library");
  expect(feature("nutrition_education").entryPoint).toContain("/learn");
  expect(feature("tutorials").entryPoint).toContain("/tutorials");
  expect(feature("tutorials").purpose).toContain("Coming Soon");
  const education = knowledge().featureCatalog.find(item => item.id === "education")!;
  expect(education.name).toBe("App Library");
  expect(education.aliases).not.toContain("tutorials");
  expect(education.route).toBe("/learn");
  expect(education.gettingStarted.join(" ")).toContain("existing dialog");
});

test("separates Menu ideas from subject-owned enjoyment preferences", () => {
  expect(feature("my_perfect_menu").entryPoint).toContain("/foods-i-enjoy");
  expect(feature("food_preferences").entryPoint).toContain("/foods-i-enjoy/preferences");
  expect(feature("food_preferences").purpose).toContain("separate from My Perfect Menu");
  expect(feature("food_preferences").purpose).toContain("Neither overrides allergies");
});

test("keeps Grocery Coach tabs and Product Scan under their existing parent", () => {
  const coach = feature("grocery_coach").purpose;
  expect(coach).toContain("two tabs: Build a Meal and Find a Product");
  expect(coach).toContain("Product Scan separately");
  for (const id of ["grocery_create_meal", "grocery_find_product", "product_scan"] as const)
    expect(COACH_DESTINATIONS[id].route).toBe("/shopping-list-v2");
  expect(resolveCoachDestinationId("/shopping-list-v2")).toBeUndefined();
  expect(knowledge().platformHelp.shopping.limits.join(" ")).toContain("No approved subsection deep link");
});

test("describes Recipe Maker as a Dashboard modal and Journal as browser-local", () => {
  expect(feature("recipe_maker").entryPoint).toContain("Dashboard");
  expect(feature("recipe_maker").entryPoint).toContain("dialog/modal");
  expect(knowledge().platformHelp.recipeMaker.route).toBeNull();
  expect(resolveCoachDestinationId("/recipe-maker")).toBeUndefined();
  expect(feature("daily_journal").purpose).toContain("browser-local storage");
  expect(feature("daily_journal").purpose).toContain("cross-device synchronization are not established");
});

test("retains Production knowledge and leaves automated intelligence opt-in unchanged", () => {
  process.env.NODE_ENV = "production";
  const production = knowledge();
  expect(production.features.find(item => item.id === "nutrition_education")!.label).toBe("Learn");
  expect(production.featureCatalog.find(item => item.id === "education")!.name)
    .toBe("App Library and Tutorial Hub");
  expect(production.features.find(item => item.id === "daily_journal")!.purpose)
    .not.toContain("browser-local storage");
  expect(featureIntelligenceEnabled({ NODE_ENV: "development" })).toBe(false);
  expect(featureIntelligenceEnabled({ NODE_ENV: "production", ASK_CHEF_FEATURE_INTELLIGENCE: "true" })).toBe(false);
});

test("does not project the five obsolete capability targets or create extra buttons", () => {
  const wire = JSON.stringify(knowledge());
  for (const route of ["/check-in", "/macros", "/meals", "/pregnancy-coach", "/smart-scan"])
    expect(wire).not.toContain(`"${route}"`);
  expect(COACH_DESTINATIONS).not.toHaveProperty("recipe_maker");
  expect(COACH_DESTINATIONS).not.toHaveProperty("education");
  expect(COACH_DESTINATIONS).not.toHaveProperty("food_preferences");
  expect(COACH_DESTINATIONS).not.toHaveProperty("daily_journal");
});

const examples = [
  ["Where is App Library and how is it different from tutorials?",
    "App Library is the Learn page for topics and narration; Tutorial Hub is the separate tutorial-media page.", "nutrition_education"],
  ["Does Foods I Enjoy open my menu or edit preferences?",
    "My Perfect Menu offers meal ideas. The separate enjoyment-preferences editor records foods you enjoy.", "food_preferences"],
  ["How do I find a product rather than build a meal?",
    "Open Shopping List, then Grocery Store Coach and its Find a Product tab. Product Scan is the separate control for a product you have.", "grocery_coach"],
  ["Where do I import a recipe?",
    "On Dashboard, tap Recipe Maker to open its capture dialog. Chef does not adapt the recipe in chat.", "recipe_maker"],
  ["Will my journal sync to another device?",
    "Journal entries are saved in this browser's local storage; cross-device synchronization is not established.", "daily_journal"],
  ["Is Recipe Maker included on my plan?",
    "Recipe Maker has existing paid-access checks. I cannot determine your current effective plan from the supplied context.", "recipe_maker"],
  ["I want Grocery Store Coach but am not sure which part.",
    "Do you want Build a Meal, Find a Product, or Product Scan for an actual product?", "grocery_coach"],
] as const;

test.each(examples)("delivers corrected facts and preserves an explanation-only reply: %s", async (question, answer, id) => {
  const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    memberNeed: "feature_help", responsePurpose: question.includes("not sure") ? "clarify" : "answer",
    message: answer, conversationMessage: null, recommendationMessage: null, handoffMessage: null,
    navigationIntent: "none", conciergeDecision: null, creatorRequest: null,
    redFlag: false, redFlagReason: null, contactCare: null, careDisposition: "none",
  }) } }] });
  const result = await runConciergeConversation({
    client: { chat: { completions: { create } } } as any,
    userMessage: question, history: [], rollingContext: null,
    context: { coachingContextBlock: "Synthetic authorized nutrition facts; subscription tier unavailable." },
    tools,
  });
  expect(create).toHaveBeenCalledTimes(1);
  const request = create.mock.calls[0][0];
  const wire = JSON.parse(request.messages[1].content);
  expect(wire.platformKnowledge.features.find((item: { id: string }) => item.id === id))
    .toEqual(feature(id));
  expect(result.presentation?.message).toBe(answer);
  expect(result.presentation?.navigation).toBeUndefined();
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.todayPlan.items).toEqual([]);
  expect(JSON.stringify(wire.platformKnowledge)).not.toContain("Your plan includes");
});
