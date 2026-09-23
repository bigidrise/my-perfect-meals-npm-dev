import { buildCulinaryFingerprint } from "../../shared/culinaryIdentity";
import { generateCulinaryConcepts } from "../services/myPerfectMenu/culinaryConceptEngine";

const concept = (title: string, dishForm: string) => ({
  title,
  description: `${title} with vegetables and herbs.`,
  primaryIngredients: ["lentils", "tomatoes", "herbs"],
  primaryProtein: "lentils",
  produceItems: ["tomatoes"],
  cuisine: "Mediterranean",
  dietaryEvidence: [],
  preparationMethod: "roasted",
  signature: `${title}|${dishForm}|roasted`,
  culinaryIdentity: {
    dishForm,
    preparationStyle: "roasted",
    temperature: "hot",
    primaryProteinBase: "lentils",
    majorStarchBase: null,
    flavorFamily: title,
    cuisineEvidence: "Mediterranean",
    definingComponents: ["lentils", "tomatoes"],
  },
});
const choices = [
  concept("Roasted Lentil Skillet", "skillet"),
  concept("Lentil Stuffed Peppers", "stuffed pepper"),
  concept("Lentil Herb Flatbread", "flatbread"),
];
const request = (overrides: Record<string, unknown> = {}) => ({
  occasion: "lunch" as const,
  subjectLabel: "the person being fed",
  userContext: ["Authoritative food context"],
  requiredCuisine: null,
  history: [],
  validate: () => [],
  ...overrides,
});

describe("shared culinary concept engine", () => {
  it.each(["breakfast", "lunch", "dinner", "snack"] as const)(
    "creates exactly three %s concepts with the MPM prompt and distinct forms",
    async (occasion) => {
      const generate = jest.fn(async ({ system, user }: { system: string; user: string }) => {
        expect(system).toContain('"concepts"');
        expect(user).toContain("Authoritative food context");
        return { concepts: choices };
      });
      const result = await generateCulinaryConcepts(request({ occasion, generate }));
      expect(result.concepts).toHaveLength(3);
      expect(new Set(result.concepts.map((item) => item.culinaryIdentity.dishForm)).size).toBe(3);
      expect(generate).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    [0, [choices[0], choices[1], choices[2]], 3],
    [1, [choices[0]], 2],
    [2, [choices[0], choices[1]], 1],
  ])("retains %s valid siblings and requests only %s missing", async (retained, first, missing) => {
    const requests: number[] = [];
    const result = await generateCulinaryConcepts(request({
      generate: async ({ requestedCount }: { requestedCount: number }) => {
        requests.push(requestedCount);
        return { concepts: requests.length === 1 ? first : choices.slice(retained) };
      },
    }));
    expect(result.concepts).toHaveLength(3);
    expect(requests).toEqual(retained === 0 ? [3] : [3, missing]);
  });

  it("does not turn missing food facts into a metadata repair", async () => {
    await expect(generateCulinaryConcepts(request({
      generate: async () => ({ concepts: [{ ...choices[0], primaryIngredients: ["lentils"] }] }),
    }))).rejects.toMatchObject({
      code: "CONCEPT_TECHNICAL_COMPLETION_FAILED",
      attemptsCompleted: 3,
      missingCount: 3,
    });
  });

  it("allows up to five attempts only after a valid sibling, never returns a partial set", async () => {
    const requests: number[] = [];
    await expect(generateCulinaryConcepts(request({
      generate: async ({ requestedCount }: { requestedCount: number }) => {
        requests.push(requestedCount);
        return { concepts: [choices[0]] };
      },
    }))).rejects.toMatchObject({ attemptsCompleted: 5, missingCount: 2 });
    expect(requests).toEqual([3, 2, 2, 2, 2]);
  });

  it("keeps cuisine and authority rejection separate from technical failure", async () => {
    await expect(generateCulinaryConcepts(request({
      validate: () => ["forbidden_ingredient:shrimp"],
      generate: async () => ({ concepts: choices }),
    }))).rejects.toMatchObject({ code: "CONCEPT_REPAIR_EXHAUSTED", missingCount: 3 });
  });

  it("rejects a renamed repeat against caller history when required", async () => {
    const repeat = { ...choices[0], signature: "renamed|skillet|roasted" };
    await expect(generateCulinaryConcepts(request({
      rejectHistoryFingerprints: true,
      history: [buildCulinaryFingerprint(choices[0], "lunch")],
      generate: async () => ({ concepts: [repeat] }),
    }))).rejects.toMatchObject({ missingCount: 3 });
  });
});