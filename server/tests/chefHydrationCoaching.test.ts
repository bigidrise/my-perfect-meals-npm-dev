// Synthetic provider and fail-fast DB stub: no bootstrap, live accounts or paid calls.
jest.mock("../db", () => ({
  db: { execute: jest.fn(() => { throw new Error("Unexpected database access"); }) },
}));

import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";
import { FEATURE_USAGE_KNOWLEDGE, getFeatureUsageKnowledge } from "../services/coaching/featureUsageKnowledge";
import { CHEF_CONVERSATION_INSTRUCTIONS, getChefConversationInstructions } from "../services/coaching/conciergeInstructions";
import { getDevelopmentPlatformKnowledge, getPlatformGuidanceInstructions, PLATFORM_GUIDANCE_INSTRUCTIONS } from "../services/coaching/platformKnowledge";
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { verifiedNavigationText } from "../../shared/coaching/navigationGuidance";
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
    memberNeed: ["confirmed", "direct_request"].includes(String(extra.navigationIntent)) ? "navigation" : "nutrition_guidance",
    responsePurpose: ["confirmed", "direct_request"].includes(String(extra.navigationIntent)) ? "handoff" :
      extra.navigationIntent === "recommendation" ? "answer_with_offer" : "answer",
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
  const usage = getFeatureUsageKnowledge("development").hydration_center!;

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
    const instructions = getChefConversationInstructions("development");
    expect(create.mock.calls[0][0].messages[0].content).toContain(instructions);
    expect(instructions).toContain("message is the one complete visible reply");
    expect(instructions).toContain("an informational answer needs no feature");
    expect(instructions).toContain("A navigation-only request needs no nutrition lecture");
    expect(instructions).toContain("without assuming a proposed food is suitable");
  });
});

