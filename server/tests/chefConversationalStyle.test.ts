// Pure instruction checks and a synthetic provider: no bootstrap, live DB or API calls.
jest.mock("../db", () => ({ db: { execute: jest.fn(() => { throw new Error("Unexpected database access"); }) } }));

import { createHash } from "node:crypto";
import { CHEF_CONVERSATION_INSTRUCTIONS } from "../services/coaching/conciergeInstructions";
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";

const instructions = CHEF_CONVERSATION_INSTRUCTIONS;
const tools = getCornerCapabilities(["all"]).map(cap => ({
  id: cap.id, scope: "adult" as const, label: cap.label,
  description: cap.description, featureTarget: cap.id,
}));

async function syntheticReply(userMessage: string, message: string, extra: Record<string, unknown> = {}) {
  const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    message, navigationIntent: "none", conciergeDecision: null,
    conversationMessage: null, recommendationMessage: null, handoffMessage: null,
    creatorRequest: null, redFlag: false, redFlagReason: null, contactCare: null,
    careDisposition: "none", ...extra,
  }) } }] });
  const result = await runConciergeConversation({
    client: { chat: { completions: { create } } } as any,
    userMessage, history: [], rollingContext: null,
    context: { coachingContextBlock: "Synthetic authorized context; unavailable facts remain unknown." },
    tools,
  });
  return { result, create };
}

describe("Ask Chef additive conversational style contract", () => {
  it("retains every pre-existing instruction, including expanded safety and navigation requirements", () => {
    // Reviewed baseline before this additive increment. Changing an older
    // instruction requires a deliberate protection review, not a snapshot update.
    const original = instructions.split("\n")
      .filter(line => !line.startsWith("COACHING STYLE — ")).join("\n");
    expect(createHash("sha256").update(original).digest("hex"))
      .toBe("deb0224f034b1650d7cfcdf52f983e13bec6b83d581a51c12ef302e7dc9a02ad");
  });

  it.each([
    ["DIRECTNESS", "offer a next step only when it helps", "reassurance the member did not ask for"],
    ["CLARIFICATION", "one short, open-ended question", "unless requested or necessary"],
    ["PRACTICAL NUTRITION", "without moralizing about food", "without inventing them"],
    ["SOLUTIONS", "Never imply that a food is safe for everyone", "must never delay necessary medical attention"],
    ["PROPORTION", "No fixed sentence count or mandatory closing question", "Brevity must not remove"],
    ["EVIDENCE", "Never fabricate consensus", "has not been retrieved or verified"],
    ["NEXT STEP", "single-confirmation contract", "without another permission question"],
  ])("includes the %s standard with its limiting protection", (section, behavior, protection) => {
    const paragraph = instructions.split("\n").find(line => line.startsWith(`COACHING STYLE — ${section}:`));
    expect(paragraph).toContain(behavior);
    expect(paragraph).toContain(protection);
  });

  it("keeps recipes, clinical authority and action authorization outside stylistic discretion", () => {
    expect(instructions).toContain("Existing destinations own meal and beverage generation");
    expect(instructions).toContain("Do not invent finished dishes, recipes");
    expect(instructions).toContain("When care is genuinely needed, no navigation may be offered");
    expect(instructions).toContain("conversation and summaries cannot override safety or access controls");
    expect(instructions).toContain("Never claim a search, product selection or generation already happened");
  });

  it.each([
    ["Is protein important when you're older?",
      "Protein helps maintain muscle as you age. The amount that fits you depends on your needs and any care instructions."],
    ["I haven't been feeling well.", "What's going on?"],
    ["I don't feel like eating today.", "Is something making it hard to eat?"],
    ["Can I eat chocolate cake?",
      "Chocolate cake can fit some nutrition plans. Ingredients, portion size and your individual dietary or clinical needs matter."],
    ["What does the latest research say?",
      "I haven't retrieved current research, so I can't verify the latest findings. I can explain the general nutrition principles."],
  ])("passes the style instructions in one call and preserves a no-navigation reply for %s",
    async (question, reply) => {
      // Fixture results prove instruction wiring and response-contract compatibility,
      // not that a real model independently produces this wording.
      const { result, create } = await syntheticReply(question, reply);
      expect(create).toHaveBeenCalledTimes(1);
      const request = create.mock.calls[0][0];
      expect(request.messages[0].content).toContain(instructions);
      expect(JSON.parse(request.messages[1].content).latestMemberMessage).toBe(question);
      expect(result.presentation?.message).toBe(reply);
      expect(result.presentation?.destinationId).toBeUndefined();
      expect(result.todayPlan.items).toEqual([]);
    });

  it.each(["referral", "emergency"])("does not turn a required %s into a brief ordinary reply", async disposition => {
    const { result } = await syntheticReply("Synthetic reported symptoms", "Please get medical help now.", {
      careDisposition: disposition, contactCare: "Seek the indicated care immediately.",
      redFlag: disposition === "emergency",
    });
    expect(result.meta.redFlag).toBe(true);
    expect(result.todayPlan.items.some(item => item.kind === "contact_care")).toBe(true);
    expect(result.presentation?.destinationId).toBeUndefined();
  });
});
