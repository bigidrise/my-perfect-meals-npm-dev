jest.mock("../db", () => ({ db: { execute: jest.fn(() => { throw new Error("Unexpected DB access"); }) } }));
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";
import { getChefConversationInstructions } from "../services/coaching/conciergeInstructions";
import { verifiedFeatureDirections } from "../services/coaching/verifiedNavigation";
import type { CoachDestinationId } from "../../shared/coaching/navigation";

const environment = process.env.NODE_ENV;
beforeEach(() => { process.env.NODE_ENV = "development"; });
afterAll(() => { process.env.NODE_ENV = environment; });
const baseline = {
  message: "Would you like me to open Fridge Rescue?", conversationMessage: null,
  memberNeed: "feature_help", responsePurpose: "feature_only_offer",
  navigationIntent: "recommendation", conciergeDecision: {
    mode: "food_assistance", destinationId: "fridge_rescue",
    goal: { activity: "use_ingredients", occasion: "unknown", restaurant: "unknown",
      dishChosen: false, specialty: "none", explicitFeatureId: null },
  },
  careDisposition: "none", redFlag: false,
};
async function reply(userMessage: string, extra: Record<string, unknown> = {}, options: {
  history?: Array<{ role: string; content: string }>; unavailable?: string;
} = {}) {
  const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ ...baseline, ...extra }) } }] });
  const result = await runConciergeConversation({
    client: { chat: { completions: { create } } } as any, userMessage,
    history: options.history ?? [], rollingContext: null, context: {},
    tools: getCornerCapabilities(["all"]).filter(tool => tool.id !== options.unavailable),
  });
  expect(create).toHaveBeenCalledTimes(1);
  return result;
}
function noCard(result: Awaited<ReturnType<typeof reply>>) {
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.presentation?.navigation).toBeUndefined();
  expect(result.todayPlan.items).toEqual([]);
}

test.each(["Fridge Rescue", "fridge rescue!", "Where is Fridge Rescue?"])(
  "a named feature gets concise directions, no open card or permission: %s", async input => {
    const result = await reply(input, { memberNeed: "navigation", responsePurpose: "handoff",
      navigationIntent: "direct_request", handoffMessage: "Use the Open Fridge Rescue button." });
    expect(result.presentation?.message).toBe(verifiedFeatureDirections("fridge_rescue"));
    expect(result.presentation?.message).toContain("enter the ingredients you have");
    expect(result.presentation?.message).not.toMatch(/would you|open .*button|can help|feel free/i);
    noCard(result);
  },
);
test.each([false, true])("a classified ingredient-use need gets directions without a permission exchange; history=%s", async earlier => {
  const result = await reply("I have food in my refrigerator and don't know what to make.", {}, {
    history: earlier ? [{ role: "user", content: "What is fiber?" }, { role: "assistant", content: "Fiber supports digestion." }] : [],
  });
  expect(result.presentation?.message).toBe(verifiedFeatureDirections("fridge_rescue"));
  noCard(result);
});
test.each(["beverage_creator", "athlete_beverage_creator", "dessert_creator"] as CoachDestinationId[])(
  "%s is treated as practical workflow help, not a Fridge-specific routing rule", async id => {
    const result = await reply(id === "dessert_creator" ? "I want to bake a whole pie." : "I want to make a shake.", {
      message: "Would you like me to open that feature?",
      conciergeDecision: { ...baseline.conciergeDecision, destinationId: id, goal: {
        ...baseline.conciergeDecision.goal, activity: "prepare", occasion: id === "dessert_creator" ? "dessert" : "beverage",
        specialty: id === "athlete_beverage_creator" ? "workout" : "none",
      } },
    });
    expect(result.presentation?.message).toBe(verifiedFeatureDirections(id));
    noCard(result);
  },
);
test("a refrigerator in an unrelated question is not a workflow router", async () => {
  const message = "For refrigerator repairs, consult the appliance manual or a qualified technician.";
  const result = await reply("My refrigerator is making a loud noise.", {
    message, memberNeed: "unclear", responsePurpose: "answer", navigationIntent: "none", conciergeDecision: null,
  });
  expect(result.presentation?.message).toBe(message);
  noCard(result);
});
test("a bare Yes after directions has no offer to confirm", async () => {
  const first = await reply("Fridge Rescue");
  const result = await reply("Yes", { message: "Which part would you like help with?", memberNeed: "unclear",
    responsePurpose: "clarify", navigationIntent: "none", conciergeDecision: null }, {
    history: [{ role: "user", content: "Fridge Rescue" }, { role: "assistant", content: first.presentation!.message }],
  });
  noCard(result);
});
test("explicit opening requests still get the existing authorized action", async () => {
  const result = await reply("Open Fridge Rescue.");
  expect(result.presentation?.destinationId).toBe("fridge_rescue");
  expect(result.presentation?.navigation?.state).toBe("direct_navigation");
  expect(result.todayPlan.items).toHaveLength(1);
});
test("directions never override an unavailable feature or an emergency", async () => {
  const unavailable = await reply("Fridge Rescue", {}, { unavailable: "fridge_rescue" });
  noCard(unavailable);
  expect(unavailable.presentation?.message).not.toBe(verifiedFeatureDirections("fridge_rescue"));
  const care = await reply("Fridge Rescue", { redFlag: true, careDisposition: "emergency", message: "Seek urgent medical care." });
  expect(care.meta.redFlag).toBe(true);
  expect(care.todayPlan.items[0].kind).toBe("contact_care");
  expect(care.presentation).toBeUndefined();
});
test("unsafe generated content is not rescued by the directions projection", async () => {
  const result = await reply("I need to use my ingredients.", { message: "Use https://unsafe.invalid now." });
  noCard(result);
  expect(result.presentation?.message).not.toContain("https://");
  expect(result.presentation?.message).not.toBe(verifiedFeatureDirections("fridge_rescue"));
});
test("Production retains its existing permission flow", async () => {
  process.env.NODE_ENV = "production";
  const result = await reply("Where is Fridge Rescue?");
  expect(result.presentation?.navigation?.state).toBe("recommendation_pending");
});
test("Development instructions no longer demand an opening offer for initial activity help", () => {
  const instructions = getChefConversationInstructions("development");
  expect(instructions).toContain("SIMPLE WORKFLOW HELP:");
  expect(instructions).not.toContain("INITIAL ACTIVITY HELP:");
  expect(instructions).not.toContain("Do not substitute directions alone");
  expect(instructions).toContain("Builder Tutorial");
});
