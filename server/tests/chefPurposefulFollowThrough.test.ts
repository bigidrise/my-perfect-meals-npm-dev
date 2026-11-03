// Deterministic instruction/wire/response contracts, not live model judgment.
// No application bootstrap, real provider construction or account/database writes.
jest.mock("../db", () => ({
  db: { execute: jest.fn(() => { throw new Error("Unexpected database access"); }) },
  pool: { query: jest.fn(() => { throw new Error("Unexpected pool access"); }) },
}));
jest.mock("openai", () => ({
  __esModule: true, default: jest.fn(() => { throw new Error("Unexpected provider construction"); }),
}));
jest.mock("../services/coaching/featureIntelligence", () => ({
  ...jest.requireActual("../services/coaching/featureIntelligence"),
  featureIntelligenceEnabled: () => false,
}));

import { db } from "../db";
import { CHEF_CONVERSATION_INSTRUCTIONS, getChefConversationInstructions } from "../services/coaching/conciergeInstructions";
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";

const originalEnvironment = process.env.NODE_ENV;
beforeEach(() => {
  process.env.NODE_ENV = "development";
  jest.clearAllMocks();
});
afterAll(() => { process.env.NODE_ENV = originalEnvironment; });

type History = Array<{ role: string; content: string }>;
const tools = getCornerCapabilities(["all"], "development").map(cap => ({
  id: cap.id, label: cap.label, description: cap.description, featureTarget: cap.id, scope: "adult" as const,
}));
const context = {
  coachingContextBlock: "Synthetic member evidence: goal=lose 10 lb; timeline=12 weeks; " +
    "saved baseline=1800 kcal, protein=120 g, carbohydrate=195 g, fat=60 g; " +
    "allergies=peanuts; restriction=vegetarian; previous attempts=unknown; " +
    "progress=unavailable; default empty arrays do not establish explicit none.",
};

async function reply(userMessage: string, message: string, options: {
  history?: History; rollingContext?: string; purpose?: "answer" | "clarify";
  context?: Record<string, unknown>; care?: boolean; blockedTools?: boolean;
} = {}) {
  const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    memberNeed: "nutrition_guidance", responsePurpose: options.purpose ?? "answer",
    navigationIntent: "none", message, conversationMessage: null, recommendationMessage: null,
    handoffMessage: null, conciergeDecision: null, creatorRequest: null,
    redFlag: options.care ?? false, redFlagReason: options.care ? "Synthetic acute danger" : null,
    contactCare: options.care ? "Seek emergency medical help now." : null,
    careDisposition: options.care ? "emergency" : "none",
  }) } }] });
  const result = await runConciergeConversation({
    client: { chat: { completions: { create } } } as any,
    userMessage, history: options.history ?? [], rollingContext: options.rollingContext ?? null,
    context: options.context ?? context, tools: options.blockedTools ? [] : tools,
  });
  expect(create).toHaveBeenCalledTimes(1);
  expect(db.execute).not.toHaveBeenCalled();
  const request = create.mock.calls[0][0];
  expect(request.model).toBe("gpt-4o");
  const wire = JSON.parse(request.messages[1].content);
  return { result, request, wire };
}

function ordinary(result: Awaited<ReturnType<typeof reply>>["result"], message: string) {
  expect(result.presentation?.message).toBe(message);
  expect(result.whatIFound).toBe(message);
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.presentation?.navigation).toBeUndefined();
  expect(result.todayPlan.items).toEqual([]);
}

test.each([
  "Thanks, that's all I needed.", "Thank you! That answers my question.",
  "No thanks, that's all.", "That's all for now.", "I’m all set, thanks!", "Goodbye.",
])("Development replaces an unrelated nutrition list with a brief close: %s", async latest => {
  const { result, wire } = await reply(latest, "Eat chicken, fish, eggs, tofu and beans for protein.", {
    history: [{ role: "user", content: "What foods provide protein?" }],
  });
  ordinary(result, "You're welcome. Take care!");
  expect(wire.latestMemberMessage).toBe(latest);
});

