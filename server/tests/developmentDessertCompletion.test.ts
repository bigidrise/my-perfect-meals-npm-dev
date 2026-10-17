import { generateCulinaryConcepts } from "../services/myPerfectMenu/culinaryConceptEngine";
import { areDessertDuplicates, compareDessertStructures } from "../services/myPerfectMenu/developmentDessertCompletion";
import { buildCulinaryFingerprint } from "@shared/culinaryIdentity";
import { readFileSync } from "node:fs";
import type { DessertDiagnostic } from "../services/myPerfectMenu/dessertDiagnostics";
import type { GeneratedMenuConcept } from "../services/myPerfectMenu/generationContract";

function dessert(title: string, format: "cheesecake" | "cookie" | "frozen_dessert"): GeneratedMenuConcept {
  const frozen = format === "frozen_dessert";
  return {
    title, description: `${title} with a recognizable ${format} preparation.`,
    primaryIngredients: ["strawberries", "plain nonfat Greek yogurt", "unsalted almonds"],
    primaryProtein: "Greek yogurt", produceItems: ["strawberries"], cuisine: "American",
    dietaryEvidence: [], preparationMethod: frozen ? "frozen" : "chilled",
    signature: "berry yogurt almond dessert",
    culinaryIdentity: {
      dishForm: format, preparationStyle: frozen ? "frozen" : "chilled",
      temperature: frozen ? "frozen" : "chilled", texture: frozen ? "smooth" : "creamy",
      primaryProteinBase: "Greek yogurt", majorStarchBase: null, flavorFamily: "berry",
      cuisineEvidence: "American", definingComponents: ["strawberries", "Greek yogurt"],
    },
    foodIdentity: {
      foodRole: "dessert", polarity: "sweet", formatFamily: format,
      preparationStyle: frozen ? "frozen" : "chilled", texture: frozen ? "smooth" : "creamy",
    },
  };
}

const cheesecake = dessert("Set Strawberry Cheesecake", "cheesecake");
const frozen = dessert("Frozen Strawberry Yogurt Bark", "frozen_dessert");
const cookie = dessert("No Bake Strawberry Almond Cookie", "cookie");
const request = {
  occasion: "snack" as const, menuShape: "craving" as const, cravingCategory: "dessert" as const,
  developmentDessertCompletion: true, subjectLabel: "synthetic client",
  userContext: ["Preserve cardiac, low-carb and allergy authority."],
  requiredCuisine: null, history: [], validate: (_concept: GeneratedMenuConcept) => [] as string[],
};

