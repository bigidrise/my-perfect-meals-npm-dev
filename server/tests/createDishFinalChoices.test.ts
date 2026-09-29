import {
  fillFinalCreateDishChoices,
  releaseCreateDishReplacementBatch,
  type ChoiceCandidate,
} from "../services/createDish/finalChoices";

type Recipe = ChoiceCandidate & { name: string; ingredients: string[]; instructions: string };
const recipe = (name: string, ingredient = name): Recipe => ({
  name, ingredients: [ingredient], instructions: `Simmer ${ingredient}`,
});

const run = (overrides: Partial<Parameters<typeof fillFinalCreateDishChoices<Recipe>>[0]> = {}) => {
  const generate = jest.fn<Promise<ChoiceCandidate[]>, [number, string[], AbortSignal]>()
    .mockResolvedValue([]);
  const validate = jest.fn<Promise<Recipe[]>, [ChoiceCandidate[]]>()
    .mockImplementation(async candidates => candidates as Recipe[]);
  return {
    generate, validate,
    execute: () => fillFinalCreateDishChoices<Recipe>({
      initial: [recipe("Chicken gumbo"), recipe("Beef gumbo"), recipe("Vegetable gumbo")],
      initialCandidates: [],
      deadlineAt: Date.now() + 10_000,
      maxRefillCalls: 2,
      generate, validate,
      ...overrides,
    }),
  };
};

