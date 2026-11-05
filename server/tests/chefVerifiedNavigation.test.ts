import { COACH_DESTINATIONS } from "../../shared/coaching/navigation";
import { COACH_NAVIGATION_GUIDANCE, verifiedNavigationText } from "../../shared/coaching/navigationGuidance";
import { explicitNavigationRequest, namedNavigationDestinations, verifiedLocationAnswer, knowledgeOnlyLocationAnswer } from "../services/coaching/verifiedNavigation";
import { screenOrdinaryConversation, screenConversationalContinuation } from "../services/coaching/conciergeReplyScreening";
import { validateConciergeGoal } from "../services/coaching/conciergeGoal";
import { navigationGoal } from "../services/coaching/verifiedNavigation";

describe("reviewed navigation authority", () => {
  test.each([
    ["Take me to Fridge Rescue.", "fridge_rescue"],
    ["Where is Fridge Rescue?", "fridge_rescue"],
    ["Can you give me directions to Fridge Rescue?", "fridge_rescue"],
    ["Open Create a Dish.", "create_a_dish"],
    ["I want to create a dish.", "create_a_dish"],
    ["Take me to Meal Builders.", "meal_builders"],
    ["Take me to my shopping list.", "shopping_list"],
    ["Open my biometrics.", "biometrics"],
    ["Show me my daily journal.", "daily_journal"],
    ["Open Athlete Beverage Creator.", "athlete_beverage_creator"],
    ["Please open Restaurant Assistant.", "restaurant_guide"],
  ])("%s resolves only the named destination", (request, id) => {
    expect(explicitNavigationRequest(request)).toBe(id);
  });

  test.each([
    "How does Fridge Rescue work?", "How do I use the meal builders?",
    "I need to eat at a restaurant.", "I want to make a shake.",
    "I need a pre-workout drink.", "Do not open Fridge Rescue.",
    "Should I open Fridge Rescue or Create a Dish?",
    "Open Fridge Rescue and delete my shopping list.",
    'The message said "Open Fridge Rescue".',
    "I have chest pain. Open Fridge Rescue.",
    "Open Fridge Rescue if it is not clinical.",
    "Open Fridge Rescue for my patient's account.",
    "Open Fridge Rescueevil.", "Open my clients biometrics.",
  ])("%s is not whole named navigation authority", request => {
    expect(explicitNavigationRequest(request)).toBeUndefined();
  });

  test("longest feature name does not misroute Athlete Beverage Creator", () => {
    expect(namedNavigationDestinations("Open Athlete Beverage Creator.")).toEqual(["athlete_beverage_creator"]);
  });

  test.each([
    "Open the Shopping List: From your dashboard, navigate to the Shopping List. Select Fridge Rescue.",
    "Fridge Rescue is inside Shopping List.",
    "You can find Fridge Rescue under the Shopping List menu.",
    "Shopping List contains Fridge Rescue.",
    "Go to Lifestyle > Shopping List > Fridge Rescue.",
  ])("neither ordinary prose nor recovery may invent a relationship: %s", text => {
    expect(screenOrdinaryConversation(text, "development").text).toBeUndefined();
    expect(screenConversationalContinuation(text, false, "development").text).toBeUndefined();
  });

  test("location recovery uses current member input, not an invented destination", () => {
    const answer = verifiedLocationAnswer("How does Fridge Rescue work?", [{ id: "fridge_rescue" }]);
    expect(answer).toContain("Lifestyle → Fridge Rescue");
    expect(answer).toContain("Shopping List is not its entry point");
    expect(verifiedLocationAnswer("How does Fridge Rescue work?", [])).toBeUndefined();
    expect(verifiedLocationAnswer("Fridge Rescue or Create a Dish?", [{ id: "fridge_rescue" }])).toBeUndefined();
  });

  test.each(["shopping_list", "biometrics", "daily_journal"] as const)(
    "%s cannot be inferred from a food-generation activity", id => {
      expect(validateConciergeGoal({
        mode: "food_assistance", destinationId: id,
        goal: { ...navigationGoal(id), explicitFeatureId: null, activity: "prepare" },
      }, [{ id }], [])?.destinationId).toBeNull();
      expect(validateConciergeGoal({
        mode: "food_assistance", destinationId: id, goal: navigationGoal(id),
      }, [{ id }], [COACH_DESTINATIONS[id].label])?.destinationId).toBe(id);
    },
  );

  test("every action has a reviewed entry and no model URL", () => {
    expect(Object.keys(COACH_NAVIGATION_GUIDANCE).sort()).toEqual(Object.keys(COACH_DESTINATIONS).sort());
    for (const id of Object.keys(COACH_NAVIGATION_GUIDANCE) as Array<keyof typeof COACH_NAVIGATION_GUIDANCE>) {
      expect(verifiedNavigationText(id)).toContain("Open ");
      expect(verifiedNavigationText(id)).not.toMatch(/https?:|javascript:|href=/i);
    }
  });

  test.each(["My Favorites", "Recipe Maker", "App Library", "Tutorial Hub", "Performance Nutrition Hub", "My Perfect Pets", "Academy"])(
    "%s has reviewed directions but never a fabricated action", name => {
      expect(explicitNavigationRequest(`Open ${name}.`)).toBeUndefined();
      expect(knowledgeOnlyLocationAnswer(`Open ${name}.`, true)).toContain("cannot provide its opening action");
    },
  );

  test("Recipe Maker remains a dashboard dialog, not a guessed URL", () => {
    expect(knowledgeOnlyLocationAnswer("Open Recipe Maker.", true)).toContain("capture dialog");
    expect(knowledgeOnlyLocationAnswer("Open Recipe Maker and delete it.", true)).toBeUndefined();
  });
});
