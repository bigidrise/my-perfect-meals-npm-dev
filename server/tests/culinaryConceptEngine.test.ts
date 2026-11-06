import { buildCulinaryFingerprint } from "../../shared/culinaryIdentity";
import { generateCulinaryConcepts } from "../services/myPerfectMenu/culinaryConceptEngine";

jest.mock("../utils/openaiSafe", () => ({
  chatJson: jest.fn(() => { throw new Error("Paid provider forbidden in deterministic tests"); }),
}));

const concept = (title: string, dishForm: string) => ({
  title,
  description: `${title} with vegetables and herbs.`,
  primaryIngredients: dishForm === "stuffed pepper"
    ? ["lentils", "peppers", "cumin"] : dishForm === "flatbread"
      ? ["lentils", "whole wheat", "rosemary"] : ["lentils", "tomatoes", "herbs"],
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
  it("repairs protocol rejection with exact reasons while preserving accepted choices and authority", async () => {
    const prompts: string[] = [];
    const rejected = { ...choices[2], title: "Butter Flatbread", primaryIngredients: ["butter", "flour"] };
    const result = await generateCulinaryConcepts(request({
      requiredCuisine: "Mediterranean",
      userContext: ["Anti-Inflammatory guidance", "No peanuts; vegetarian; clinical authority unchanged"],
      validate: (candidate: { title: string }) => candidate.title === rejected.title
        ? ["protocol:anti_inflammatory:butter", "dietary:vegetarian", "cuisine:incompatible"] : [],
      generate: async ({ user, system, requestedCount }: { user: string; system: string; requestedCount: number }) => {
        prompts.push(user);
        expect(system).toContain("recognizably Mediterranean");
        expect(user).toContain("Anti-Inflammatory guidance");
        expect(user).toContain("No peanuts; vegetarian; clinical authority unchanged");
        expect(requestedCount).toBe(prompts.length === 1 ? 3 : 1);
        return { concepts: prompts.length === 1 ? [choices[0], choices[1], rejected] : [choices[2]] };
      },
    }));
    expect(result.attemptsCompleted).toBe(2);
    expect(result.concepts.map(c => c.title)).toEqual(expect.arrayContaining(choices.map(c => c.title)));
    expect(prompts[1]).toContain("protocol:anti_inflammatory:butter");
    expect(prompts[1]).toContain("dietary:vegetarian");
    expect(prompts[1]).toContain("cuisine:incompatible");
    expect(prompts[1]).toContain('"retainedCandidates"');
    expect(prompts[1]).not.toContain('"title":"Butter Flatbread"');
  });

  it("supplies exact metadata field rules for ordinary Menu repairs", async () => {
    const prompts: string[] = [];
    await generateCulinaryConcepts(request({
      generate: async ({ user }: { user: string }) => {
        prompts.push(user);
        return { concepts: prompts.length === 1
          ? [{ ...choices[0], primaryIngredients: ["lentils"] }] : choices };
      },
    }));
    expect(prompts[1]).toContain("schema_metadata_failure");
    expect(prompts[1]).toContain("primaryIngredients");
    expect(prompts[1]).toContain('"schemaFields":[');
    expect(prompts[1]).toContain('"missingCount":3');
  });

  it("provides repetition details and requests only missing positions", async () => {
    const prompts: string[] = [];
    const result = await generateCulinaryConcepts(request({
      generate: async ({ user, requestedCount }: { user: string; requestedCount: number }) => {
        prompts.push(user);
        expect(requestedCount).toBe(prompts.length === 1 ? 3 : 2);
        return { concepts: prompts.length === 1 ? [choices[0], choices[0]] : choices.slice(1) };
      },
    }));
    expect(result.concepts).toHaveLength(3);
    expect(prompts[1]).toContain("repetition:signature");
    expect(prompts[1]).toContain("genuinely different culinary structure");
  });

  it("repairs a short, otherwise valid set without discarding its sibling", async () => {
    const prompts: string[] = [];
    await generateCulinaryConcepts(request({
      generate: async ({ user }: { user: string }) => {
        prompts.push(user);
        return { concepts: prompts.length === 1 ? [choices[0]] : choices.slice(1) };
      },
    }));
    expect(prompts[1]).toContain('"missingCount":2');
    expect(prompts[1]).toContain(choices[0].title);
  });

  it("rejects renamed within-batch culinary duplicates, never a full invalid set", async () => {
    const generate = jest.fn(async () => ({ concepts: [
      choices[0],
      { ...choices[0], title: "Another Skillet", signature: "another skillet" },
      { ...choices[0], title: "Herby Skillet", signature: "herby skillet" },
    ] }));
    await expect(generateCulinaryConcepts(request({ generate })))
      .rejects.toMatchObject({ attemptsCompleted: 5, missingCount: 2 });
    expect(generate).toHaveBeenCalledTimes(5);
    expect(generate.mock.calls).toHaveLength(5);
  });
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