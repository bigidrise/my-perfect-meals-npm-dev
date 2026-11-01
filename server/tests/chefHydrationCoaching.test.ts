// Synthetic provider and fail-fast DB stub: no bootstrap, live accounts or paid calls.
jest.mock("../db", () => ({
  db: { execute: jest.fn(() => { throw new Error("Unexpected database access"); }) },
}));

import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";
import { FEATURE_USAGE_KNOWLEDGE } from "../services/coaching/featureUsageKnowledge";
import { CHEF_CONVERSATION_INSTRUCTIONS } from "../services/coaching/conciergeInstructions";
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { HYDRATION_DOOR_DEFINITIONS } from "../../shared/hydration/fourDoor";
import { COACH_DESTINATIONS } from "../../shared/coaching/navigation";
import type { ConciergeGoal } from "../../shared/coaching/schemas";
import type { PendingRecommendation } from "../services/coaching/conciergeNavigationState";

// The released registry is intentionally active only in development/production,
// not Jest's default "test" environment. This is local to this isolated suite.
const previousEnvironment = process.env.NODE_ENV;
process.env.NODE_ENV = "development";
afterAll(() => { process.env.NODE_ENV = previousEnvironment; });

const tools = getCornerCapabilities(["all"]).map(cap => ({
  id: cap.id, scope: "adult" as const, label: cap.label,
  description: cap.description, featureTarget: cap.id,
}));
const shakeGoal: ConciergeGoal = {
  activity: "prepare", occasion: "beverage", restaurant: "unknown",
  dishChosen: false, specialty: "none", explicitFeatureId: null,
};
const hydrationGoal: ConciergeGoal = { ...shakeGoal, activity: "hydration", occasion: "unknown" };
const question = "I feel a little nauseous this morning, but I still need breakfast. Maybe a shake?";
const advice = "A small, light shake may be an option if tolerated; you do not need to force a full-sized portion.";
const offer = `${advice} Beverage Creator can help you make one. Would you like to open it?`;
const continuation = "Try a small amount of something you tolerate; seek care if symptoms worsen or you cannot keep fluids down.";
const decision = (destinationId: string, goal: ConciergeGoal) => ({
  mode: "food_assistance", destinationId, goal,
});

async function turn(extra: Record<string, unknown>, options: {
  userMessage?: string;
  availableTools?: typeof tools;
  pending?: PendingRecommendation;
  history?: Array<{ role: string; content: string }>;
} = {}) {
  const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    message: advice, conversationMessage: null, recommendationMessage: null,
    handoffMessage: null, conciergeDecision: null, creatorRequest: null,
    navigationIntent: "none", careDisposition: "none",
    redFlag: false, redFlagReason: null, contactCare: null, ...extra,
  }) } }] });
  const result = await runConciergeConversation({
    client: { chat: { completions: { create } } } as any,
    userMessage: options.userMessage ?? question, history: options.history ?? [],
    rollingContext: null, context: { coachingContextBlock: "Synthetic authorized nutrition context." },
    tools: options.availableTools ?? tools, pendingRecommendation: options.pending,
  });
  return { result, create, wire: JSON.parse(create.mock.calls[0][0].messages[1].content) };
}

describe("Ask Chef verified Hydration knowledge", () => {
  const hydration = tools.find(tool => tool.id === "hydration_center")!;
  const usage = FEATURE_USAGE_KNOWLEDGE.hydration_center!;

  it.each(HYDRATION_DOOR_DEFINITIONS)("describes the implemented $title section in capability and usage knowledge", door => {
    expect(hydration.description).toContain(door.title);
    expect(usage.controls.some(control => control.startsWith(`${door.title}:`))).toBe(true);
  });

  it("preserves the approved route and explicitly limits the advertised capabilities", () => {
    expect(COACH_DESTINATIONS.hydration_center).toEqual({
      label: "Hydration Center", route: "/hydration", access: "hydration",
    });
    expect(hydration.description).toContain("does not itself generate recipes or perform comprehensive medication checks");
    expect(hydration.description).toContain("Never invent fluid or electrolyte targets");
    expect(hydration.description).toContain("no automatic section selection, symptom transfer, protocol activation or generation");
    expect(hydration.description).toContain("nausea alone does not establish a hydration goal");
    expect(usage.controls.join(" ")).toContain("complete, active, professionally verified instructions");
    expect(usage.notes.join(" ")).toContain("For making a regular shake, Beverage Creator is more appropriate");
    expect(usage.notes.join(" ")).toContain("necessary medical assessment or urgent care takes priority");
  });

  it("delivers the expanded knowledge and complete-visible-reply instruction in the existing single call", async () => {
    const { create, wire } = await turn({});
    expect(create).toHaveBeenCalledTimes(1);
    expect(wire.availableFeatures.find((feature: { id: string }) => feature.id === "hydration_center").description)
      .toBe(hydration.description);
    expect(wire.platformKnowledge.featureUsage.hydration_center).toEqual(usage);
    expect(create.mock.calls[0][0].messages[0].content).toContain(CHEF_CONVERSATION_INSTRUCTIONS);
    expect(CHEF_CONVERSATION_INSTRUCTIONS).toContain("make recommendationMessage the complete useful reply");
    expect(CHEF_CONVERSATION_INSTRUCTIONS).toContain("An ordinary informational answer needs no feature");
    expect(CHEF_CONVERSATION_INSTRUCTIONS).toContain("a navigation-only request needs no added nutrition lecture");
    expect(CHEF_CONVERSATION_INSTRUCTIONS).toContain("do not automatically select Hydration Center from nausea alone");
  });
});