test.each([
  "Thanks, that's all I needed. How much protein is in tofu?",
  "Thanks, that's all I needed, but please explain fiber.",
  "That's all for now—can you open the meal builder?",
  "Thanks, that's all I needed. I have chest pain.",
  'Why did you say "Thanks, that\'s all I needed"?',
])("Development does not swallow substantive mixed content: %s", async latest => {
  const { result, wire } = await reply(latest, "A substantive reply to the latest message.");
  ordinary(result, "A substantive reply to the latest message.");
  expect(wire.latestMemberMessage).toBe(latest);
});

test("model safety escalation wins over a clear closing statement", async () => {
  const { result } = await reply("Thanks, that's all I needed.", "Please get urgent help.", { care: true });
  expect(result.meta.redFlag).toBe(true);
  expect(result.todayPlan.items.some(item => item.kind === "contact_care")).toBe(true);
  expect(result.presentation?.message).not.toBe("You're welcome. Take care!");
});

test("Production does not apply the Development closing override", async () => {
  process.env.NODE_ENV = "production";
  const message = "The existing released model reply.";
  const { result } = await reply("Thanks, that's all I needed.", message);
  ordinary(result, message);
});

test("Development reconciles destination-only discovery with optional nutrition follow-through", () => {
  const instructions = getChefConversationInstructions("development");
  expect(instructions).toContain("explore an underlying nutrition goal only when useful");
  expect(instructions).toContain("unresolved nutrition goal, barrier, destination or safe next step");
  expect(instructions).toContain("clarify may include useful conditional advice or a direct factual answer");
  expect(instructions).toContain("A question is optional, never an engagement target or a mandatory ending");
  expect(instructions).toContain("Do not create a fixed questionnaire");
  expect(instructions).toContain("Do not automatically promote My Perfect Meals features");
  expect(instructions).not.toContain("ask only what is necessary to identify the appropriate verified destination");
  expect(instructions.match(/^PURPOSEFUL FOLLOW-THROUGH:/gm)).toHaveLength(1);
});

test.each([
  ["FOLLOW-THROUGH — MICRONUTRIENTS:", "explain micronutrients and useful food sources first", "not evidence of a deficiency"],
  ["FOLLOW-THROUGH — WEIGHT MANAGEMENT:", "Distinguish general education from personal guidance", "Do not re-ask known facts"],
  ["FOLLOW-THROUGH — CONTINUITY AND STOPPING:", "latest explicit correction", "does not update saved goals"],
  ["FOLLOW-THROUGH — PROPORTION AND AUTHORITY:", "known, unknown, unavailable, explicit-none and freshness distinctions", "Clinical safety"],
])("delivers the %s instruction and its boundaries", async (prefix, requirement, boundary) => {
  const { request } = await reply("What can you explain about nutrition?", "I can explain food and nutrition principles.");
  const paragraph = request.messages[0].content.split("\n").find((line: string) => line.startsWith(prefix));
  expect(paragraph).toContain(requirement);
  expect(paragraph).toContain(boundary);
});

test.each(["production", "test", undefined])("does not change released instruction selection: %s", environment => {
  const instructions = getChefConversationInstructions(environment);
  expect(instructions).toBe(CHEF_CONVERSATION_INSTRUCTIONS);
  expect(instructions).not.toContain("PURPOSEFUL FOLLOW-THROUGH:");
});

test("micronutrient education retains the useful answer plus an optional purpose question without a feature action", async () => {
  const message = "Vitamins and minerals support many body functions. Vegetables, fruit, beans and whole grains " +
    "provide a variety of micronutrients. Are you trying to improve overall meal quality, or are you concerned about missing certain vitamins or minerals?";
  const { result, wire, request } = await reply("What foods have lots of vitamins and minerals?", message, { purpose: "clarify" });
  ordinary(result, message);
  expect(request.messages[0].content).toContain("If that purpose is already known, use it instead of asking again");
  expect(wire.authorizedNutritionContext).toBe(context.coachingContextBlock);
});

test("the next turn receives the actual preceding question and member answer without restarting discovery", async () => {
  const question = "What foods have lots of vitamins and minerals?";
  const answer = "Vegetables, fruit, beans and whole grains offer many nutrients. Are you focused on overall meal quality or missing particular nutrients?";
  const first = await reply(question, answer, { purpose: "clarify" });
  const history: History = [
    { role: "user", content: question },
    { role: "assistant", content: first.result.presentation!.message },
  ];
  const latest = "Overall meal quality, not a deficiency.";
  const message = "For overall quality, choose a variety of vegetables, fruit, beans and whole grains while respecting your peanut allergy.";
  const { result, wire } = await reply(latest, message, { history });
  ordinary(result, message);
  expect(wire.history).toEqual(history);
  expect(wire.latestMemberMessage).toBe(latest);
  expect(wire.memberStatements.map((value: { text: string }) => value.text)).toEqual([question, latest]);
  expect(wire.memberStatements).not.toContainEqual(expect.objectContaining({ text: answer }));
});

