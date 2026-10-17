import { generateCulinaryConcepts } from "../services/myPerfectMenu/culinaryConceptEngine";
import { areDessertDuplicates } from "../services/myPerfectMenu/developmentDessertCompletion";
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
  beforeEach(() => {
    process.env.NODE_ENV = "development";
    delete process.env.REPLIT_DEPLOYMENT;
  });
  afterEach(() => {
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
      return { concepts: [cheesecake, frozen, cookie] };
    });
    await expect(generateCulinaryConcepts({
      ...request, developmentDessertCompletion: optIn, generate,
    })).rejects.toMatchObject({ code: "CONCEPT_REPAIR_EXHAUSTED" });
  });
});
