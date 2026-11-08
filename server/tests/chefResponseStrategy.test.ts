// These tests verify instruction/evidence delivery, not live model adherence.
// Loading a real provider or database is forbidden during this review.
jest.mock("../db", () => { throw new Error("Strategy review imported application database"); });
jest.mock("pg", () => { throw new Error("Strategy review imported PostgreSQL"); });
jest.mock("openai", () => { throw new Error("Strategy review imported a real provider"); });

import { createHash } from "node:crypto";
import { createReviewSession, reviewAnswer } from "../../scripts/ask-chef-review/session";
import { REVIEW_FIXTURES } from "../../scripts/ask-chef-review/fixtures";
import { getChefConversationInstructions } from "../services/coaching/conciergeInstructions";
import { getPlatformGuidanceInstructions } from "../services/coaching/platformKnowledge";
import { CHEF_FOOD_COMPATIBILITY_INSTRUCTIONS } from "../services/coaching/foodCompatibility";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const originalEnvironment = process.env.NODE_ENV;
const originalDeployment = process.env.REPLIT_DEPLOYMENT;
let info: jest.SpyInstance;
beforeEach(() => {
  process.env.NODE_ENV = "development";
  delete process.env.REPLIT_DEPLOYMENT;
  info = jest.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  info.mockRestore();
  process.env.NODE_ENV = originalEnvironment;
  if (originalDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
  else process.env.REPLIT_DEPLOYMENT = originalDeployment;
});

test("one contiguous general strategy replaces the scattered coaching blocks", () => {
  const instructions = getChefConversationInstructions("development");
  const lines = instructions.split("\n");
  const labels = [
    "INTENT AND USEFUL HELP", "PROGRESSION", "MATERIAL QUESTIONS", "MEMBER EVIDENCE",
    "TARGET AND INTAKE AUTHORITY", "MPM NEXT ACTIONS", "FLEXIBILITY AND EVIDENCE", "SAFETY LIMITS",
  ];
  const start = lines.findIndex(line => line.startsWith("RESPONSE STRATEGY —"));
  expect(start).toBe(lines.findIndex(line => line.startsWith("You are Chef in Ask Chef,")) + 1);
  expect(lines.filter(line => line.startsWith("RESPONSE STRATEGY —")))
    .toEqual(labels.map((label, index) => {
      expect(lines[start + index]).toMatch(new RegExp(`^RESPONSE STRATEGY — ${label}:`));
      return lines[start + index];
    }));
  expect(instructions).not.toMatch(/^PURPOSEFUL FOLLOW-THROUGH:|^FOLLOW-THROUGH —|^MACRO COACHING:|^MEMBER PERSONALIZATION:/m);
  expect(instructions).not.toMatch(/^COACHING STYLE — (DIRECTNESS|CLARIFICATION|PRACTICAL NUTRITION|SOLUTIONS|PROPORTION|EVIDENCE|NEXT STEP):/m);
  for (const requirement of [
    "Answer a factual food or nutrition question directly",
    "offer a few practical, compatible actions",
    "Treat 'I don't know' as a valid answer",
    "recognize what Chef has already recommended",
    "only when a missing answer materially changes that guidance",
    "not a nutrient-specific script or fixed response template",
    "Do not calculate a new personal target",
    "Unknown allergies remain unknown",
    "do not suggest finding another app",
    "no fixed greeting, question count, sentence count, mandatory list or closing question",
    "do not claim a live lookup or add another research/model call",
  ]) expect(instructions).toContain(requirement);
});

test("all 30 retained Development policy paragraphs match their pre-consolidation bytes", () => {
  // Captured from the assembled instructions BEFORE editing, not regenerated
  // from the implementation under test. Includes role, care, ownership,
  // navigation/consent, shopping, creator handoff and structured-output contracts.
  const retained = getChefConversationInstructions("development").split("\n")
    .filter(line => !line.startsWith("RESPONSE STRATEGY —") && !line.startsWith("VERIFIED NAVIGATION AUTHORITY:") &&
      !line.startsWith("CONCISE NAVIGATION CONTRACT:") && !line.startsWith("INITIAL ACTIVITY HELP:"));
  expect(retained).toHaveLength(30);
  expect(hash(retained.join("\n"))).toBe("6de21aef592734982e67587ac893ab74b28207f760cf287c3eae23ccb13b9533");
});

test.each(["production", "test", undefined])("released instruction bytes remain unchanged for %s", environment => {
  expect(hash(getChefConversationInstructions(environment)))
    .toBe("ede377b73cd6111e35727b224508e703a0c78940e80120332f874be6b35da7df");
  expect(getChefConversationInstructions(environment)).toBe(getChefConversationInstructions("development")
    .split("\n").filter(line => !line.startsWith("INITIAL ACTIVITY HELP:")).join("\n"));
  expect(getChefConversationInstructions(environment)).not.toContain("INITIAL ACTIVITY HELP:");
  expect(getChefConversationInstructions(environment)).toContain("Diabetes alone does not select a builder or authorize ignoring carbohydrate limits");
});

test("reviewed navigation guidance and unchanged mandatory food-screening instructions retain their fingerprints", () => {
  expect(hash(getPlatformGuidanceInstructions("development")))
    .toBe("284f2db2bd6a1984ab1b7bfdf85723beb3398d94620e6bbf10596c1df5d9c919");
  // The only change to this historical guidance fingerprint is the separately
  // approved public name. Preserve the pre-rename byte comparison as evidence.
  expect(hash(getPlatformGuidanceInstructions("development").replaceAll("Restaurant Assistant", "Restaurant Guide")))
    .toBe("79792d454c73a80398a953e12a78d4dbf175c2a9fa11ba34504d8a42615e081b");
  expect(hash(CHEF_FOOD_COMPATIBILITY_INSTRUCTIONS))
    .toBe("49f2eb490e4ed41497785f84d4ed6cccdea3c6a32ce77dccc45ec30d35e5f66b");
});

test.each(REVIEW_FIXTURES)("Phase 1 harness delivers the strategy and selected history across five synthetic turns: %s", async fixture => {
  const turns = [
    "What do carbohydrates do?",
    "I'd like more variety in the meals I already eat.",
    "I don't know what my usual intake is.",
    "Actually, focus on drinks instead.",
    "Thanks, that's all I needed.",
  ];
  const create = jest.fn(async (_request: any) => ({
    choices: [{ message: { content: JSON.stringify(reviewAnswer(
      "An injected review reply, not evidence of live coaching quality.")) } }],
  }));
  const session = createReviewSession({ fixture, client: { chat: { completions: { create } } } as any });
  const displayedHistory: Array<{ role: string; content: string }> = [];
  let firstEvidence: string | undefined;
  for (const [index, input] of turns.entries()) {
    const response = await session.send(input);
    const request = create.mock.calls[index][0];
    const wire = JSON.parse(request.messages[1].content);
    const assembled = getChefConversationInstructions("development");
    expect(request.messages[0].content.split(assembled)).toHaveLength(2);
    expect(request.messages[0].content).toContain(CHEF_FOOD_COMPATIBILITY_INSTRUCTIONS);
    expect(request).toMatchObject({ model: "gpt-4o", temperature: 0.4, max_tokens: 2000 });
    expect(request.messages).toHaveLength(2);
    expect(wire).toMatchObject({
      latestMemberMessage: input, history: displayedHistory,
      earlierConversation: null, pendingRecommendation: null,
    });
    firstEvidence ??= wire.authorizedNutritionContext;
    expect(wire.authorizedNutritionContext).toBe(firstEvidence);
    expect(wire.authorizedNutritionContext).toContain("SYNTHETIC REVIEW EVIDENCE ONLY");
    expect(wire.memberStatements.map((statement: { text: string }) => statement.text))
      .toEqual(turns.slice(0, index + 1));
    expect(response.foodCompatibility?.status).not.toBe("blocked");
    expect(response.presentation?.navigation).toBeUndefined();
    displayedHistory.push({ role: "user", content: input },
      { role: "assistant", content: response.presentation!.message });
    expect(session.transcript()).toEqual(displayedHistory);
  }
  expect(create).toHaveBeenCalledTimes(turns.length);
  // A new session remains fresh even after the completed five-turn review.
  const fresh = createReviewSession({ fixture, client: { chat: { completions: { create } } } as any });
  expect(fresh.transcript()).toEqual([]);
});
