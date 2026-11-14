jest.mock("../utils/openaiSafe", () => ({ chatJson: jest.fn(() => { throw new Error("Unexpected live provider"); }) }));
jest.mock("../db", () => ({
  pool: { query: jest.fn(() => { throw new Error("Live database access forbidden"); }) },
  db: {},
}));

import { readFileSync } from "node:fs";
import { generateCulinaryConcepts } from "../services/myPerfectMenu/culinaryConceptEngine";
import { developmentMenuPreferencesSchema, developmentPreviousChoicesAvailability, safeMenuRejectionRules } from "../services/myPerfectMenu/generationReliability";
import { emptyMyPerfectMenuPreferences, myPerfectMenuPreferencesSchema } from "../../shared/myPerfectMenu";
import { menuFailureMessage } from "../../shared/menuFailureMessage";
import { validateHumanFoodResult } from "../services/humanFoodContext/validateHumanFoodResult";
import { validateDietaryRestriction } from "../services/guardrails/validators/dietaryRestrictionValidator";
import type { GeneratedMenuConcept } from "../services/myPerfectMenu/generationContract";
import type { HumanFoodContext } from "../../shared/humanFoodContext";
import type { MyPerfectMenuCategory } from "../../shared/myPerfectMenuCategory";
import { buildGuestEnvelope, scanGeneratedOutput } from "../services/protocolEnvelope";

const dish = (title: string, form: string, ingredients: string[]): GeneratedMenuConcept => ({
  title, description: `A ${form} with ${ingredients.join(", ")}.`,
  primaryIngredients: ingredients, primaryProtein: null, produceItems: [],
  cuisine: "American", dietaryEvidence: [], preparationMethod: "prepared",
  signature: `${form}|${ingredients.join("|")}`,
  culinaryIdentity: {
    dishForm: form, preparationStyle: "prepared", temperature: "chilled",
    primaryProteinBase: null, majorStarchBase: null, flavorFamily: title,
    cuisineEvidence: "American", definingComponents: ingredients,
  },
});
const a = dish("Berry Oat Cookie", "cookie", ["oats", "berries", "olive oil"]);
const b = dish("Berry Chia Pudding", "pudding", ["chia seeds", "berries", "oat milk"]);
const c = dish("Berry Frozen Sorbet", "sorbet", ["berries", "lemon"]);
const blocked = dish("Blocked Milk Cream", "cream", ["milk", "berries"]);
const base = {
  subjectLabel: "synthetic subject", userContext: ["Keep all food protections."],
  requiredCuisine: null, history: [], developmentPartialChoices: true,
  validate: (candidate: GeneratedMenuConcept) =>
    candidate.primaryIngredients.includes("milk") ? ["forbidden_ingredient:milk"] : [],
};
const scenarios: [MyPerfectMenuCategory, "food" | "dessert" | undefined][] = [
  ["breakfast", undefined], ["lunch", undefined], ["dinner", undefined],
  ["snack", "food"], ["snack", "dessert"],
];