describe("Development-only drink suitability contracts (not live model judgment)", () => {
  it("leaves Production knowledge, instructions and capability descriptions unchanged", () => {
    const development = getFeatureUsageKnowledge("development");
    expect(getFeatureUsageKnowledge("production")).toEqual(development);
    expect(getFeatureUsageKnowledge("test")).toEqual(development);
    expect(getChefConversationInstructions("production")).toBe(getChefConversationInstructions("development"));
    expect(getPlatformGuidanceInstructions("production")).toBe(getPlatformGuidanceInstructions("development"));
    for (const id of ["beverage_creator", "athlete_beverage_creator", "hydration_center"] as const) {
      expect(FEATURE_USAGE_KNOWLEDGE[id]?.suitability).toBeUndefined();
      expect(development[id]?.suitability).toBeDefined();
      expect(development[id]?.suitability).not.toHaveProperty("verifiedSources");
      const production = getCornerCapabilities(["all"], "production").find(cap => cap.id === id)!;
      const dev = getCornerCapabilities(["all"], "development").find(cap => cap.id === id)!;
      expect(production.description).toContain("Suitability and timing:");
      expect(dev.route).toBe(production.route);
      expect(dev.description).toContain("Suitability and timing:");
    }
    expect(getFeatureUsageKnowledge("development").fridge_rescue).toBe(FEATURE_USAGE_KNOWLEDGE.fridge_rescue);
  });

  it("puts need, exclusions, timing and limitations in the actual single-call payload", async () => {
    const { create, wire } = await turn({});
    for (const id of ["beverage_creator", "athlete_beverage_creator", "hydration_center"]) {
      expect(wire.platformKnowledge.featureUsage[id].suitability).toEqual(expect.objectContaining({
        purpose: expect.any(String), suitableNeeds: expect.any(Array), notFor: expect.any(Array),
        informationNeeded: expect.any(Array), offerWhen: expect.any(String), deferWhen: expect.any(String),
        safetyBoundaries: expect.any(Array), relatedFeatures: expect.any(Array),
      }));
    }
    expect(JSON.stringify(wire.platformKnowledge.featureUsage)).not.toContain("verifiedSources");
    const system = create.mock.calls[0][0].messages[0].content;
    expect(system).toContain("clear preparation goal can settle culinary discovery, but not an unresolved concern");
    expect(system).toContain("clear drink format with a resolved underlying need");
    expect(system).not.toContain("use the relevant existing workflow directly");
    expect(system).toContain("A suitable feature may naturally support a nutrition answer");
    expect(create).toHaveBeenCalledTimes(1);
  });

  // These checks establish that contrasting guidance reaches the model for
  // each scenario. They do NOT claim a mock can evaluate semantic selection.
  it.each([
    ["I want a strawberry protein shake.", "beverage_creator", "purpose", "ordinary beverage recipes"],
    ["I'm tired of drinking the same smoothies.", "beverage_creator", "suitableNeeds", "variety"],
    ["I want a sugar-free iced coffee.", "beverage_creator", "safetyBoundaries", "do not guarantee sugar-free"],
    ["I'm nauseous and struggling to eat.", "beverage_creator", "deferWhen", "difficulty eating or drinking"],
    ["I'm pregnant and having trouble drinking enough fluids.", "hydration_center", "safetyBoundaries", "pregnancy-specific"],
    ["I'm taking medication and having difficulty eating.", "hydration_center", "notFor", "comprehensive medication checks"],
    ["I need help staying hydrated during long workouts.", "hydration_center", "offerWhen", "initial fit"],
    ["I want a post-workout recovery shake.", "athlete_beverage_creator", "offerWhen", "without a detour"],
    ["I'm sick and having trouble keeping fluids down.", "hydration_center", "safetyBoundaries", "Necessary care is never delayed"],
    ["I just want something different to drink with dinner.", "beverage_creator", "informationNeeded", "ordering or buying"],
  ])("supplies grounded contrasting guidance for %s", async (userMessage, id, field, evidence) => {
    const { create, wire } = await turn({}, { userMessage });
    expect(wire.latestMemberMessage).toBe(userMessage);
    expect(JSON.stringify(wire.platformKnowledge.featureUsage[id].suitability[field])).toContain(evidence);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("provides precise Hydration limitations rather than promising a medical liquid plan", () => {
    const suitability = getFeatureUsageKnowledge("development").hydration_center!.suitability!;
    expect(suitability.notFor.join(" ")).toContain("Designing a specialized medical liquid-nutrition plan");
    expect(suitability.safetyBoundaries.join(" ")).toContain("basic tolerability suggestions");
    expect(suitability.safetyBoundaries.join(" ")).toContain("user confirmation is not professional verification");
    expect(suitability.relatedFeatures.join(" ")).toContain("no section selection, symptom transfer");
    expect(getDevelopmentPlatformKnowledge()?.featureUsage.hydration_center?.suitability).toEqual(suitability);
  });

  it.each(["beverage_creator", "athlete_beverage_creator", "hydration_center"] as const)(
    "defers %s when the supplied turn identifies material clarification, even with a valid ready goal", async id => {
      const goal = id === "hydration_center" ? hydrationGoal :
        { ...shakeGoal, specialty: id === "athlete_beverage_creator" ? "workout" as const : "none" as const };
      const clarification = "Are you able to tolerate fluids, or is drinking difficult as well?";
      const { result } = await turn({
        responsePurpose: "clarify", message: `A Creator could help. Would you like to open it?`,
        conversationMessage: clarification, navigationIntent: "recommendation",
        conciergeDecision: decision(id, goal),
      }, { userMessage: "Actually, this has been happening for several days and eating is difficult." });
      expect(result.presentation?.message).toBe(clarification);
      expect(result.presentation?.navigation).toBeUndefined();
      expect(result.todayPlan.items).toEqual([]);
    },
  );

  it("preserves follow-up context and a supplied nonrepetitive clarification without manufacturing an offer", async () => {
    const userMessage = "Actually, it's been happening for several days, and I'm having trouble eating regular meals.";
    const history = [{ role: "user", content: question }, { role: "assistant", content: offer }];
    const clarification = "That change in duration and eating matters. Are fluids staying down?";
    const { result, wire } = await turn({
      responsePurpose: "clarify", message: clarification,
    }, { userMessage, history });
    expect(wire.history).toEqual(history);
    expect(result.presentation?.message).toBe(clarification);
    expect(result.presentation?.navigation).toBeUndefined();
  });

  it.each(["beverage_creator", "athlete_beverage_creator", "hydration_center"] as const)(
    "necessary referral suppresses a ready %s recommendation", async id => {
      const goal = id === "hydration_center" ? hydrationGoal :
        { ...shakeGoal, specialty: id === "athlete_beverage_creator" ? "workout" as const : "none" as const };
      const care = "Please arrange medical assessment for the continuing intake difficulty. Are fluids staying down?";
      const { result } = await turn({
        message: care, contactCare: care, careDisposition: "referral",
        navigationIntent: "recommendation", conciergeDecision: decision(id, goal),
      });
      expect(result.todayPlan.items).toEqual([{ horizon: "today", kind: "contact_care", text: care }]);
      expect(result.presentation?.navigation).toBeUndefined();
      expect(result.presentation?.destinationId).toBeUndefined();
    },
  );
});

describe("advice plus a validated feature recommendation", () => {
  // These supplied model replies prove field selection and navigation contracts,
  // not that a live model independently produces the desired conversational tone.
  it("keeps the nutrition answer in the visible recommendation, without concatenating unchecked fields", async () => {
    const { result } = await turn({
      message: offer, recommendationMessage: "UNUSED_RECOMMENDATION_SENTINEL",
      conversationMessage: "UNUSED_CONTINUATION_SENTINEL",
      navigationIntent: "recommendation", conciergeDecision: decision("beverage_creator", shakeGoal),
    });
    expect(result.presentation?.message).toBe(offer);
    expect(result.presentation?.message).toContain(advice);
    expect(JSON.stringify(result)).not.toContain("SENTINEL");
    expect(result.presentation?.navigation).toEqual({
      state: "recommendation_pending", destinationId: "beverage_creator", goal: shakeGoal,
      offeredAt: expect.any(String),
    });
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
  });

  it("needs only one acceptance of the pending recommendation and does not repeat advice or permission", async () => {
    const first = await turn({
      message: offer, recommendationMessage: null, navigationIntent: "recommendation",
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
    expect(result.presentation?.message).toBe(verifiedNavigationText("beverage_creator"));
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
    expect(result.presentation?.message).toBe(verifiedNavigationText("hydration_center"));
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
