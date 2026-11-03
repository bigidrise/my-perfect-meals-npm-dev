// Import traps: even loading a database or real provider is forbidden here.
jest.mock("../db", () => { throw new Error("Review imported application database"); });
jest.mock("pg", () => { throw new Error("Review imported PostgreSQL transport"); });
jest.mock("openai", () => { throw new Error("Review constructed a real provider"); });

import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  createReviewSession, injectedReviewClient, reviewAnswer, MAX_REVIEW_TURNS,
} from "../../scripts/ask-chef-review/session";
import { createReviewContext, REVIEW_FIXTURES } from "../../scripts/ask-chef-review/fixtures";
import { runConciergeConversation } from "../services/coaching/conciergeConversation";

const originalEnvironment = process.env.NODE_ENV;
const originalDeployment = process.env.REPLIT_DEPLOYMENT;
const logs: string[] = [];
let info: jest.SpyInstance;
beforeEach(() => {
  process.env.NODE_ENV = "development";
  delete process.env.REPLIT_DEPLOYMENT;
  logs.length = 0;
  info = jest.spyOn(console, "info").mockImplementation((...values) => logs.push(values.join(" ")));
});
afterEach(() => {
  info.mockRestore();
  process.env.NODE_ENV = originalEnvironment;
  if (originalDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
  else process.env.REPLIT_DEPLOYMENT = originalDeployment;
});

function provider(replies: Array<Record<string, unknown>>) {
  let next = 0;
  const create = jest.fn(async (_request: any) => {
    const reply = replies[next++];
    if (!reply) throw new Error("Unexpected extra completion");
    return { choices: [{ message: { content: JSON.stringify(reply) } }] };
  });
  return { create, client: { chat: { completions: { create } } } as any };
}
const wire = (p: ReturnType<typeof provider>, index = 0) =>
  JSON.parse(p.create.mock.calls[index][0].messages[1].content);

test("fresh and continuing turns reuse the runner with exactly the selected displayed history", async () => {
  const p = provider([reviewAnswer("A practical next step can build on your existing meals."),
    reviewAnswer("Unknown intake does not mean you need to stop discussing useful changes.")]);
  const session = createReviewSession({ fixture: "vegan-soy-missing", client: p.client });
  expect(session.transcript()).toEqual([]);
  const first = await session.send("PRIVATE_MEMBER_SENTINEL: I'm trying to get more protein.");
  expect(wire(p)).toMatchObject({ history: [], earlierConversation: null, pendingRecommendation: null });
  await session.send("I don't know how much protein I'm getting.");
  expect(wire(p, 1).history).toEqual([
    { role: "user", content: "PRIVATE_MEMBER_SENTINEL: I'm trying to get more protein." },
    { role: "assistant", content: first.presentation!.message },
  ]);
  expect(wire(p, 1).earlierConversation).toBeNull();
  expect(wire(p, 1).pendingRecommendation).toBeNull();
  expect(session.transcript()).toHaveLength(4);
  expect(p.create).toHaveBeenCalledTimes(2);
  expect(logs).toContain('[ChefConcierge] freshness {"historyCount":0,"summaryPresent":false,"pendingNavigationPresent":false}');
  expect(logs).toContain('[ChefConcierge] freshness {"historyCount":2,"summaryPresent":false,"pendingNavigationPresent":false}');
  expect(logs.join("\n")).not.toMatch(/PRIVATE_MEMBER_SENTINEL|Review Member|Lentil curry/);
});

test("sessions cannot inherit one another's history or externally mutated transcripts", async () => {
  const a = provider([reviewAnswer("Session A response."), reviewAnswer("Session A next response.")]);
  const b = provider([reviewAnswer("Session B response.")]);
  const first = createReviewSession({ fixture: "vegan-soy-missing", client: a.client });
  const second = createReviewSession({ fixture: "vegetarian-logged", client: b.client });
  await first.send("Session A member statement.");
  const exposed = first.transcript();
  exposed[0].content = "MUTATED_SENTINEL";
  exposed.push({ role: "user", content: "INJECTED_SENTINEL" });
  await second.send("Session B member statement.");
  await first.send("Continue session A.");
  expect(wire(b).history).toEqual([]);
  expect(JSON.stringify(wire(b))).not.toContain("Session A");
  expect(JSON.stringify(wire(a, 1))).not.toMatch(/Session B|MUTATED_SENTINEL|INJECTED_SENTINEL/);
  const contextA = JSON.parse(wire(a).authorizedNutritionContext.split("\n")[1]);
  const contextB = JSON.parse(wire(b).authorizedNutritionContext.split("\n")[1]);
  expect(contextA.memberEvidence.profile.restrictions.value).toEqual(["vegan"]);
  expect(contextB.memberEvidence.profile.restrictions.value).toEqual(["vegetarian"]);
});

test.each(REVIEW_FIXTURES)("synthetic fixture %s reaches the actual foreground request", async fixture => {
  const p = provider([reviewAnswer("These observations are explicitly synthetic review data.")]);
  await createReviewSession({ fixture, client: p.client }).send("Help with my nutrition goal.");
  const context = JSON.parse(wire(p).authorizedNutritionContext.split("\n")[1]);
  expect(context.memberEvidence.savedTargets.targets.protein.value).toBe(120);
  expect(context.memberEvidence.profile.cuisinePreference.value).toBe("indian");
  expect(context.memberEvidence.profile.avoidedFoods.value).toEqual(["sesame"]);
  expect(context.memberEvidence.profile.foodsIEnjoy.value).toEqual(["Lentil curry"]);
  expect(context.today.macros.protein).toMatchObject(fixture === "vegetarian-logged"
    ? { status: "observed", value: 30 } : { status: "missing", value: null });
  if (fixture === "unknown-allergies") {
    expect(context.memberEvidence.profile.allergies).toMatchObject({ status: "unknown", value: null });
  } else {
    expect(context.memberEvidence.profile.allergies.value).toEqual([fixture === "vegetarian-logged" ? "peanuts" : "soy"]);
  }
  expect(p.create).toHaveBeenCalledTimes(1);
});

test("food screening still blocks a declared incompatible proposal, including in subsequent history", async () => {
  const reply = reviewAnswer("Try tofu in your next meal.");
  reply.foodDeclarations.message = {
    mode: "recommendations", foods: [{ name: "Tofu", ingredients: ["soybeans"], ingredientCoverage: "listed" }],
  } as any;
  const p = provider([reply, reviewAnswer("We can discuss a different approach.")]);
  const session = createReviewSession({ fixture: "vegan-soy-missing", client: p.client });
  const response = await session.send("Can you suggest a protein option?");
  expect(response.foodCompatibility?.status).toBe("blocked");
  expect(response.presentation?.message).not.toBe(reply.message);
  await session.send("What next?");
  expect(wire(p, 1).history[1].content).toBe(response.presentation!.message);
  expect(wire(p, 1).history[1].content).not.toContain("Try tofu");
});

test("only a session's validated pending recommendation carries into its next turn", async () => {
  const goal = { activity: "prepare", occasion: "beverage", restaurant: "unknown",
    dishChosen: false, specialty: "none", explicitFeatureId: null };
  const offer = { ...reviewAnswer("Beverage Creator can help prepare a drink. Would you like to open Beverage Creator?"),
    memberNeed: "feature_help", responsePurpose: "feature_only_offer", navigationIntent: "recommendation",
    conciergeDecision: { mode: "food_assistance", destinationId: "beverage_creator", goal } };
  const p = provider([offer, reviewAnswer("We can stay here and discuss your question.")]);
  const session = createReviewSession({ fixture: "vegan-soy-missing", client: p.client });
  const offered = await session.send("I want to prepare a drink.");
  expect(offered.presentation?.navigation?.state).toBe("recommendation_pending");
  // Mutating the caller's response must not alter retained pending state.
  offered.presentation!.navigation!.destinationId = "create_a_dish";
  await session.send("Not yet. Explain the options first.");
  expect(wire(p, 1).pendingRecommendation.destinationId).toBe("beverage_creator");
  const other = provider([reviewAnswer("A different session starts independently.")]);
  await createReviewSession({ fixture: "unknown-allergies", client: other.client }).send("Hello Chef.");
  expect(wire(other).pendingRecommendation).toBeNull();
  expect(logs.some(line => line.startsWith("[ChefConcierge] freshness") &&
    line.includes('"pendingNavigationPresent":true'))).toBe(true);
});

test("existing emergency gate responds without calling the provider", async () => {
  const p = provider([]);
  const result = await createReviewSession({ fixture: "unknown-allergies", client: p.client })
    .send("I have severe chest pain and trouble breathing.");
  expect(result.meta.redFlag).toBe(true);
  expect(p.create).not.toHaveBeenCalled();
});

test("the same session rejects overlapping turns and has a bounded lifetime", async () => {
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const client = injectedReviewClient([reviewAnswer("First selected response.")]);
  const create = client.chat.completions.create.bind(client.chat.completions);
  client.chat.completions.create = (async (...args: any[]) => { await wait; return (create as any)(...args); }) as any;
  const session = createReviewSession({ fixture: "unknown-allergies", client });
  const first = session.send("First ordinary question.");
  await expect(session.send("Overlapping question.")).rejects.toThrow("already in progress");
  release(); await first;
  const bounded = createReviewSession({ fixture: "unknown-allergies",
    client: injectedReviewClient(Array.from({ length: MAX_REVIEW_TURNS }, () => reviewAnswer("A bounded review response."))) });
  for (let i = 0; i < MAX_REVIEW_TURNS; i++) await bounded.send(`Ordinary question ${i}.`);
  await expect(bounded.send("One more.")).rejects.toThrow("turn limit");
});

test.each(["production", "test"])("session creation refuses %s without invoking any provider", environment => {
  process.env.NODE_ENV = environment;
  expect(() => createReviewSession({ fixture: "unknown-allergies", client: injectedReviewClient([]) }))
    .toThrow("unpublished Development");
});
test("published processes and changed runtime authority refuse review turns", async () => {
  const session = createReviewSession({ fixture: "unknown-allergies", client: injectedReviewClient([]) });
  process.env.REPLIT_DEPLOYMENT = "1";
  expect(() => createReviewContext("bad-fixture" as any)).toThrow("Unknown synthetic");
  await expect(session.send("A question.")).rejects.toThrow("unpublished Development");
  expect(() => createReviewSession({ fixture: "unknown-allergies", client: injectedReviewClient([]) }))
    .toThrow("unpublished Development");
});

test("freshness diagnostics measure presence without logging content and remain absent in Production", async () => {
  const p = provider([reviewAnswer("A useful ordinary response."), reviewAnswer("A production fixture response.")]);
  const params = { client: p.client, userMessage: "Ordinary question.",
    history: [{ role: "user", content: "PRIVATE_HISTORY" }], rollingContext: "PRIVATE_SUMMARY",
    context: {}, tools: [] };
  await runConciergeConversation(params);
  expect(logs).toContain('[ChefConcierge] freshness {"historyCount":1,"summaryPresent":true,"pendingNavigationPresent":false}');
  expect(logs.join("\n")).not.toMatch(/PRIVATE_HISTORY|PRIVATE_SUMMARY/);
  logs.length = 0;
  process.env.NODE_ENV = "production";
  await runConciergeConversation(params);
  expect(logs.join("\n")).not.toContain("[ChefConcierge] freshness");
});

const root = path.resolve(__dirname, "../..");
function cli(args: string[], environment = "development") {
  return spawnSync(process.execPath, ["--import", "tsx", "scripts/ask-chef-review.ts", ...args], {
    cwd: root, encoding: "utf8", timeout: 20000,
    env: { ...process.env, NODE_ENV: environment, REPLIT_DEPLOYMENT: "" },
  });
}
test("real offline CLI completes two turns with fetch and TCP blocked; fresh invocations start empty", () => {
  for (let run = 0; run < 2; run++) {
    const result = cli([]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"reviewMode":"offline-injected"');
    expect(result.stdout).toContain('"historyCount":0,"summaryPresent":false,"pendingNavigationPresent":false');
    expect(result.stdout).toContain('"historyCount":2,"summaryPresent":false,"pendingNavigationPresent":false');
    expect(result.stdout).toContain('"transcriptMessages":4');
    expect(result.stdout).not.toMatch(/\[DB\]|live-paid-opt-in/);
  }
}, 45000);
test.each(["--live", "--allow-paid-model-calls", "--typo"])("CLI rejects unsafe/incomplete argument %s", flag => {
  const result = cli([flag]);
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(flag === "--typo" ? "Unknown review argument" : "Paid calls require BOTH");
});
test("CLI refuses Production before importing the conversation runner", () => {
  const result = cli([], "production");
  expect(result.status).not.toBe(0);
  expect(result.stdout).not.toContain("runtime_revision");
});

test("both paid flags exercise the existing SDK with a fake HTTP transport, never a network request", () => {
  const rawReply = JSON.stringify(reviewAnswer("An injected transport response, not a live model response."));
  const program = `
    import net from "node:net";
    net.Socket.prototype.connect = () => { throw new Error("Unexpected TCP connection"); };
    let calls = 0;
    globalThis.fetch = async (_url, options) => {
      const request = JSON.parse(options.body);
      if (request.model !== "gpt-4o") throw new Error("Model unexpectedly changed");
      calls++;
      return new Response(JSON.stringify({
        id:"synthetic-review", object:"chat.completion", created:0, model:"gpt-4o",
        choices:[{index:0, finish_reason:"stop", message:{role:"assistant",content:${JSON.stringify(rawReply)}}}]
      }), {status:200, headers:{"content-type":"application/json"}});
    };
    process.argv = ["node", "scripts/ask-chef-review.ts", "--live", "--allow-paid-model-calls", "--turn", "An ordinary review question."];
    await import("./scripts/ask-chef-review.ts");
    if (calls !== 1) throw new Error("Expected exactly one fake completion");
    console.log("FAKE_TRANSPORT_CALLS=" + calls);
  `;
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", program], {
    cwd: root, encoding: "utf8", timeout: 20000,
    env: { ...process.env, NODE_ENV: "development", REPLIT_DEPLOYMENT: "", OPENAI_API_KEY: "synthetic-no-network" },
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Fake transport subprocess failed");
  expect(result.stdout).toContain("FAKE_TRANSPORT_CALLS=1");
  expect(result.stdout).toContain('"reviewMode":"live-paid-opt-in"');
}, 25000);
