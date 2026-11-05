// Only synthetic evidence and an injected provider; any DB/clinical access fails.
jest.mock("../db", () => ({
  db: { execute: jest.fn(() => { throw new Error("Unexpected database access"); }) },
  pool: { query: jest.fn(() => { throw new Error("Unexpected pool access"); }) },
}));
jest.mock("../services/prescriptionResolver", () => ({
  resolveDailyNutritionPrescription: jest.fn(() => { throw new Error("Unexpected prescription resolution"); }),
}));
jest.mock("../services/humanFoodContext/resolveHumanFoodContext", () => ({
  resolveHumanFoodContext: jest.fn(() => { throw new Error("Unexpected food context resolution"); }),
}));
jest.mock("../services/protocolEnvelope", () => ({
  loadUserProtocolEnvelope: jest.fn(() => { throw new Error("Unexpected clinical envelope resolution"); }),
}));
jest.mock("openai", () => ({
  __esModule: true, default: jest.fn(() => { throw new Error("Unexpected provider construction"); }),
}));
import { db, pool } from "../db";
import { resolveDailyNutritionPrescription } from "../services/prescriptionResolver";
import { resolveHumanFoodContext } from "../services/humanFoodContext/resolveHumanFoodContext";
import { loadUserProtocolEnvelope } from "../services/protocolEnvelope";
import {
  inspectChefFoodDeclarations, projectChefFoodEducation,
} from "../services/coaching/foodCompatibility";
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { FOOD_INCLUSION_PRIORITY_REGISTRY, NUTRITION_PRIORITIES_REGISTRY_VERSION } from "../../shared/nutritionPriorities";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";
import { verifiedNavigationText } from "../../shared/coaching/navigationGuidance";

const originalEnvironment = process.env.NODE_ENV;
const fact = (value: string[], status = value.length ? "known" : "none") =>
  ({ value, status, source: "synthetic_saved_field" });
const context = () => ({
  chefFoodCompatibility: { subjectUserId: "synthetic-self" },
  coachingContextBlock: "Synthetic self evidence only. No clinical context.",
  coachingContextSnapshot: {
    subject: { userId: "synthetic-self" },
    memberEvidence: { profile: {
      allergies: fact(["milk"]), restrictions: fact(["vegan"]),
      avoidedFoods: fact(["sesame"]), dislikedFoods: fact(["olives"]),
    } },
  },
});
const declared = (name: string, ingredients: string[] | null = [name], ingredientCoverage = "listed") => ({
  message: { mode: "recommendations", foods: [{ name, ingredients, ingredientCoverage }] },
  conversationMessage: null, handoffMessage: null,
});
const discussion = (mode = "discussion") => ({
  message: { mode, foods: [] }, conversationMessage: null, handoffMessage: null,
});
const inspect = (declaration: unknown, ctx: any = context(), field = "message") =>
  inspectChefFoodDeclarations(declaration, field, ctx);

beforeEach(() => { process.env.NODE_ENV = "development"; jest.clearAllMocks(); });
afterEach(() => {
  expect(db.execute).not.toHaveBeenCalled();
  expect(pool.query).not.toHaveBeenCalled();
  expect(resolveDailyNutritionPrescription).not.toHaveBeenCalled();
  expect(resolveHumanFoodContext).not.toHaveBeenCalled();
  expect(loadUserProtocolEnvelope).not.toHaveBeenCalled();
});
afterAll(() => { process.env.NODE_ENV = originalEnvironment; });

