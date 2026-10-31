import fs from "node:fs";
import path from "node:path";
import { COACH_CORNER_QUESTIONS } from "../services/ace/coachCornerQuestions";
import { TodayPlanItemSchema } from "../../shared/coaching/schemas";
import { COACH_DESTINATIONS, validateCoachNavigationItems } from "../../shared/coaching/navigation";
import { runSafetyGate } from "../services/coaching/safety";
jest.mock("../db", () => ({ db: { execute: jest.fn() } }));
import { db } from "../db";
import { resolveStyle } from "../services/coaching/styleResolver";

const source = (name: string) => fs.readFileSync(path.resolve(name), "utf8");

test("all 14 behavioral questions plus the goal question remain in the questionnaire", () => {
  expect(COACH_CORNER_QUESTIONS).toHaveLength(15);
  expect(COACH_CORNER_QUESTIONS[13].id).toBe("q14_motivation_driver");
  expect(COACH_CORNER_QUESTIONS[14].id).toBe("q15_goal_type");
  expect(source("server/services/coaching/styleResolver.ts"))
    .toContain("function determineStyle");
});

test.each([
  [{ progress_mindset: "doing_something_wrong" }, "reassurance"],
  [{ trust_style: "show_science" }, "education"],
  [{ coaching_style: "simple_plan" }, "accountability"],
  [{}, "encouragement"],
])("existing behavioral style resolution remains operational", async (profile, expected) => {
  (db.execute as jest.Mock).mockResolvedValueOnce({ rows: [profile] });
  expect((await resolveStyle("synthetic-member")).mode).toBe(expected);
});

test.each([
  ["I want sushi.", "sushi_creator", "/lifestyle/sushi-creator"],
  ["I want dessert.", "dessert_creator", "/craving-desserts"],
  ["I want a smoothie.", "beverage_creator", "/lifestyle/beverage-creator"],
  ["I want a cocktail.", "beverage_creator", "/lifestyle/beverage-creator"],
  ["I need a pre-workout drink.", "athlete_beverage_creator", "/lifestyle/athlete-beverage-creator"],
  ["I need a post-workout shake.", "athlete_beverage_creator", "/lifestyle/athlete-beverage-creator"],
  ["I need hydration guidance.", "hydration_center", "/hydration"],
])("model-output fixture for %s yields the validated action", (_message, target, route) => {
  // Provider output is deliberately a fixture: no paid calls or intent-classifier claim.
  const parsed = TodayPlanItemSchema.parse({
    horizon: "today", kind: "use_feature", text: "Open the appropriate creator", featureTarget: target,
    destinationId: "model_cannot_validate_itself",
  });
  expect(parsed).not.toHaveProperty("destinationId");
  const action = validateCoachNavigationItems([parsed], true)[0];
  expect(action.destinationId).toBe(target);
  expect(COACH_DESTINATIONS[target as keyof typeof COACH_DESTINATIONS].route).toBe(route);
});

test("an actual safety match returns before ordinary engine rendering", async () => {
  expect((await runSafetyGate("I have chest pain and want a workout drink")).triggered).toBe(true);
  const engine = source("server/services/coaching/engine.ts");
  expect(engine.indexOf("if (safety.triggered)")).toBeLessThan(engine.indexOf("const { history, rollingContext }"));
  expect(engine).toContain("if (validatedReasoning.redFlag)");
});

test("stored JSON actions survive restoration and chat is not cleared on navigation", () => {
  const original = validateCoachNavigationItems([
    { kind: "use_feature", featureTarget: "sushi_creator" },
  ], true);
  expect(JSON.parse(JSON.stringify(original))).toEqual(original);
  const routes = source("server/routes/coachingEngine.ts");
  expect(routes).toContain("messages: messagesResult.rows");
  expect(routes).toContain("structured_payload");
  const button = source("client/src/components/coaching/CoachFeatureAction.tsx");
  expect(button).not.toMatch(/DELETE|localStorage|sessionStorage|generate|setMessages/);
  const page = source("client/src/pages/CoachsCorner.tsx");
  expect(page).toContain('isChefConversationEnabled()');
});

test("hydration prefill remains in its own flow; Chef navigation carries IDs only", () => {
  const button = source("client/src/components/coaching/CoachFeatureAction.tsx");
  expect(button).not.toContain("hydrationHandoff");
  expect(button).toContain("JSON.stringify({ destinationId })");
  expect(source("client/src/components/HydrationFourDoorPanels.tsx"))
    .toContain("hydrationHandoff: handoff.token");
  expect(source("client/src/pages/BeverageCreator.tsx"))
    .toContain("setCustomBeverageDescription(handoff.description)");
});
