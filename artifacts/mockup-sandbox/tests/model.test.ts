import { advisorReducer as reduce, createAdvisorState, parseDisplayResponse, type AdvisorState } from "../src/pairing-advisor/model";
import { SYNTHETIC_LIST, syntheticContextEdits, syntheticResponse } from "../src/pairing-advisor/fixtures";
import { isDevelopmentPrototypePath, prototypeDevelopmentAllowed } from "../prototypeIsolation";

function pending(): AdvisorState {
  return reduce(createAdvisorState(), { type: "submit", text: "Show a sample pairing", requestId: "test-request-1" });
}
describe("synthetic conversation state", () => {
  test("opens with a usable empty composer, without submitting or creating profile data", () => {
    const state = createAdvisorState();
    expect(state.active).toBeNull();
    expect(state.messages).toEqual([]);
    expect(state.context.meal).toBeNull();
    expect(state.status).toBe("ready");
  });
  test.each(["meal", "preparation", "sauce", "taste", "budget", "currency", "location"] as const)("explicit %s editing preserves other context", key => {
    let state = reduce(createAdvisorState(), { type: "list", text: SYNTHETIC_LIST });
    state = reduce(state, { type: "edit", key, value: "Explicit synthetic value" });
    expect(state.context[key]).toEqual({ source: "explicit_user", value: "Explicit synthetic value" });
    expect(state.context.wineList?.text).toBe(SYNTHETIC_LIST);
  });
  test("retains meal, preparation, sauce, beverage preference, budget, currency and supplied list across follow-ups", () => {
    let state = reduce(createAdvisorState(), { type: "list", text: SYNTHETIC_LIST });
    const values = { meal: "Synthetic fish dish", preparation: "Grilled", sauce: "User-described sauce", taste: "Dry", budget: "40 per bottle", currency: "USD" } as const;
    for (const [key, value] of Object.entries(values)) state = reduce(state, { type: "edit", key: key as keyof typeof values, value });
    const retained = state.context;
    for (const requestId of ["first", "second"]) {
      state = reduce(state, { type: "submit", text: "Why?", requestId });
      state = reduce(state, { type: "response", submission: state.active!, response: syntheticResponse(state.active!, state.context, "Why?", "education") });
    }
    for (const key of Object.keys(values) as Array<keyof typeof values>) expect(state.context[key]).toEqual(retained[key]);
    expect(state.context.wineList).toEqual(retained.wineList);
    expect(state.messages).toHaveLength(4);
  });
  test("list replacement invalidates references, pending work and active history but retains preferences", () => {
    const old = pending();
    let state = reduce(old, { type: "edit", key: "budget", value: "40 per bottle" });
    state = reduce(state, { type: "list", text: SYNTHETIC_LIST });
    expect(state.context.history).toEqual([]);
    expect(state.context.budget?.value).toBe("40 per bottle");
    expect(state.active).toBeNull();
    expect(state.contextRevision).toBeGreaterThan(old.contextRevision);
    expect(reduce(state, { type: "response", submission: old.active!, response: syntheticResponse(old.active!, old.context, "", "education") })).toBe(state);
  });
  test("remove/re-add cannot reuse an old response even if a list revision repeats", () => {
    let state = reduce(createAdvisorState(), { type: "list", text: SYNTHETIC_LIST });
    state = reduce(state, { type: "submit", text: "Explain", requestId: "old" });
    const old = state;
    state = reduce(state, { type: "list", text: null });
    state = reduce(state, { type: "list", text: SYNTHETIC_LIST });
    expect(reduce(state, { type: "response", submission: old.active!, response: syntheticResponse(old.active!, old.context, "", "education") })).toBe(state);
  });
  test("start over clears conversational context but retains unresolved same-identity disclosures", () => {
    const state = pending();
    state.context.risks = [{ source: "user_disclosure", description: "Synthetic unresolved disclosure" }];
    const reset = reduce(state, { type: "reset", conversationId: "new" });
    expect(reset.context.risks).toEqual(state.context.risks);
    expect(reset.context.meal).toBeNull();
    expect(reset.messages).toEqual([]);
    expect(reset.active).toBeNull();
    expect(reset.conversationId).toBe("new");
  });
  test.each([{ accountId: "synthetic-other", workspaceId: null }, { accountId: "synthetic-account-a", workspaceId: "synthetic-org" }])("identity boundary immediately removes stale data: %j", identity => {
    const old = pending();
    const state = reduce(old, { type: "identity", ...identity, conversationId: "new" });
    expect(state.messages).toEqual([]);
    expect(state.draft).toBe("");
    expect(state.context.risks).toEqual([]);
    expect(reduce(state, { type: "response", submission: old.active!, response: syntheticResponse(old.active!, old.context, "", "education") })).toBe(state);
  });
  test("stop and interruption reject late replies", () => {
    const old = pending();
    for (const action of [{ type: "stop" } as const, { type: "interrupt", submission: old.active! } as const]) {
      const state = reduce(old, action);
      expect(state.lastQuestion).toBe(old.lastQuestion);
      expect(reduce(state, { type: "response", submission: old.active!, response: syntheticResponse(old.active!, old.context, "", "education") })).toBe(state);
    }
  });
  test("double sends and empty sends are ignored", () => {
    expect(reduce(createAdvisorState(), { type: "submit", text: " ", requestId: "no" }).active).toBeNull();
    const state = pending();
    expect(reduce(state, { type: "submit", text: "second", requestId: "second" })).toBe(state);
  });
  test("history stays within existing contract bounds without losing explicit preferences", () => {
    let state = reduce(createAdvisorState(), { type: "edit", key: "taste", value: "Dry" });
    for (let turn = 0; turn < 20; turn++) {
      state = reduce(state, { type: "submit", text: "x".repeat(3000), requestId: `turn-${turn}` });
      state = reduce(state, { type: "response", submission: state.active!, response: syntheticResponse(state.active!, state.context, "", "education") });
    }
    expect(state.context.history.length).toBeLessThanOrEqual(12);
    expect(state.context.history.reduce((total, item) => total + item.content.length, 0)).toBeLessThanOrEqual(12000);
    expect(state.context.taste?.value).toBe("Dry");
  });
  test("oversized list is rejected without changing active evidence", () => {
    const state = reduce(createAdvisorState(), { type: "list", text: SYNTHETIC_LIST });
    const next = reduce(state, { type: "list", text: "x".repeat(12001) });
    expect(next.context).toBe(state.context);
    expect(next.notice).toContain("limit");
  });
  test("bounded demo grammar only records explicit fields and never infers medical safety", () => {
    expect(syntheticContextEdits("I'm having grilled salmon")).toContainEqual({ type: "edit", key: "meal", value: "grilled salmon" });
    expect(syntheticContextEdits("less sweet")).toContainEqual({ type: "edit", key: "taste", value: "Less sweet" });
    expect(syntheticContextEdits("Keep it under USD 40 per bottle")).toHaveLength(2);
    expect(syntheticContextEdits("Under $40")).toEqual([]);
    expect(syntheticContextEdits("Is this safe with my medication?")).toEqual([]);
  });
});