describe("advice plus a validated feature recommendation", () => {
  // These supplied model replies prove field selection and navigation contracts,
  // not that a live model independently produces the desired conversational tone.
  it("keeps the nutrition answer in the visible recommendation, without concatenating unchecked fields", async () => {
    const { result } = await turn({
      message: "UNUSED_PRIMARY_SENTINEL", recommendationMessage: offer,
      conversationMessage: "UNUSED_CONTINUATION_SENTINEL",
      navigationIntent: "recommendation", conciergeDecision: decision("beverage_creator", shakeGoal),
    });
    expect(result.presentation?.message).toBe(offer);
    expect(result.presentation?.message).toContain(advice);
    expect(JSON.stringify(result)).not.toContain("SENTINEL");
    expect(result.presentation?.navigation).toEqual({
      state: "recommendation_pending", destinationId: "beverage_creator", goal: shakeGoal,
    });
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
  });

  it("needs only one acceptance of the pending recommendation and does not repeat advice or permission", async () => {
    const first = await turn({
      recommendationMessage: offer, navigationIntent: "recommendation",
      conciergeDecision: decision("beverage_creator", shakeGoal),
    });
    const handoff = "Describe the shake you want in the drink field, then use the page's creation action.";
    const { result } = await turn({
      message: advice, navigationIntent: "confirmed", handoffMessage: handoff,
      conciergeDecision: null,
    }, {
      userMessage: "Yes, please.", pending: first.result.presentation!.navigation!,
      history: [{ role: "user", content: question }, { role: "assistant", content: offer }],
    });
    expect(result.presentation?.message).toBe(handoff);
    expect(result.presentation?.destinationId).toBe("beverage_creator");
    expect(result.presentation?.navigation?.state).toBe("navigation_confirmed");
    expect(result.todayPlan.items.some(item => item.kind === "use_feature")).toBe(true);
  });

  it("leaves an informational nausea answer conversational rather than automatically selecting Hydration", async () => {
    const { result } = await turn({});
    expect(result.presentation?.message).toBe(advice);
    expect(result.presentation?.navigation).toBeUndefined();
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
  });

  it("retains direct navigation without forcing a nutrition lecture", async () => {
    const handoff = "Choose the section that matches your need.";
    const { result } = await turn({
      message: handoff, handoffMessage: handoff, navigationIntent: "direct_request",
      conciergeDecision: decision("hydration_center", {
        ...hydrationGoal, explicitFeatureId: "hydration_center",
      }),
    }, { userMessage: "Open Hydration Center." });
    expect(result.presentation?.message).toBe(handoff);
    expect(result.presentation?.destinationId).toBe("hydration_center");
    expect(result.presentation?.navigation?.state).toBe("direct_navigation");
  });

  it("does not let expanded knowledge authorize an unavailable Hydration destination", async () => {
    const { result } = await turn({
      recommendationMessage: "Hydration Center offers practical support. Would you like to open it?",
      conversationMessage: continuation, navigationIntent: "recommendation",
      conciergeDecision: decision("hydration_center", hydrationGoal),
    }, { availableTools: tools.filter(tool => tool.id !== "hydration_center") });
    expect(result.presentation?.message).toBe(continuation);
    expect(result.presentation?.navigation).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
  });

  it.each([shakeGoal, { ...hydrationGoal, activity: "unknown" as const }])(
    "does not relax Hydration readiness for incompatible or unresolved goals: %j", async goal => {
      const { result } = await turn({
        recommendationMessage: "Hydration Center could help. Would you like to open it?",
        conversationMessage: continuation, navigationIntent: "recommendation",
        conciergeDecision: decision("hydration_center", goal),
      });
      expect(result.presentation?.message).toBe(continuation);
      expect(result.presentation?.navigation).toBeUndefined();
      expect(result.todayPlan.items).toEqual([]);
    });

  it.each(["referral", "emergency"])("lets %s suppress the proposed navigation and preserve care guidance", async careDisposition => {
    const care = "Seek the indicated medical assessment now; do not wait for a drink recipe.";
    const { result } = await turn({
      message: care, contactCare: care, careDisposition, redFlag: careDisposition === "emergency",
      recommendationMessage: offer, navigationIntent: "recommendation",
      conciergeDecision: decision("beverage_creator", shakeGoal),
    });
    expect(result.meta.redFlag).toBe(true);
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.todayPlan.items).toEqual([{ horizon: "today", kind: "contact_care", text: care }]);
    expect(JSON.stringify(result)).not.toContain(offer);
  });
});
