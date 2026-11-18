// Offline language and call-site contracts. No real account, DB or model.
jest.mock("../db", () => ({
  db: { execute: jest.fn(() => { throw new Error("Unexpected DB access"); }) }, pool: {},
}));
import fs from "node:fs";
import { requestLanguageContext } from "../utils/languageInstruction";
import { buildGuestEnvelope, enforceBeforeGenerate } from "../services/protocolEnvelope";
import { runConciergeConversation } from "../services/coaching/conciergeConversation";

function inLanguage<T>(header: string, operation: () => T): T {
  let result!: T;
  requestLanguageContext({ headers: { "x-mpm-ui-language": header } }, null, () => { result = operation(); });
  return result;
}
beforeEach(() => {
  global.fetch = jest.fn(() => { throw new Error("Unexpected external fetch"); }) as any;
});

test.each([["en", "es", false], ["es", "en", true], ["auto", "es", true], ["auto", "en", false], ["fr", "es", false]])(
  "Getaway's actual envelope language: saved=%s display=%s Spanish=%s", (saved, display, spanish) => {
    const envelope = { ...buildGuestEnvelope(), preferredLanguage: saved, allergies: ["peanuts"] };
    const before = JSON.stringify(envelope);
    const result = inLanguage(display, () => enforceBeforeGenerate(envelope, {
      generatorName: "getaway_coach", userInput: "What can I ask about at this destination?",
    }));
    expect(result.combined.includes("entirely in Spanish")).toBe(spanish);
    expect(result.combined).toContain("peanuts");
    expect(JSON.stringify(envelope)).toBe(before);
    // Call-site proof only, not a mocked route or live model-compliance claim.
    const route = fs.readFileSync("server/routes/getaway.ts", "utf8");
    expect(route).toContain("contextParts.push(enforceBeforeGenerate(protocolEnvelope, {");
    expect(route).toContain("generatorName: \"getaway_coach\"");
    expect(route).toContain("contextParts.join(\"\\n\\n\")");
    expect(route).toContain('{ role: "user", content: userPrompt }');
  },
);

test.each([["en", "es", false], ["es", "en", true], ["auto", "es", true], ["auto", "en", false], ["fr", "es", false]])(
  "Ask Chef's actual provider request: saved=%s display=%s Spanish=%s", async (saved, display, spanish) => {
    const reply = spanish ? "¿En qué puedo ayudarte con la aplicación?" : "How can I help with the app?";
    const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      memberNeed: "feature_help", responsePurpose: "answer",
      message: reply, conversationMessage: null, recommendationMessage: null, handoffMessage: null,
      navigationIntent: "none", conciergeDecision: null, creatorRequest: null,
      redFlag: false, redFlagReason: null, contactCare: null, careDisposition: "none",
    }) } }] });
    const result = await inLanguage(display, () => runConciergeConversation({
      client: { chat: { completions: { create } } } as any,
      userMessage: "How do I use the application?", history: [], rollingContext: null,
      context: { coachingContextBlock: "Synthetic read-only context." }, tools: [], preferredLanguage: saved,
    }));
    expect(create).toHaveBeenCalledTimes(1);
    const request = create.mock.calls[0][0];
    expect(request.messages[0].content.includes("entirely in Spanish")).toBe(spanish);
    expect(result.presentation?.kind).toBe("concierge");
    expect(result.presentation?.message).toBe(reply);
    expect(result.todayPlan.items).toEqual([]);
    expect(request.response_format.type).toBe("json_schema");
    expect(request.response_format.json_schema.strict).toBe(true);
  },
);
