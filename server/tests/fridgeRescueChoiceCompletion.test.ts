import { completeFridgeRescueChoices } from "../services/fridgeRescueChoiceCompletion";

const meal = (name: string, safe = true) => ({
  id: name, name, safe, ingredients: [{ name: "chicken" }],
  instructions: `Prepare using the ${name} method.`,
});
const validate = jest.fn(async (meals: ReturnType<typeof meal>[]) => ({
  accepted: meals.filter(item => item.safe),
  reasonCodes: meals.some(item => !item.safe) ? ["PROTOCOL_CANDIDATES_REJECTED"] : [],
}));
beforeEach(() => jest.clearAllMocks());

test("three verified distinct meals require only the original generation", async () => {
  const generate = jest.fn(async () => [meal("Skillet"), meal("Soup"), meal("Salad")]);
  const result = await completeFridgeRescueChoices({ enabled: true, generate, validate });
  expect(result.meals).toHaveLength(3);
  expect(generate).toHaveBeenCalledTimes(1);
  expect(result.completion).toMatchObject({ attempts: 1, partial: false, message: null });
});

test("replenishes only missing slots and validates every replacement", async () => {
  const generate = jest.fn()
    .mockResolvedValueOnce([meal("Skillet"), meal("Rejected", false), meal("Unsafe", false)])
    .mockResolvedValueOnce([meal("Soup"), meal("Salad")]);
  const result = await completeFridgeRescueChoices({ enabled: true, generate, validate });
  expect(result.meals.map(item => item.name)).toEqual(["Skillet", "Soup", "Salad"]);
  expect(generate.mock.calls.map(([value]) => value)).toEqual([
    { count: 3, excludedMeals: [] }, { count: 2, excludedMeals: ["Skillet"] },
  ]);
  expect(validate).toHaveBeenCalledTimes(2);
});

test("removes duplicate names despite case, punctuation and changed IDs", async () => {
  const generate = jest.fn()
    .mockResolvedValueOnce([meal("Chicken Soup"), { ...meal("CHICKEN-SOUP"), id: "other" }, meal("Salad")])
    .mockResolvedValueOnce([meal("Skillet")]);
  const result = await completeFridgeRescueChoices({ enabled: true, generate, validate });
  expect(result.meals.map(item => item.name)).toEqual(["Chicken Soup", "Salad", "Skillet"]);
  expect(result.completion.reasonCodes).toContain("DUPLICATE_CANDIDATES");
});

test("a renamed copy with identical ingredients and preparation is not a distinct recipe", async () => {
  const original = meal("Skillet");
  const generate = jest.fn()
    .mockResolvedValueOnce([original, { ...original, name: "New name", id: "new-id" }, meal("Salad")])
    .mockResolvedValueOnce([meal("Soup")]);
  const result = await completeFridgeRescueChoices({ enabled: true, generate, validate });
  expect(result.meals.map(item => item.name)).toEqual(["Skillet", "Salad", "Soup"]);
});

test("repeated unsafe replacements exhaust exactly two retries without relaxing requirements", async () => {
  const generate = jest.fn().mockResolvedValue([meal("Unsafe", false)]);
  const result = await completeFridgeRescueChoices({ enabled: true, generate, validate });
  expect(result.meals).toEqual([]);
  expect(generate).toHaveBeenCalledTimes(3);
  expect(validate).toHaveBeenCalledTimes(3);
  expect(result.completion.reasonCodes).toEqual(expect.arrayContaining(["CANDIDATES_REJECTED", "RETRY_LIMIT_REACHED"]));
  expect(result.completion.message).toContain("No requirements were relaxed");
});

test("exhausted duplicate-only retries preserve a single verified choice and explain the shortfall", async () => {
  const generate = jest.fn().mockResolvedValue([meal("Skillet")]);
  const result = await completeFridgeRescueChoices({ enabled: true, generate, validate });
  expect(result.meals).toHaveLength(1);
  expect(result.completion).toMatchObject({ partial: true, returnedCount: 1, attempts: 3 });
  expect(result.completion.message).toContain("Showing 1 of 3");
  expect(result.completion.message).toContain("repeated");
});

test("a retry failure preserves already validated results rather than serving unchecked candidates", async () => {
  const generate = jest.fn().mockResolvedValueOnce([meal("Soup")]).mockRejectedValueOnce(new Error("provider unavailable"));
  const result = await completeFridgeRescueChoices({ enabled: true, generate, validate });
  expect(result.meals).toHaveLength(1);
  expect(result.completion.reasonCodes).toContain("REPLENISHMENT_UNAVAILABLE");
  expect(validate).toHaveBeenCalledTimes(1);
});

test("a failed retry validator cannot add any of that batch's candidates", async () => {
  const generate = jest.fn().mockResolvedValueOnce([meal("Soup")]).mockResolvedValueOnce([meal("Skillet"), meal("Salad")]);
  const validator = jest.fn().mockResolvedValueOnce({ accepted: [meal("Soup")], reasonCodes: [] })
    .mockRejectedValueOnce(new Error("validator unavailable"));
  const result = await completeFridgeRescueChoices({ enabled: true, generate, validate: validator });
  expect(result.meals.map(item => item.name)).toEqual(["Soup"]);
  expect(result.completion.reasonCodes).toContain("REPLENISHMENT_UNAVAILABLE");
});

test("initial generation and validation errors retain the existing failure path", async () => {
  await expect(completeFridgeRescueChoices({
    enabled: true, generate: async () => { throw new Error("initial failure"); }, validate,
  })).rejects.toThrow("initial failure");
});

test("Production-disabled completion preserves the one-batch result without deduplication or retries", async () => {
  const generate = jest.fn().mockResolvedValue([meal("Soup"), meal("Soup")]);
  const result = await completeFridgeRescueChoices({ enabled: false, generate, validate });
  expect(result.meals).toHaveLength(2);
  expect(generate).toHaveBeenCalledTimes(1);
});

test("empty batches reach the retry limit and never fabricate a recipe", async () => {
  const generate = jest.fn().mockResolvedValue([]);
  const result = await completeFridgeRescueChoices({ enabled: true, generate, validate });
  expect(result.meals).toEqual([]);
  expect(result.completion.reasonCodes).toEqual(expect.arrayContaining(["GENERATOR_SHORTFALL", "RETRY_LIMIT_REACHED"]));
  expect(generate).toHaveBeenCalledTimes(3);
});
