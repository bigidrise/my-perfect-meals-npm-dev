import { screenOrdinaryConversation, screenIndependentConversation,
  screenConversationalContinuation } from "../services/coaching/conciergeReplyScreening";
import { COACH_DESTINATIONS } from "../../shared/coaching/navigation";

describe("Development reply screening, not member intent or consent", () => {
  test.each([
    "Would you like help adding protein to breakfast?",
    "Do you want help finding protein-rich meals?",
    "Shall we start with breakfast?",
    "Can I help you find a breakfast that fits your tastes?",
    "Ready to start increasing your protein?",
    "Would you like to explore practical portion adjustments?",
    "Would you like help choosing meals or shakes?",
    "Would you like to open a can of tuna for lunch?",
    "Beverage Creator is another option. Would you like to start with your usual breakfast?",
    "Do you want Build a Meal, Find a Product, or Product Scan for an actual product?",
    "Which meal makes getting enough protein hardest?",
    "Thanks, that's all for now.",
  ])("accepts ordinary advice without authorizing navigation: %s", text => {
    expect(screenOrdinaryConversation(text, "development")).toEqual({ reason: "accepted", text });
  });
  test.each([
    "Would you like me to open Beverage Creator?",
    "Would you like to use Beverage Creator?",
    "Beverage Creator can help. Would you like to use it?",
    "Beverage Creator can help. Would you like to open it?",
    "Do you want me to navigate to the meal planner?",
    "Shall I take you to that feature?",
    "Should we launch the tool?",
    "May I send you to the page?",
    "Would you like to open Beverage Creator or another feature?",
    "Would you like to open it?",
  ])("requires the structured navigation path: %s", text => {
    expect(screenOrdinaryConversation(text, "development")).toEqual({ reason: "permission_question" });
  });
  test.each([
    [null, "missing"], ["", "missing"], ["👍", "placeholder"], ["MODEL_REPLY_PENDING", "placeholder"],
    ["Try https://example.test/PRIVATE_MODEL_TEXT", "link"],
    [`Try ${COACH_DESTINATIONS.beverage_creator.route}`, "route_reference"],
  ] as const)("classifies without returning rejected prose: %s", (text, reason) => {
    expect(screenOrdinaryConversation(text, "development")).toEqual({ reason });
  });
  test("retains feature isolation and rejected-action continuation checks", () => {
    expect(screenIndependentConversation("Beverage Creator can make a shake.", undefined, false, "development"))
      .toEqual({ reason: "feature_reference" });
    expect(screenConversationalContinuation("Click the button to continue.", false, "development"))
      .toEqual({ reason: "navigation_language" });
    expect(screenConversationalContinuation("Would you like help adding protein to breakfast?", false, "development").reason)
      .toBe("accepted");
  });
  test.each(["production", "test"])("preserves historical behavior in %s", environment => {
    expect(screenOrdinaryConversation("Would you like help adding protein to breakfast?", environment))
      .toEqual({ reason: "accepted", text: "Would you like help adding protein to breakfast?" });
    const text = "Which meal makes getting enough protein hardest?";
    expect(screenOrdinaryConversation(text, environment)).toEqual({ reason: "accepted", text });
  });
});