test("weight-management personal guidance receives known goals and targets while allowing one unknown-barrier question", async () => {
  const message = "Your saved goal is to lose 10 lb over 12 weeks. Consistent meals and sustainable habits can help. " +
    "What has been the biggest challenge when you have tried to manage your weight?";
  const { result, wire } = await reply("I want personal advice for losing weight.", message, { purpose: "clarify" });
  ordinary(result, message);
  expect(wire.authorizedNutritionContext).toContain("timeline=12 weeks");
  expect(wire.authorizedNutritionContext).toContain("saved baseline=1800 kcal");
  expect(wire.authorizedNutritionContext).toContain("previous attempts=unknown");
  expect(wire.authorizedNutritionContext).toContain("allergies=peanuts");
});

test("general weight-management education can be complete without personalization or a follow-up", async () => {
  const message = "In general, sustainable eating habits, regular activity and adequate sleep can support weight management.";
  ordinary((await reply("What advice do you have for someone trying to lose weight?", message)).result, message);
});

test("missing member evidence remains explicitly unknown rather than being filled in or recalculated", async () => {
  const evidence = { coachingContextBlock: "goal=unknown; targets=unavailable; allergies=unknown; restrictions=unknown" };
  const message = "I do not have a saved goal or targets available. What outcome would you like personal guidance with?";
  const { result, wire } = await reply("Can you personalize weight-management advice?", message, {
    purpose: "clarify", context: evidence,
  });
  ordinary(result, message);
  expect(wire.authorizedNutritionContext).toBe(evidence.coachingContextBlock);
  expect(evidence.coachingContextBlock).not.toContain("1800");
});

test("a short factual answer is preserved without appending a question or a feature offer", async () => {
  const message = "Protein provides about 4 calories per gram.";
  ordinary((await reply("How many calories are in one gram of protein?", message)).result, message);
});

test("latest correction and older conflicting context are both supplied without rewriting account evidence", async () => {
  const history: History = [
    { role: "user", content: "I want to lose weight." },
    { role: "assistant", content: "What part of following your plan is difficult?" },
  ];
  const rollingContext = "Older discussion: the member wants to lose weight.";
  const latest = "Actually, I'm not trying to lose weight anymore.";
  const message = "Understood—we will not focus on weight loss. That does not change your saved account goals or targets.";
  const before = JSON.stringify({ context, history });
  const { result, wire, request } = await reply(latest, message, { history, rollingContext });
  ordinary(result, message);
  expect(wire.latestMemberMessage).toBe(latest);
  expect(wire.earlierConversation).toBe(rollingContext);
  expect(wire.history).toEqual(history);
  expect(wire.authorizedNutritionContext).toBe(context.coachingContextBlock);
  expect(JSON.stringify({ context, history })).toBe(before);
  expect(request.messages[0].content).toContain("stop using the superseded assumption");
});

test.each(["No thanks, that's all.", "Just answer the question, please.", "I don't want to discuss my goals."])(
  "a declined discussion can close without another question or navigation: %s", async latest => {
    const message = latest === "Just answer the question, please." ? "Protein provides about 4 calories per gram." : "Understood.";
    const history: History = [
      { role: "user", content: "How many calories are in one gram of protein?" },
      { role: "assistant", content: "Protein provides about 4 calories per gram. What nutrition goal are you working on?" },
    ];
    const { result, wire, request } = await reply(latest, message, { history });
    ordinary(result, latest === "No thanks, that's all." ? "You're welcome. Take care!" : message);
    expect(wire.latestMemberMessage).toBe(latest);
    expect(wire.history).toEqual(history);
    expect(request.messages[0].content).toContain("declines further discussion, changes topics or indicates they are finished");
  },
);