describe("Development My Perfect Menu dessert completion", () => {
  const originalMode = process.env.NODE_ENV;
  const originalDeployment = process.env.REPLIT_DEPLOYMENT;
  let diagnosticLog: jest.SpyInstance;
  beforeEach(() => {
    diagnosticLog = jest.spyOn(console, "info").mockImplementation(() => {});
    process.env.NODE_ENV = "development";
    delete process.env.REPLIT_DEPLOYMENT;
  });
  afterEach(() => {
    diagnosticLog.mockRestore();
    process.env.NODE_ENV = originalMode;
    if (originalDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
    else process.env.REPLIT_DEPLOYMENT = originalDeployment;
  });

  it("does not equate shared compatible ingredients with identical dessert structures", () => {
    expect(areDessertDuplicates(cheesecake, frozen)).toBe(false);
    expect(areDessertDuplicates(cheesecake, { ...cheesecake, title: "Delicious Cheesecake" })).toBe(true);
  });

  it("retains two valid desserts, supplies their identities on retries, and completes only the third", async () => {
    const sizes: number[] = [];
    const result = await generateCulinaryConcepts({
      ...request,
      generate: async ({ requestedCount, user }) => {
        sizes.push(requestedCount);
        if (sizes.length > 1) {
          expect(user).toContain(cheesecake.title);
          expect(user).toContain(frozen.title);
          expect(user).toContain("Fill only the missing position");
          expect(user).toContain("cardiac, low-carb and allergy");
        }
        return { concepts: sizes.length === 1 ? [cheesecake, frozen]
          : sizes.length === 2 ? [{ ...cheesecake, title: "Renamed Strawberry Cheesecake" }] : [cookie] };
      },
    });
    expect(sizes).toEqual([3, 1, 1]);
    expect(result.concepts.map(concept => concept.title)).toEqual([
      cheesecake.title, frozen.title, cookie.title,
    ]);
  });

  it("never trades a hard allergy rejection for a completed set", async () => {
    let attempts = 0;
    const result = await generateCulinaryConcepts({
      ...request,
      validate: concept => concept.primaryIngredients.includes("peanuts") ? ["allergen_or_avoidance_violation:peanut"] : [],
      generate: async () => ({ concepts: ++attempts === 1
        ? [cheesecake, frozen, { ...cookie, primaryIngredients: [...cookie.primaryIngredients, "peanuts"] }]
        : [cookie] }),
    });
    expect(attempts).toBe(2);
    expect(result.concepts).toHaveLength(3);
    expect(result.concepts.every(concept => !concept.primaryIngredients.includes("peanuts"))).toBe(true);
  });

  it("reports repetition exhaustion truthfully without returning a partial set or blaming medical compatibility", async () => {
    const generate = jest.fn(async () => ({ concepts: [cheesecake, frozen] }));
    await expect(generateCulinaryConcepts({ ...request, generate })).rejects.toMatchObject({
      code: "CONCEPT_VARIETY_COMPLETION_FAILED", status: 422, missingCount: 1,
      message: expect.stringContaining("2 passed validation"),
    });
    expect(generate).toHaveBeenCalledTimes(5);
  });

  it("distinguishes cheesecake and parfait even with generic format labels and identical ingredients", () => {
    const parfait = {
      ...cheesecake, title: "Berry Dessert Parfait",
      culinaryIdentity: { ...cheesecake.culinaryIdentity, dishForm: "parfait" },
      foodIdentity: { ...cheesecake.foodIdentity!, formatFamily: "general_sweet" as const },
    };
    expect(areDessertDuplicates({
      ...cheesecake, foodIdentity: { ...cheesecake.foodIdentity!, formatFamily: "general_sweet" },
    }, parfait)).toBe(false);
  });

  it("allows a historical signature collision when sufficient structure proves different desserts", async () => {
    const result = await generateCulinaryConcepts({
      ...request, previousDesserts: [cheesecake],
      history: [buildCulinaryFingerprint(cheesecake, "snack")],
      priorSignatures: [cheesecake.signature],
      generate: async () => ({ concepts: [
        frozen, cookie, {
          ...cheesecake, title: "Berry Pudding", signature: "berry pudding chilled",
          culinaryIdentity: { ...cheesecake.culinaryIdentity, dishForm: "pudding" },
          foodIdentity: { ...cheesecake.foodIdentity!, formatFamily: "pudding_custard" },
        },
      ] }),
    });
    expect(result.concepts).toHaveLength(3);
    expect(result.attemptsCompleted).toBe(1);
  });

  it("rejects a renamed historical cheesecake with a changed signature", async () => {
    const validate = jest.fn(() => []);
    const result = await generateCulinaryConcepts({
      ...request, validate,
      history: [buildCulinaryFingerprint(cheesecake, "snack")],
      priorSignatures: [cheesecake.signature],
      generate: async ({ attempt }) => ({ concepts: attempt === 0
        ? [{ ...cheesecake, title: "New Berry Delight", signature: "different signature" }, frozen, cookie]
        : [{
          ...cheesecake, title: "Berry Dessert Parfait", signature: "berry parfait chilled",
          culinaryIdentity: { ...cheesecake.culinaryIdentity, dishForm: "parfait" },
          foodIdentity: { ...cheesecake.foodIdentity!, formatFamily: "no_bake_dessert" },
        }] }),
    });
    expect(result.concepts.map(item => item.title)).not.toContain("New Berry Delight");
    expect(result.rejectionCodes).toContain("repetition:history_dessert_structure");
    expect(validate).toHaveBeenCalledTimes(4);
  });

  it("reports incomplete relevant historical evidence instead of inventing a structure or replacing choices", async () => {
    const savedChoices = [{ title: "Legacy choice", signature: cheesecake.signature }];
    const snapshot = JSON.stringify(savedChoices);
    const generate = jest.fn(async () => ({ concepts: [cheesecake, frozen, cookie] }));
    await expect(generateCulinaryConcepts({
      ...request, previousDesserts: savedChoices, generate,
    })).rejects.toMatchObject({ code: "CONCEPT_HISTORY_REVIEW_REQUIRED", status: 422 });
    expect(generate).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(savedChoices)).toBe(snapshot);
    expect(compareDessertStructures(cheesecake, savedChoices[0]).decision).toBe("uncertain");
  });

  it("does not automatically approve a signature collision with no historical structure", async () => {
    await expect(generateCulinaryConcepts({
      ...request, priorSignatures: [cheesecake.signature],
      generate: async () => ({ concepts: [cheesecake, frozen, cookie] }),
    })).rejects.toMatchObject({ code: "CONCEPT_HISTORY_REVIEW_REQUIRED" });
  });
  it("requires review for overlapping unclassified legacy history without inventing a dessert form", async () => {
    const legacy = {
      ...buildCulinaryFingerprint(cheesecake, "snack"), dishForm: "dessert",
      fingerprint: "ci1-0000000000000000",
    };
    await expect(generateCulinaryConcepts({
      ...request, history: [legacy],
      generate: async () => ({ concepts: [cheesecake, frozen, cookie] }),
    })).rejects.toMatchObject({ code: "CONCEPT_HISTORY_REVIEW_REQUIRED" });
  });
  it("does not invent a dessert identity for disjoint, unclassified snack history and reports the branch", async () => {
    const legacy = {
      ...buildCulinaryFingerprint(cheesecake, "snack"), dishForm: "savory wrap",
      ingredients: ["chickpeas", "cucumber", "lettuce"], fingerprint: "ci1-0000000000000000",
    };
    const events: DessertDiagnostic[] = [];
    const result = await generateCulinaryConcepts({
      ...request, history: [legacy], onDiagnostic: event => events.push(event),
      generate: async () => ({ concepts: [cheesecake, frozen, cookie] }),
    });
    expect(result.concepts).toHaveLength(3);
    expect(events.some(event => event.branch === "history:unclassified_nonmatching_snack")).toBe(true);
  });

  it("does not equate a contradictory format label with evidence of novelty", () => {
    expect(compareDessertStructures(cheesecake, {
      ...cheesecake, foodIdentity: { ...cheesecake.foodIdentity!, formatFamily: "cookie" },
    }).decision).toBe("uncertain");
  });

  it.each(["protocol:clinical_restriction", "forbidden_ingredient:allergy", "dietary:identity", "cuisine_mismatch:requested"])(
    "never bypasses authoritative validation, even with a signature collision: %s", violation => {
      const validate = jest.fn(() => [violation]);
      return expect(generateCulinaryConcepts({
        ...request, validate, previousDesserts: [cheesecake], priorSignatures: [cheesecake.signature],
        generate: async () => ({ concepts: [cheesecake] }),
      })).rejects.toMatchObject({ code: "CONCEPT_REPAIR_EXHAUSTED" }).then(() => {
        expect(validate).toHaveBeenCalledTimes(3);
      });
    },
  );

  it("retains the original two across all five rounds and logs only safe diagnostic fields", async () => {
    const events: DessertDiagnostic[] = [], sizes: number[] = [];
    const privateCheesecake = { ...cheesecake, title: "PRIVATE-TITLE-CANARY" };
    await expect(generateCulinaryConcepts({
      ...request, subjectLabel: "PRIVATE-PATIENT-CANARY", userContext: ["PRIVATE-PROFILE-CANARY"],
      onDiagnostic: event => events.push(event),
      generate: async ({ requestedCount, user }) => {
        sizes.push(requestedCount);
        if (sizes.length > 1) {
          expect(user).toContain(privateCheesecake.title);
          expect(user).toContain(frozen.title);
        }
        return { concepts: sizes.length === 1 ? [privateCheesecake, frozen] : [privateCheesecake] };
      },
    })).rejects.toMatchObject({ attemptsCompleted: 5, missingCount: 1 });
    expect(sizes).toEqual([3, 1, 1, 1, 1]);
    expect(events.at(-1)).toMatchObject({
      stage: "completion", attempt: 5, acceptedCount: 2, rejectedCount: 4, candidateCount: 6,
    });
    expect(events.some(event => event.branch === "batch:exact_fingerprint")).toBe(true);
    const logs = JSON.stringify(diagnosticLog.mock.calls);
    expect(logs).not.toMatch(/PRIVATE-|Greek yogurt|strawberries|cardiac/i);
  });

  it("keeps the real route's saved-choice write after successful generation, outside its failure handler", () => {
    const source = readFileSync("server/routes/myPerfectMenu.ts", "utf8");
    const start = source.indexOf('router.post("/concepts"');
    const route = source.slice(start);
    const generation = route.indexOf("const generated = await generateCulinaryConcepts(");
    const save = route.indexOf("await mutatePreferences(");
    const failure = route.indexOf("} catch (error)", save);
    expect(generation).toBeGreaterThan(0);
    expect(save).toBeGreaterThan(generation);
    expect(route.slice(failure)).not.toContain("mutatePreferences(");
  });

  it.each([
    ["production", undefined, true],
    ["development", "1", true],
    ["development", undefined, false],
  ])("does not change behavior outside the approved caller/runtime: %s %s %s", async (mode, deployed, optIn) => {
    process.env.NODE_ENV = mode as string;
    if (deployed === undefined) delete process.env.REPLIT_DEPLOYMENT;
    else process.env.REPLIT_DEPLOYMENT = deployed;
    const generate = jest.fn(async ({ user }) => {
      expect(user).not.toContain("Retained, fully governed desserts");
      expect(diagnosticLog).not.toHaveBeenCalled();
      return { concepts: [cheesecake, frozen, cookie] };
    });
    await expect(generateCulinaryConcepts({
      ...request, developmentDessertCompletion: optIn, generate,
    })).rejects.toMatchObject({ code: "CONCEPT_REPAIR_EXHAUSTED" });
  });
});
