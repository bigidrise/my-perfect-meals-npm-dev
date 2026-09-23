import type { HumanFoodContext } from "../../shared/humanFoodContext";
import type { OneTouchRequest } from "../../shared/oneTouch";
import type { UserProtocolEnvelope } from "../services/protocolEnvelope";
import type { GLP1GlobalContext } from "../services/glp1/resolveGLP1GlobalContext";
import { oneTouchContextFingerprint } from "../services/oneTouch/contextFingerprint";

const request: OneTouchRequest = {
  creator: "create_a_dish",
  servings: 2,
  cuisine: { mode: "profile" },
  eatingStyle: { mode: "explicit", value: "vegan" },
};
const context = {
  version: "human-food-context.v1",
  status: "resolved",
  subjectUserId: "person-1",
  resolvedAt: "2026-01-01T00:00:00Z",
  correlationId: "request-a",
  diet: { effective: ["vegan"], requestOverride: "vegan" },
  flavor: { cuisine: { value: "Japanese" } },
  safety: { allergies: ["peanuts"], avoidedFoods: ["mushrooms"], dislikedFoods: [] },
  authorization: { status: "none", action: null, reservationId: null, waivers: [] },
  nutrition: { date: "2026-01-01", resolvedAt: "2026-01-01T00:00:00Z", prescription: { calories: 1900 } },
  behavior: null,
  foodsIEnjoy: { explicit: [], legacyLikes: [] },
  nutritionPriorities: { selectedPriorityIds: ["fiber_rich_foods"], registryVersion: "nutrition-priorities.v1" },
  sweeteners: { preferred: [], avoided: [] },
  diabetesFoodPreferences: { state: "IN_RANGE", ageMinutes: 4 },
  gaps: [],
  blockedReasons: [],
  notices: ["Current notice"],
} as unknown as HumanFoodContext;
const envelope = {
  userId: "person-1",
  dietaryIdentity: ["vegan"],
  allergies: ["peanuts"],
  avoidances: ["mushrooms"],
  medicalHardLimits: [],
  glp1DailyTolerance: { shouldEscalate: false },
  preferredLanguage: "en",
} as unknown as UserProtocolEnvelope;
const glp1 = {
  isActive: false,
  activationSources: [],
  performanceActive: false,
  resolvedTargets: null,
  dailyNutritionState: null,
  compositionNote: "",
} as GLP1GlobalContext;

describe("One-Touch restored-card authority fingerprint", () => {
  const oldSecret = process.env.SESSION_SECRET;
  beforeAll(() => { process.env.SESSION_SECRET = "one-touch-test-only-secret"; });
  afterAll(() => {
    if (oldSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = oldSecret;
  });
  const stamp = (
    ctx = context, protocol = envelope, global = glp1, choices = request,
  ) => oneTouchContextFingerprint(choices, ctx, protocol, global);

  it("is opaque and stable across remounts, timestamps, and unrelated UI preferences", () => {
    const original = stamp();
    expect(original).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(original).not.toContain("peanuts");
    expect(stamp({
      ...context,
      resolvedAt: "2026-01-02T01:00:00Z",
      correlationId: "request-b",
      notices: ["Different notice"],
      nutrition: { ...context.nutrition!, resolvedAt: "2026-01-02T01:00:00Z" },
      diabetesFoodPreferences: { ...context.diabetesFoodPreferences!, ageMinutes: 9 },
    } as HumanFoodContext, { ...envelope, preferredLanguage: "fr" })).toBe(original);
    expect(stamp({ ...context, safety: {
      ...context.safety, allergies: ["peanuts", "sesame"],
    } }, { ...envelope, allergies: ["sesame", "peanuts"] })).toBe(
      stamp({ ...context, safety: {
        ...context.safety, allergies: ["sesame", "peanuts"],
      } }, { ...envelope, allergies: ["peanuts", "sesame"] }),
    );
  });

  it.each([
    ["allergy", { safety: { ...context.safety, allergies: ["shellfish"] } }, envelope, glp1],
    ["avoidance", { safety: { ...context.safety, avoidedFoods: ["sesame"] } }, envelope, glp1],
    ["effective diet", { diet: { ...context.diet, effective: ["vegetarian"] } }, envelope, glp1],
    ["dietary identity", {}, { ...envelope, dietaryIdentity: ["vegetarian"] }, glp1],
    ["clinical protocol", {}, { ...envelope, medicalHardLimits: ["renal"] }, glp1],
    ["diabetes", { diabetesFoodPreferences: { ...context.diabetesFoodPreferences!, state: "HIGH" } }, envelope, glp1],
    ["GLP-1", {}, envelope, { ...glp1, isActive: true, resolvedTargets: { treatmentPhase: "titration" } }],
    ["Nutrition Priorities", { nutritionPriorities: { ...context.nutritionPriorities!, selectedPriorityIds: [] } }, envelope, glp1],
    ["daily nutrition", { nutrition: { ...context.nutrition!, prescription: { calories: 1700 } } }, envelope, glp1],
  ])("invalidates on changed %s authority", (_label, change, protocol, global) => {
    expect(stamp({ ...context, ...change } as HumanFoodContext,
      protocol as UserProtocolEnvelope, global as GLP1GlobalContext)).not.toBe(stamp());
  });

  it("binds actor, creator, and temporary choices without changing the profile", () => {
    expect(stamp({ ...context, subjectUserId: "person-2" })).not.toBe(stamp());
    expect(stamp(context, envelope, glp1, { ...request, creator: "craving_creator" })).not.toBe(stamp());
    expect(stamp(context, envelope, glp1, { ...request, cuisine: { mode: "surprise" } })).not.toBe(stamp());
    expect(stamp(context, envelope, glp1, { ...request, eatingStyle: { mode: "profile" } })).not.toBe(stamp());
  });
});