test.each(["casein", "whey", "cheese"])("known dairy derivative is blocked: %s", ingredient => {
  expect(inspect(declared("Food option", [ingredient]))).toMatchObject({
    status: "blocked", reasons: expect.arrayContaining([expect.stringMatching(/^allergy:/)]),
  });
});
test("plant milk does not become a dairy conflict, but almond allergy still applies", () => {
  const ctx = context();
  expect(inspect(declared("Almond milk", ["almond milk"]), ctx).status).toBe("screened");
  ctx.coachingContextSnapshot.memberEvidence.profile.allergies = fact(["tree nuts"]);
  expect(inspect(declared("Almond milk", ["almond milk"]), ctx).status).toBe("blocked");
});
test.each([
  ["vegan", "chicken"], ["vegan", "gelatin"], ["vegetarian", "beef"],
  ["pescatarian", "chicken"], ["halal", "pork"], ["kosher", "shrimp"],
])("%s food identity uses existing direct/hidden checks: %s", (diet, ingredient) => {
  const ctx = context();
  ctx.coachingContextSnapshot.memberEvidence.profile.restrictions = fact([diet]);
  expect(inspect(declared("Option", [ingredient]), ctx)).toMatchObject({
    status: "blocked", reasons: expect.arrayContaining([expect.stringMatching(/^dietary:/)]),
  });
});
test("explicit avoidance and ordinary dislike remain distinct from allergies", () => {
  const avoided = inspect(declared("Sesame rice", ["rice", "sesame"]));
  const disliked = inspect(declared("Olive rice", ["rice", "olives"]));
  expect(avoided.reasons).toContain("avoidance:sesame");
  expect(disliked.reasons).toContain("dislike:olives");
  expect(disliked.reasons.some(reason => reason.startsWith("allergy:"))).toBe(false);
});
test.each(["none", "discussion"])("no food screening for %s, including warnings about forbidden food", mode => {
  expect(inspect(discussion(mode))).toEqual({ status: "not_applicable", reasons: [], uncertainties: [] });
});
test("incomplete ingredients are unresolved, and a known conflict in the name still blocks", () => {
  expect(inspect(declared("Restaurant soup", null, "unknown"))).toMatchObject({
    status: "screened", uncertainties: expect.arrayContaining(["ingredients_incomplete", "cross_contact_unverified"]),
  });
  expect(inspect(declared("Chicken soup", null, "unknown")).status).toBe("blocked");
});
test("unknown allergy data never becomes confirmed absence or clearance", () => {
  const ctx = context();
  ctx.coachingContextSnapshot.memberEvidence.profile.allergies = { value: null, status: "unknown", source: "users.allergies" } as any;
  expect(inspect(declared("Lentils"), ctx)).toMatchObject({
    status: "screened", uncertainties: expect.arrayContaining(["allergies_unknown", "clinical_suitability_not_assessed"]),
  });
});
test.each([null, {}, { message: { mode: "recommendations", foods: [] }, conversationMessage: null, handoffMessage: null },
  { message: { mode: "discussion", foods: [{ name: "Chicken", ingredients: ["chicken"], ingredientCoverage: "listed" }] },
    conversationMessage: null, handoffMessage: null }])("unreliable declarations fail closed: %j", value => {
  expect(inspect(value).status).toBe("unavailable");
});
test("a different member or absent member evidence cannot authorize screening", () => {
  const ctx = context();
  ctx.coachingContextSnapshot.subject.userId = "synthetic-other";
  expect(inspect(declared("Lentils"), ctx)).toMatchObject({
    status: "unavailable", reasons: ["member_evidence_subject_unavailable"],
  });
  expect(inspect(declared("Lentils"), { chefFoodCompatibility: { subjectUserId: "synthetic-self" } }).status).toBe("unavailable");
});
test("a rejected field's proposals do not contaminate the independent discussion", () => {
  const declaration = { ...declared("Chicken"), conversationMessage: discussion().message };
  expect(inspect(declaration, context(), "message").status).toBe("blocked");
  expect(inspect(declaration, context(), "conversationMessage").status).toBe("not_applicable");
});
test("education retains registry version, review/evidence metadata, citations and clinical boundary", () => {
  const education = projectChefFoodEducation("What are Fiber-Rich Foods?");
  expect(education).toMatchObject({
    registryVersion: NUTRITION_PRIORITIES_REGISTRY_VERSION, explanationOnly: true,
    source: "shared/nutritionPriorityEducation.ts",
    entries: [expect.objectContaining({
      id: "fiber_rich_foods", lastReviewedOn: "2026-09-21",
      evidenceStatus: "established_food_guidance", citations: expect.any(Array),
    })],
  });
  expect(education!.medicalBoundary).toContain("do not create a medical protocol");
  expect(projectChefFoodEducation("Hello")).toBeNull();
});
test("inactive guidance is not exposed, including through the existing answer interpreter", () => {
  const definition = FOOD_INCLUSION_PRIORITY_REGISTRY.fiber_rich_foods;
  const before = definition.status;
  try {
    definition.status = "inactive";
    const education = projectChefFoodEducation("What are Fiber-Rich Foods?");
    expect(education?.entries ?? []).toEqual([]);
    expect(JSON.stringify(education)).not.toContain("Beans, lentils");
  } finally { definition.status = before; }
});