describe("complete synthetic response boundary", () => {
  test.each(["education", "recommendation", "clarification", "restricted", "unavailable"] as const)("renders only complete %s contract payloads", scenario => {
    const state = pending();
    expect(parseDisplayResponse(syntheticResponse(state.active!, state.context, "", scenario))?.outcome).toBe(scenario);
  });
  test("invalid/partial payload cannot produce any assistant message", () => {
    const state = pending();
    const next = reduce(state, { type: "response", submission: state.active!, response: { outcome: "recommendation", narrative: "unreviewed text" } });
    expect(next.messages).toEqual(state.messages);
    expect(next.status).toBe("unavailable");
  });
  test.each(["requestId", "conversationId", "contextRevision"] as const)("mismatched response %s is ignored", field => {
    const state = pending();
    const response = syntheticResponse(state.active!, state.context, "", "education") as Record<string, unknown>;
    response[field] = field === "contextRevision" ? 999 : "wrong";
    expect(reduce(state, { type: "response", submission: state.active!, response })).toBe(state);
  });
  test.each(["bestChoiceId", "alternativeIds", "narrative", "duplicateIds"])("invalid %s references cannot create recommendation cards", kind => {
    const state = pending();
    const response = JSON.parse(JSON.stringify(syntheticResponse(state.active!, state.context, "", "recommendation"))) as any;
    if (kind === "bestChoiceId") response.bestChoiceId = "unknown";
    if (kind === "alternativeIds") response.recommendations[0].alternativeIds = ["unknown"];
    if (kind === "narrative") response.narrative[0].recommendationIds = ["unknown"];
    if (kind === "duplicateIds") response.recommendations[1].id = response.recommendations[0].id;
    expect(parseDisplayResponse(response)).toBeNull();
  });
  test("fixed examples never claim list membership, prices, inventory or clinical suitability", () => {
    const state = pending();
    state.context.wineList = { source: "explicit_user", revision: 1, text: SYNTHETIC_LIST };
    const result = parseDisplayResponse(syntheticResponse(state.active!, state.context, "", "recommendation"))!;
    if (result.outcome !== "recommendation") throw new Error("Wrong fixture");
    expect(result.recommendations.every(item => item.listEntryId === null && !item.claims.length)).toBe(true);
    expect(result.narrative.some(item => item.text.includes("not verified as members"))).toBe(true);
  });
});

describe("private preview access", () => {
  test("only an undeployed Development dev server is allowed", () => {
    expect(prototypeDevelopmentAllowed({ command: "serve", mode: "development" })).toBe(true);
  });
  test.each([
    { command: "build", mode: "development" },
    { command: "build", mode: "production" },
    { command: "serve", mode: "production" },
    { command: "serve", mode: "development", deployment: "0" },
    { command: "serve", mode: "development", deployment: "1" },
    { command: "serve", mode: "development", isPreview: true },
  ])("deny build/production/deployment/preview: %j", input => {
    expect(prototypeDevelopmentAllowed(input)).toBe(false);
  });
  test.each([
    "/__mockup/preview/_development/pairing-advisor/PairingAdvisor",
    "/src/components/mockups/_development/pairing-advisor/PairingAdvisor.tsx",
    "/@fs/path/%5fdevelopment/example",
    "/preview/%255fdevelopment/example",
    "/__mockup/src/pairing-advisor/AdvisorPanel.tsx",
    "/@fs/root/artifacts/mockup-sandbox/src/pairing-advisor/model.ts",
  ])("denies private routes and encoded source-module paths: %s", path => {
    expect(isDevelopmentPrototypePath(path)).toBe(true);
  });
  test("does not block unrelated existing previews", () => {
    expect(isDevelopmentPrototypePath("/preview/chef-kitchens/KitchenLanding")).toBe(false);
  });
});