test("a topic change after coaching receives its own answer rather than forcing the old interview", async () => {
  const message = "Protein provides about 4 calories per gram.";
  const { result, wire } = await reply("Different topic: how many calories are in one gram of protein?", message, {
    history: [{ role: "assistant", content: "What has made weight management challenging?" }],
  });
  ordinary(result, message);
  expect(wire.latestMemberMessage).toContain("Different topic");
});

test("a member can initiate a new question after declining without reviving the declined discussion", async () => {
  const message = "Vitamin D helps the body absorb calcium.";
  const { result, wire } = await reply("One more factual question: what vitamin helps calcium absorption?", message, {
    history: [{ role: "user", content: "No thanks, that's all." }, { role: "assistant", content: "Understood." }],
  });
  ordinary(result, message);
  expect(wire.history[0].content).toBe("No thanks, that's all.");
});

test("ordinary follow-through does not require or grant access to any destination", async () => {
  const message = "Vegetables, fruit and beans provide a range of vitamins and minerals.";
  const { result, wire } = await reply("What foods contain vitamins and minerals?", message, { blockedTools: true });
  ordinary(result, message);
  expect(wire.availableFeatures).toEqual([]);
});

test("declining discussion cannot suppress an existing emergency care response", async () => {
  const { result } = await reply("I have severe chest pain, but no questions please.", "Seek emergency medical help now.", {
    care: true,
  });
  expect(result.meta.redFlag).toBe(true);
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.todayPlan.items.some(item => item.kind === "contact_care")).toBe(true);
});

test("the delivered personal-coaching instructions prefer material assessment over another generic list", async () => {
  const { request } = await reply("I think I'm eating the same foods too often.",
    "What do your meals typically look like over a day?", { purpose: "clarify" });
  const instructions = request.messages[0].content;
  expect(instructions).toContain("Distinguish general information requests from personal nutrition concerns on each turn");
  expect(instructions).toContain("Prefer one useful assessment question over a broad set of recommendations");
  expect(instructions).toContain("first understand the member's current eating pattern when it is not supplied");
  expect(instructions).toContain("If that pattern is already known, build on it without asking again");
  expect(instructions).toContain("Lists remain appropriate when explicitly requested or useful with sufficient context");
  expect(instructions).toContain("rather than ending with a generic invitation to ask for more tips");
});

test("the delivered protein guidance separates available targets from unknown consumption and record access", async () => {
  const { request } = await reply("I'm concerned about getting enough protein.",
    "What protein-containing foods do you usually eat in a day?", { purpose: "clarify" });
  const instructions = request.messages[0].content;
  expect(instructions).toContain("Do not assume access to dietary intake records, current protein consumption or saved targets");
  expect(instructions).toContain("A supplied target is not evidence of consumption");
  expect(instructions).toContain("partial logs are not a complete daily intake");
  expect(instructions).toContain("use the known target and ask one useful question about usual intake");
  expect(instructions).toContain("do not demand both answers at once or invent either value");
  expect(instructions).toContain("Do not calculate a new personal target");
});