async function run(message: string, declaration: unknown, options: {
  ctx?: any; turn?: Record<string, unknown>; input?: string; tools?: any[];
} = {}) {
  const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    message, memberNeed: "nutrition_guidance", responsePurpose: "answer", navigationIntent: "none",
    conciergeDecision: null, redFlag: false, careDisposition: "none",
    foodDeclarations: declaration, ...options.turn,
  }) } }] });
  const result = await runConciergeConversation({
    client: { chat: { completions: { create } } } as any,
    userMessage: options.input ?? "What foods could I consider?", history: [],
    rollingContext: null, context: options.ctx ?? context(), tools: options.tools ?? [],
  });
  expect(create).toHaveBeenCalledTimes(1);
  return { result, request: create.mock.calls[0][0] };
}
test("one foreground strict response declares suggestions; known conflicts replace all display fields", async () => {
  const { result, request } = await run("Try chicken and cheese.", declared("Chicken", ["chicken", "cheese"]));
  expect(request.response_format.json_schema.schema.properties.foodDeclarations).toBeDefined();
  expect(request.response_format.json_schema.schema.required).toContain("foodDeclarations");
  expect(result.foodCompatibility?.status).toBe("blocked");
  expect(result.presentation?.message).not.toContain("Try chicken and cheese.");
  expect(result.presentation?.message).toContain("allergy restriction");
  expect(result.presentation?.message).toContain("dietary requirement");
  expect(result.whatIFound).toBe(result.presentation?.message);
  expect(result.todayPlan.items).toEqual([]);
  expect(result.presentation?.navigation).toBeUndefined();
});
test("missing declaration is not silently accepted on actual self-adapter turns", async () => {
  const { result } = await run("Try chicken.", undefined);
  expect(result.foodCompatibility?.status).toBe("unavailable");
  expect(result.presentation?.message).not.toContain("Try chicken");
});
test("discussion of a forbidden food stays natural and is not scanned as a proposal", async () => {
  const message = "Casein is a milk protein. Avoid it when it conflicts with your milk allergy.";
  const { result } = await run(message, discussion());
  expect(result.presentation?.message).toBe(message);
  expect(result.foodCompatibility).toBeUndefined();
});
test("a declared ingredient list is screened, not certified safe, and the input is unchanged", async () => {
  const ctx = context();
  const before = JSON.stringify(ctx);
  const { result } = await run("Lentils are one option to consider.", declared("Lentils"), { ctx });
  expect(result.foodCompatibility?.status).toBe("screened");
  expect(result.presentation?.message).toContain("cross-contact");
  expect(result.presentation?.message).toContain("medical suitability");
  expect(JSON.stringify(ctx)).toBe(before);
});
test("unknown allergies and incomplete ingredients remain visible uncertainty", async () => {
  const ctx = context();
  ctx.coachingContextSnapshot.memberEvidence.profile.allergies = { value: null, status: "unknown" } as any;
  const { result } = await run("Soup could be an option.", declared("Soup", null, "unknown"), { ctx });
  expect(result.presentation?.message).toContain("allergy information is unconfirmed");
  expect(result.presentation?.message).toContain("Full ingredients aren't confirmed");
});
test("greetings and authoritative closings do not acquire food notices", async () => {
  expect((await run("Hello!", discussion("none"), { input: "Hello" })).result.presentation?.message).toBe("Hello!");
  const { result } = await run("Try chicken.", declared("Chicken"), { input: "Thanks, that's all I needed." });
  expect(result.presentation?.message).toBe("You're welcome. Take care!");
  expect(result.foodCompatibility).toBeUndefined();
});
test("urgent care retains authority above food and navigation", async () => {
  const { result } = await run("Seek urgent medical help.", undefined, {
    turn: { redFlag: true, careDisposition: "emergency", contactCare: "Seek urgent medical help." },
  });
  expect(result.meta.redFlag).toBe(true);
  expect(result.todayPlan.items.some(item => item.kind === "contact_care")).toBe(true);
});
test("applicable education reaches the same request without another model or context resolver", async () => {
  const { request } = await run("Fiber is found in plant foods.", discussion(), { input: "What are Fiber-Rich Foods?" });
  const payload = JSON.parse(request.messages[1].content);
  expect(payload.nutritionPriorityEducation.registryVersion).toBe(NUTRITION_PRIORITIES_REGISTRY_VERSION);
  expect(payload.nutritionPriorityEducation.entries[0].citations.length).toBeGreaterThan(0);
});
test("validated navigation still works through the active declaration gate without food notices", async () => {
  const handoff = "Open My Perfect Menu and choose a meal occasion.";
  const { result } = await run(handoff, {
    message: discussion("none").message, conversationMessage: null, handoffMessage: discussion("none").message,
  }, {
    input: "Please open My Perfect Menu.",
    tools: getCornerCapabilities(["all"], "development").map(cap => ({ ...cap, scope: "adult", featureTarget: cap.id })),
    turn: {
      memberNeed: "navigation", responsePurpose: "handoff", navigationIntent: "direct_request",
      handoffMessage: handoff,
      conciergeDecision: { mode: "food_assistance", destinationId: "my_perfect_menu", goal: {
        activity: "plan_meals", occasion: "unknown", restaurant: "unknown",
        dishChosen: false, specialty: "none", explicitFeatureId: "my_perfect_menu",
      } },
    },
  });
  expect(result.presentation?.destinationId).toBe("my_perfect_menu");
  expect(result.presentation?.message).toBe(verifiedNavigationText("my_perfect_menu"));
  expect(result.foodCompatibility).toBeUndefined();
});
test("Production requires the same food declaration evidence and fails closed when it is missing", async () => {
  process.env.NODE_ENV = "production";
  const { result, request } = await run("Existing released reply.", undefined);
  expect(request.response_format.json_schema.schema.properties.foodDeclarations).toBeDefined();
  expect(request.messages[0].content).toContain("FOOD DECLARATIONS:");
  expect(result.presentation?.message).not.toBe("Existing released reply.");
  expect(result.foodCompatibility).toMatchObject({ status: "unavailable", reasons: ["food_declaration_invalid"] });
  expect(result.todayPlan.items).toEqual([]);
});