describe("Create a Dish final-choice budget", () => {
  it("sends every replacement through the clinical, protocol, allergy, Human Food, dish, and post-format gates", async () => {
    const names = [
      "Carb limit", "Quinoa gumbo", "Shrimp gumbo", "Human Food fail",
      "Turkey soup", "Serving failure", "Formatted dish failure", "Chicken gumbo",
    ];
    const calls: string[] = [];
    const released = await releaseCreateDishReplacementBatch(
      names.map(name => recipe(name)),
      {
        clinical: candidate => { calls.push(`clinical:${candidate.name}`); return candidate.name !== "Carb limit"; },
        protocol: candidates => { calls.push("protocol"); return candidates.filter(candidate => candidate.name !== "Quinoa gumbo"); },
        allergen: candidates => { calls.push("allergen"); return candidates.filter(candidate => candidate.name !== "Shrimp gumbo"); },
        transform: async candidates => { calls.push("transform"); return candidates; },
        humanFood: candidate => { calls.push(`human:${candidate.name}`); return candidate.name !== "Human Food fail"; },
        dishIntent: candidate => { calls.push(`dish:${candidate.name}`); return candidate.name !== "Turkey soup"; },
        format: candidate => { calls.push(`format:${candidate.name}`); return candidate; },
        finalFood: candidate => { calls.push(`finalFood:${candidate.name}`); return candidate.name !== "Serving failure"; },
        finalDishIntent: candidate => { calls.push(`finalDish:${candidate.name}`); return candidate.name !== "Formatted dish failure"; },
      },
    );
    expect(released.map(candidate => candidate.name)).toEqual(["Chicken gumbo"]);
    expect(calls).toEqual(expect.arrayContaining([
      "clinical:Carb limit", "protocol", "allergen", "transform",
      "human:Human Food fail", "dish:Turkey soup", "format:Serving failure",
      "finalFood:Serving failure", "finalDish:Formatted dish failure",
      "finalFood:Chicken gumbo", "finalDish:Chicken gumbo",
    ]));
    expect(calls).not.toContain("human:Shrimp gumbo");
    expect(calls).not.toContain("format:Turkey soup");
    expect(calls).not.toContain("finalDish:Serving failure");
  });

  it("returns three verified initial choices without generating replacements", async () => {
    const { execute, generate } = run();
    expect((await execute()).choices).toHaveLength(3);
    expect(generate).not.toHaveBeenCalled();
  });

  it("replaces a shellfish/quinoa rejection only after the entire release validator passes", async () => {
    const generate = jest.fn().mockResolvedValueOnce([
      recipe("Shrimp gumbo", "shrimp"), recipe("Turkey gumbo", "turkey"),
      recipe("Quinoa gumbo", "quinoa"),
    ]).mockResolvedValueOnce([recipe("Okra gumbo", "okra")]);
    const validate = jest.fn(async (candidates: ChoiceCandidate[]) =>
      candidates.filter(candidate =>
        !candidate.ingredients?.some(ingredient => ["shrimp", "quinoa"].includes(String(ingredient)))
      ) as Recipe[]);
    const result = await run({
      initial: [recipe("Chicken gumbo")],
      initialCandidates: [recipe("Chicken gumbo"), recipe("Shrimp gumbo", "shrimp")],
      generate, validate,
    }).execute();
    expect(result.choices.map(choice => choice.name)).toEqual([
      "Chicken gumbo", "Turkey gumbo", "Okra gumbo",
    ]);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[0][1]).toContain("Shrimp gumbo");
    expect(generate.mock.calls[1][1]).toContain("Quinoa gumbo");
  });

  it("rejects a food-safe recipe that lacks dish identity", async () => {
    const validate = jest.fn(async (candidates: ChoiceCandidate[]) =>
      candidates.filter(candidate => candidate.name !== "Turkey soup") as Recipe[]);
    const result = await run({
      initial: [recipe("Chicken gumbo"), recipe("Beef gumbo")],
      generate: jest.fn().mockResolvedValueOnce([recipe("Turkey soup")])
        .mockResolvedValueOnce([recipe("Okra gumbo")]),
      validate,
    }).execute();
    expect(result.choices.map(choice => choice.name)).toEqual([
      "Chicken gumbo", "Beef gumbo", "Okra gumbo",
    ]);
  });

  it("never pads with duplicates or recipes rejected at different gates", async () => {
    const generate = jest.fn().mockResolvedValueOnce([
      recipe("Chicken gumbo"), recipe("Quinoa gumbo", "quinoa"),
      recipe("Turkey soup"),
    ]).mockResolvedValueOnce([
      recipe("Beef gumbo"), recipe("Post-format failure"),
    ]);
    const validate = jest.fn(async (candidates: ChoiceCandidate[]) =>
      candidates.filter(candidate =>
        !["Quinoa gumbo", "Turkey soup", "Post-format failure"].includes(candidate.name ?? "")
      ) as Recipe[]);
    const result = await run({
      initial: [recipe("Chicken gumbo")], generate, validate,
    }).execute();
    expect(result.choices.map(choice => choice.name)).toEqual(["Chicken gumbo", "Beef gumbo"]);
    expect(result.refillCalls).toBe(2);
  });

  it("rejects the same recipe with a different title", async () => {
    const result = await run({
      initial: [recipe("Chicken gumbo", "chicken")],
      generate: jest.fn().mockResolvedValueOnce([recipe("My chicken gumbo", "chicken")])
        .mockResolvedValueOnce([]),
    }).execute();
    expect(result.choices).toHaveLength(1);
  });

  it("rejects the same ingredients with paraphrased instructions", async () => {
    const rewritten = recipe("New chicken gumbo", "chicken");
    rewritten.instructions = "Cook chicken slowly instead";
    const result = await run({
      initial: [recipe("Chicken gumbo", "chicken")],
      generate: jest.fn().mockResolvedValueOnce([rewritten]).mockResolvedValueOnce([]),
    }).execute();
    expect(result.choices.map(choice => choice.name)).toEqual(["Chicken gumbo"]);
  });

  it("can fill an empty final set, without accepting a previously rejected candidate", async () => {
    const result = await run({
      initial: [],
      initialCandidates: [recipe("Quinoa gumbo", "quinoa")],
      generate: jest.fn().mockResolvedValueOnce([
        recipe("Quinoa gumbo", "quinoa"), recipe("Chicken gumbo"), recipe("Turkey gumbo"),
        recipe("Okra gumbo"),
      ]),
    }).execute();
    expect(result.choices.map(choice => choice.name)).toEqual([
      "Chicken gumbo", "Turkey gumbo", "Okra gumbo",
    ]);
  });

  it("stops at the call limit or deadline and returns only verified survivors", async () => {
    const generate = jest.fn().mockResolvedValue([]);
    const expired = await run({
      initial: [recipe("Chicken gumbo")],
      deadlineAt: Date.now() - 1,
      generate,
    }).execute();
    expect(expired).toMatchObject({ refillCalls: 0, timedOut: true });
    expect(generate).not.toHaveBeenCalled();
    const exhausted = await run({ initial: [recipe("Chicken gumbo")], generate }).execute();
    expect(exhausted.choices).toHaveLength(1);
    expect(exhausted.refillCalls).toBe(2);
  });

  it("aborts an in-flight replacement when the request deadline expires", async () => {
    const generate = jest.fn((_call: number, _excluded: string[], signal: AbortSignal) =>
      new Promise<ChoiceCandidate[]>(resolve => {
        signal.addEventListener("abort", () => resolve([recipe("Late gumbo")]), { once: true });
      }));
    const result = await run({
      initial: [recipe("Chicken gumbo")],
      deadlineAt: Date.now() + 15,
      generate,
    }).execute();
    expect(result).toMatchObject({ refillCalls: 1, timedOut: true });
    expect(result.choices.map(choice => choice.name)).toEqual(["Chicken gumbo"]);
    expect(generate.mock.calls[0][2].aborted).toBe(true);
  });

  it("never counts validation that finishes after the refill deadline", async () => {
    const result = await run({
      initial: [recipe("Chicken gumbo")],
      deadlineAt: Date.now() + 15,
      generate: jest.fn().mockResolvedValue([recipe("Turkey gumbo")]),
      validate: jest.fn(() => new Promise<Recipe[]>(resolve =>
        setTimeout(() => resolve([recipe("Turkey gumbo")]), 30))),
    }).execute();
    expect(result).toMatchObject({ timedOut: true, refillCalls: 1 });
    expect(result.choices.map(choice => choice.name)).toEqual(["Chicken gumbo"]);
  });
});