describe("Development-only verified partial My Perfect Menu choices", () => {
  const originalMode = process.env.NODE_ENV;
  const originalDeployment = process.env.REPLIT_DEPLOYMENT;
  beforeEach(() => {
    process.env.NODE_ENV = "development";
    delete process.env.REPLIT_DEPLOYMENT;
    jest.spyOn(console, "info").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    process.env.NODE_ENV = originalMode;
    if (originalDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
    else process.env.REPLIT_DEPLOYMENT = originalDeployment;
  });

  it.each(scenarios)("retains two verified %s/%s choices after five bounded attempts", async (occasion, cravingCategory) => {
    const generate = jest.fn(async ({ requestedCount, user, attempt }) => {
      if (attempt === 0) return { concepts: [a, b, blocked] };
      expect(requestedCount).toBe(1);
      expect(user).toContain(a.title);
      expect(user).toContain(b.title);
      expect(user).toContain("forbidden_ingredient:milk");
      expect(user).toContain(blocked.title);
      return { concepts: [blocked] };
    });
    const result = await generateCulinaryConcepts({ ...base, occasion, cravingCategory, generate });
    expect(result.concepts.map(item => item.title)).toEqual([a.title, b.title]);
    expect(result.attemptsCompleted).toBe(5);
    expect(generate).toHaveBeenCalledTimes(5);
  });

  it("returns one verified idea, never padding with duplicates or blocked ideas", async () => {
    const result = await generateCulinaryConcepts({
      ...base, occasion: "breakfast",
      generate: async ({ attempt }) => ({ concepts: attempt === 0 ? [a, a, blocked] : [a, blocked] }),
    });
    expect(result.concepts).toHaveLength(1);
    expect(result.rejectionCodes).toContain("repetition:signature");
    expect(result.rejectionCodes).toContain("forbidden_ingredient:milk");
  });

  it("fills only the missing position and retains both accepted ideas", async () => {
    const generate = jest.fn(async ({ attempt, requestedCount }) => {
      if (attempt === 0) return { concepts: [a, b, blocked] };
      expect(requestedCount).toBe(1);
      return { concepts: [c] };
    });
    const result = await generateCulinaryConcepts({ ...base, occasion: "dinner", generate });
    expect(new Set(result.concepts.map(item => item.title))).toEqual(new Set([a.title, b.title, c.title]));
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("returns distinct Dessert Snack structures sharing ingredients after duplicate-only refills", async () => {
    const cookie = { ...a, foodIdentity: {
      foodRole: "dessert" as const, polarity: "sweet" as const,
      formatFamily: "cookie" as const, preparationStyle: "prepared" as const,
      texture: "chewy" as const,
    } };
    const pudding = { ...b, foodIdentity: {
      ...cookie.foodIdentity, formatFamily: "pudding_custard" as const, texture: "creamy" as const,
    } };
    const result = await generateCulinaryConcepts({
      ...base, occasion: "snack", menuShape: "craving", cravingCategory: "dessert",
      developmentDessertCompletion: true,
      generate: async ({ attempt }) => ({ concepts: attempt === 0 ? [cookie, pudding, blocked] : [cookie] }),
    });
    expect(result.concepts.map(item => item.title)).toEqual([a.title, b.title]);
    expect(result.rejectionCodes).toContain("repetition:batch_dessert_structure");
    expect(result.attemptsCompleted).toBe(5);
  });

  it("never returns any ideas when every candidate fails clinical checks", async () => {
    const generate = jest.fn(async () => ({ concepts: [a, b, c] }));
    await expect(generateCulinaryConcepts({
      ...base, occasion: "lunch", validate: () => ["protocol:physician_restriction"], generate,
    })).rejects.toMatchObject({ code: "CONCEPT_REPAIR_EXHAUSTED" });
    expect(generate).toHaveBeenCalledTimes(3);
  });

  it("does not admit occasion-review failures or lose previously verified ideas", async () => {
    const result = await generateCulinaryConcepts({
      ...base, occasion: "breakfast",
      generate: async ({ attempt }) => ({ concepts: attempt === 0 ? [a, blocked] : [b] }),
      validateBatch: jest.fn()
        .mockResolvedValueOnce([[]])
        .mockRejectedValue(new Error("Synthetic review unavailable")),
    });
    expect(result.concepts.map(item => item.title)).toEqual([a.title]);
    expect(result.providerFailureCount).toBe(4);
  });

  it.each(["production", "test"])("does not activate partial success in %s", async mode => {
    process.env.NODE_ENV = mode;
    await expect(generateCulinaryConcepts({
      ...base, occasion: "dinner", generate: async () => ({ concepts: [a, blocked] }),
    })).rejects.toMatchObject({ code: "CONCEPT_REPAIR_EXHAUSTED" });
  });
  it("does not activate partial success in a deployment or another Creator caller", async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    await expect(generateCulinaryConcepts({
      ...base, occasion: "dinner", generate: async () => ({ concepts: [a, blocked] }),
    })).rejects.toMatchObject({ code: "CONCEPT_REPAIR_EXHAUSTED" });
    delete process.env.REPLIT_DEPLOYMENT;
    await expect(generateCulinaryConcepts({
      ...base, developmentPartialChoices: false, occasion: "dinner",
      generate: async () => ({ concepts: [a, blocked] }),
    })).rejects.toMatchObject({ code: "CONCEPT_REPAIR_EXHAUSTED" });
  });

  it("uses real allergy and dietary checks before retaining a partial set", async () => {
    const context = {
      authorization: { status: "not_required" },
      safety: { allergies: ["milk"], avoidedFoods: [] },
    } as unknown as HumanFoodContext;
    const result = await generateCulinaryConcepts({
      ...base, occasion: "snack",
      validate: candidate => [
        ...validateHumanFoodResult({ ingredients: candidate.primaryIngredients }, context, { requireNutrition: false }).violations,
        ...(validateDietaryRestriction({ name: candidate.title, ingredients: candidate.primaryIngredients.map(name => ({ name })) }, "vegan").isValid ? [] : ["dietary:vegan"]),
      ],
      generate: async () => ({ concepts: [a, blocked] }),
    });
    expect(result.concepts.map(item => item.title)).toEqual([a.title]);
  });

  it.each(scenarios)("preserves the real Anti-Inflammatory final scan for %s/%s partial results", async (occasion, cravingCategory) => {
    const envelope = { ...buildGuestEnvelope(), personalAntiInflammatorySupport: true };
    const unsafe = dish("Canola Oat Cookie", "cookie", ["oats", "canola oil"]);
    const result = await generateCulinaryConcepts({
      ...base, occasion, cravingCategory,
      validate: candidate => scanGeneratedOutput({
        name: candidate.title,
        ingredients: candidate.primaryIngredients.map(name => ({ name })),
        instructions: ["Prepare."],
      }, envelope).passed ? [] : ["protocol:ingredient_guidance"],
      generate: async () => ({ concepts: [a, unsafe] }),
    });
    expect(result.concepts.map(item => item.title)).toEqual([a.title]);
    expect(result.rejectionCodes).toContain("protocol:ingredient_guidance");
    expect(envelope.personalAntiInflammatorySupport).toBe(true);
  });

  it.each([1, 2, 3])("restores %s saved verified choices in Development only", count => {
    const preferences = {
      ...emptyMyPerfectMenuPreferences(),
      categories: { breakfast: [a, b, c].slice(0, count).map((item, i) => ({ ...item, id: `synthetic-${i}`, ideaType: "breakfast" })) },
    };
    expect(developmentMenuPreferencesSchema.parse(preferences).categories.breakfast).toHaveLength(count);
    expect(myPerfectMenuPreferencesSchema.safeParse(preferences).success).toBe(count === 3);
    const invalid = { ...preferences, categories: { breakfast: [{ ...preferences.categories.breakfast[0], primaryIngredients: [] }] } };
    expect(developmentMenuPreferencesSchema.safeParse(invalid).success).toBe(false);
  });

  it.each([
    [0, true, true, "none"], [1, true, true, "compatible"], [2, true, true, "compatible"],
    [3, true, true, "compatible"], [2, false, true, "stale"], [3, true, false, "unavailable"],
  ])("separates saved choice availability for %s/%s/%s", (count, fresh, compatible, expected) => {
    expect(developmentPreviousChoicesAvailability(count as number, fresh as boolean, compatible as boolean)).toBe(expected);
  });

  it("does not call ordinary failure a changed food context", () => {
    expect(menuFailureMessage("Generation exhausted.", "compatible")).not.toContain("no longer current");
    expect(menuFailureMessage("Generation exhausted.", "unavailable")).not.toContain("no longer current");
    expect(menuFailureMessage("Generation exhausted.", "stale")).toContain("no longer current");
  });

  it("logs exact controlled rule names but never food names or clinical details", async () => {
    const privateReason = "glucose_produce_not_allowed:PRIVATE-FOOD-CANARY";
    await expect(generateCulinaryConcepts({
      ...base, occasion: "snack", validate: () => [privateReason, "protocol:PRIVATE-CLINICAL-CANARY"],
      generate: async () => ({ concepts: [a] }),
    })).rejects.toBeDefined();
    const log = JSON.stringify((console.info as jest.Mock).mock.calls);
    expect(log).toContain("glucose_produce_not_allowed");
    expect(log).toContain("protocol");
    expect(log).not.toContain("PRIVATE-");
    expect(log).not.toContain(a.title);
    expect(safeMenuRejectionRules(["unsafe-private-rule:secret"])).toEqual(["unclassified_food_check"]);
  });

  it("wires partial persistence, restoration and the explanatory UI without changing shared Production schema", () => {
    const route = readFileSync("server/routes/myPerfectMenu.ts", "utf8");
    const page = readFileSync("client/src/pages/MyPerfectMenu.tsx", "utf8");
    expect(route.match(/developmentMenuPreferencesSchema : myPerfectMenuPreferencesSchema/g)).toHaveLength(2);
    expect(route.match(/partialChoicesEnabled: true/g)).toHaveLength(2);
    expect(page).toContain("We could verify only {concepts.length} of three ideas");
    expect(page).toContain("No unverified ideas are shown");
    expect(page).toContain('availability === "unavailable"');
  });
});
