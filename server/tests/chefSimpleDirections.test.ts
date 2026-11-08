jest.mock("../db", () => ({ db: { execute: jest.fn(() => { throw new Error("Unexpected DB access"); }) } }));
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";
import { getChefConversationInstructions } from "../services/coaching/conciergeInstructions";
import { verifiedFeatureDirections, verifiedNavigationText, namedFeatureSelection, verifiedDiabeticBuilderExplanation } from "../services/coaching/verifiedNavigation";
import { COACH_NAVIGATION_GUIDANCE } from "../../shared/coaching/navigationGuidance";
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

const namedFeatures = Object.entries(COACH_NAVIGATION_GUIDANCE).flatMap(([id, record]) =>
  record.aliases.map(alias => ({ id: id as CoachDestinationId, alias })));
test.each(namedFeatures)("$id: selecting $alias gives its direct handoff without another question", async ({ id, alias }) => {
  // No model action is needed to re-ask a choice the member already made.
  const result = await reply(alias, { message: "Which feature do you want?",
    memberNeed: "unclear", responsePurpose: "clarify", navigationIntent: "none", conciergeDecision: null });
  expect(namedFeatureSelection(alias)).toBe(id);
  expect(result.presentation?.destinationId).toBe(id);
  expect(result.presentation?.navigation).toMatchObject({ state: "direct_navigation", destinationId: id });
  expect(result.presentation?.message).toBe(verifiedNavigationText(id));
  expect(result.presentation?.message).not.toMatch(/would you like|want me to|\?/i);
  expect(result.todayPlan.items).toEqual([expect.objectContaining({ kind: "use_feature", destinationId: id })]);
});
test.each(namedFeatures)("$id: a question about $alias is answered without an automatic handoff", async ({ alias }) => {
  const message = "That feature has its own workflow. I can explain its purpose and controls.";
  const result = await reply(`What is ${alias}?`, { message, responsePurpose: "answer",
    navigationIntent: "none", conciergeDecision: null });
  expect(result.presentation?.message).toBe(verifiedDiabeticBuilderExplanation(`What is ${alias}?`) ?? message);
  expect(namedFeatureSelection(`What is ${alias}?`)).toBeUndefined();
  noCard(result);
});
test.each(["fridge rescue!", "Fridge Rescue, please", "I'd like Fridge Rescue", "Let's use Fridge Rescue"])(
  "a natural named choice %s does not need a second permission question", async input => {
    const result = await reply(input);
    expect(result.presentation?.destinationId).toBe("fridge_rescue");
    expect(result.presentation?.navigation?.state).toBe("direct_navigation");
  },
);
test.each(["Where is Fridge Rescue?"])(
  "a location question gets concise directions, not an automatic handoff: %s", async input => {
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
  const first = await reply("Where is Fridge Rescue?");
  const result = await reply("Yes", { message: "Which part would you like help with?", memberNeed: "unclear",
    responsePurpose: "clarify", navigationIntent: "none", conciergeDecision: null }, {
    history: [{ role: "user", content: "Where is Fridge Rescue?" }, { role: "assistant", content: first.presentation!.message }],
  });
  noCard(result);
});
test.each(["What is Fridge Rescue?", "How does Fridge Rescue work?", "I don't want Fridge Rescue", "Fridge Rescue?"])(
  "a model direct-request tag cannot convert questions or negations into consent: %s", async userMessage => {
    const result = await reply(userMessage, { responsePurpose: "handoff", memberNeed: "navigation",
      navigationIntent: "direct_request", message: "Use the Open Fridge Rescue button.",
      handoffMessage: "Use the Open Fridge Rescue button.",
      conciergeDecision: { ...baseline.conciergeDecision, goal: {
        ...baseline.conciergeDecision.goal, explicitFeatureId: "fridge_rescue",
      } } });
    noCard(result);
  },
);
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
  expect(instructions).toContain("EVERY approved available feature");
  expect(instructions).toContain("Questions ABOUT a feature are different");
});