test("reported four-turn sequence carries education into personal assessment, a new priority and completion", async () => {
  // The feedback quotes the meal-variety and closing wording, but does not
  // provide verbatim micronutrient/protein turns or actual Chef replies.
  // Those inputs are representative; all replies below are synthetic fixtures.
  const turns: Array<{ input: string; output: string; purpose: "answer" | "clarify" }> = [
    {
      input: "What foods have lots of vitamins and minerals?",
      output: "Vegetables, fruit, beans and whole grains provide a variety of micronutrients. " +
        "Are you focused on overall meal quality or concerned about missing particular nutrients?",
      purpose: "clarify",
    },
    {
      input: "I'm trying to make my meals healthier. I think I'm eating the same foods too often.",
      output: "You want healthier meals with more variety. What do your meals typically look like over a day?",
      purpose: "clarify",
    },
    {
      input: "I'm concerned about getting enough protein.",
      output: "Let's focus on protein. Do you already have a protein target you're working toward?",
      purpose: "clarify",
    },
    {
      input: "Thanks, that's all I needed.",
      output: "You're welcome. Take care!",
      purpose: "answer",
    },
  ];
  const evidence = { coachingContextBlock: "Synthetic evidence: allergies=peanuts; restrictions=vegetarian; " +
    "protein target=unknown; current intake=unknown; dietary intake records=not supplied." };
  const before = JSON.stringify(evidence);
  const history: History = [];
  for (const turn of turns) {
    const previousHistory = history.map(value => ({ ...value }));
    const { result, request, wire } = await reply(turn.input, turn.output, {
      history, context: evidence, purpose: turn.purpose,
    });
    ordinary(result, turn.output);
    expect(wire.latestMemberMessage).toBe(turn.input);
    expect(wire.history).toEqual(previousHistory);
    expect(wire.authorizedNutritionContext).toBe(evidence.coachingContextBlock);
    expect(wire.memberStatements.map((value: { text: string }) => value.text))
      .toEqual([...previousHistory.filter(value => value.role === "user").map(value => value.content), turn.input]);
    expect(request.messages[0].content).toContain("FOLLOW-THROUGH — PERSONAL COACHING:");
    expect(request.messages[0].content).toContain("FOLLOW-THROUGH — PROTEIN CONCERNS:");
    expect(request.messages[0].content).toContain("do not require the member to finish the previous assessment");
    expect(turn.output.match(/\?/g) ?? []).toHaveLength(turn.purpose === "clarify" ? 1 : 0);
    history.push({ role: "user", content: turn.input }, { role: "assistant", content: result.presentation!.message });
  }
  expect(history).toHaveLength(8);
  expect(JSON.stringify(evidence)).toBe(before);
  expect(history.at(-1)?.content).toBe("You're welcome.");
});

test("a supplied eating-pattern answer stays available for useful guidance without repeating discovery", async () => {
  const history: History = [
    { role: "user", content: "I'm trying to make my meals healthier. I think I'm eating the same foods too often." },
    { role: "assistant", content: "What do your meals typically look like over a day?" },
  ];
  const latest = "Usually cereal for breakfast, rice for lunch, and pasta for dinner.";
  const message = "We can build on those familiar meals rather than replace everything. " +
    "Beans or lentils could add variety within your vegetarian preference.";
  const { result, wire } = await reply(latest, message, { history });
  ordinary(result, message);
  expect(wire.history).toEqual(history);
  expect(wire.latestMemberMessage).toBe(latest);
  expect(wire.authorizedNutritionContext).toContain("restriction=vegetarian");
});

test.each([
  {
    name: "known target and unknown intake",
    evidence: "Synthetic evidence: saved protein target=120 g; current intake=unknown; intake records=not supplied",
    output: "Your supplied saved target is 120 g of protein. What protein-containing foods do you usually eat in a day?",
  },
  {
    name: "unknown target and unknown intake",
    evidence: "Synthetic evidence: protein target=unknown; current intake=unknown; intake records=not supplied",
    output: "Do you already have a protein target you're working toward?",
  },
])("protein concern preserves the supplied evidence boundary: $name", async ({ evidence, output }) => {
  const { result, wire } = await reply("I'm concerned about getting enough protein.", output, {
    context: { coachingContextBlock: evidence }, purpose: "clarify",
  });
  ordinary(result, output);
  expect(wire.authorizedNutritionContext).toBe(evidence);
  expect(wire.authorizedNutritionContext).not.toContain("current intake=0");
  expect(output.match(/\?/g)).toHaveLength(1);
});

test("known target and member-reported intake can receive guidance without re-asking either value", async () => {
  const latest = "I estimate I'm eating about 100 g of protein a day, mostly from tofu, yogurt and beans.";
  const message = "Your estimate is below your supplied saved target. " +
    "We can focus on the portions of those foods rather than starting a new food list.";
  const { result, wire } = await reply(latest, message, {
    history: [{ role: "user", content: "I'm concerned about getting enough protein." }],
  });
  ordinary(result, message);
  expect(wire.latestMemberMessage).toBe(latest);
  expect(wire.authorizedNutritionContext).toContain("protein=120 g");
  expect(message).not.toContain("checked your records");
});

test("an explicit general protein-food question can still receive a direct list without personal assessment", async () => {
  const message = "Beans, lentils, tofu and dairy foods can provide protein.";
  const { result } = await reply("Which vegetarian foods provide protein?", message, {
    context: { coachingContextBlock: "Synthetic evidence: restriction=vegetarian; target=unknown; intake=unknown" },
  });
  ordinary(result, message);
});
