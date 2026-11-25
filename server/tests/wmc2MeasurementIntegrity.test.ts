jest.mock("../services/mealgenV2", () => ({
  getOnboarding: jest.fn(),
  onboardingHash: jest.fn(() => "test-profile")
}));

jest.mock("../services/mealgen_v2", () => ({
  generateStrictMeal: jest.fn()
}));

jest.mock("../services/varietyBank", () => ({
  varietyBank: { has: jest.fn(() => false), add: jest.fn() }
}));

jest.mock("../services/allergyGuardrails", () => ({
  buildForbiddenIngredients: jest.fn(() => []),
  scanForViolations: jest.fn(),
  logSafetyEnforcement: jest.fn()
}));

jest.mock("../services/ontology", () => ({
  allergenViolated: jest.fn(() => false),
  banViolated: jest.fn(() => false)
}));

jest.mock("../services/macroEstimator", () => ({
  estimateMacros: jest.fn(() => null)
}));

import { wmc2Generate, wmc2Regenerate } from "../services/wmc2Adapter";
import { getOnboarding } from "../services/mealgenV2";
import { scanForViolations } from "../services/allergyGuardrails";
import { varietyBank } from "../services/varietyBank";
import { parseMeasurementNumber } from "../../shared/units";

const originalFetch = global.fetch;
const mockFetch = jest.fn();
let sequence = 0;

const slot = {
  slot: "meal" as const,
  label: "Lunch",
  time: "12:00",
  order: 0
};

function input(mode: "repeat_one" | "ai_varied") {
  return {
    userId: `wmc2-test-${++sequence}`,
    days: "1",
    schedule: [slot],
    includeImages: false,
    mode
  } as any;
}

function response(ingredients: unknown, name = "Lentil salad") {
  return {
    ok: true,
    json: async () => ({
      meal: {
        name,
        ingredients,
        instructions: ["Combine cooked ingredients."],
        calories: 300,
        protein: 20,
        carbs: 40,
        fats: 5
      }
    })
  };
}

const valid = [{ name: "lentils", quantity: "0.5", unit: "cup" }];
const invalid = [{ name: "lentils", quantity: "invalid", unit: "cup" }];

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  global.fetch = mockFetch as any;
  (getOnboarding as jest.Mock).mockResolvedValue({
    allergies: [],
    avoid: []
  });
  (scanForViolations as jest.Mock).mockReturnValue([]);
  (varietyBank.has as jest.Mock).mockReturnValue(false);
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("WMC2 measurement integrity", () => {
  it.each([
    ["0.125", "cup", 0.125],
    ["0.005", "cup", 0.005],
    ["0.249", "cup", 0.249],
    ["1/8", "cup", 0.125],
    ["1 1/2", "cup", 1.5],
    ["0,5", "taza", 0.5]
  ])("preserves %s %s", async (quantity, unit, expected) => {
    mockFetch.mockResolvedValue(response([
      { name: "lentils", quantity, unit }
    ]));

    const result = await wmc2Generate(input("repeat_one"));
    const ingredient = result.items[0].ingredients[0];

    expect(ingredient.name).toBe("lentils");
    expect(ingredient.amount).toMatch(/ cup$/);
    expect(parseMeasurementNumber(
      ingredient.amount.replace(/ cup$/, "")
    )).toBe(expected);
  });

  it("retries invalid measurements within the existing budget", async () => {
    mockFetch
      .mockResolvedValueOnce(response(invalid))
      .mockResolvedValue(response(valid));

    const result = await wmc2Generate(input("repeat_one"));

    expect(result.items[0].ingredients[0].amount).toBe("0.5 cup");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["repeat_one", 4],
    ["ai_varied", 5]
  ] as const)("rejects exhausted measurement retries in %s", async (mode, attempts) => {
    mockFetch.mockResolvedValue(response(invalid));

    await expect(wmc2Generate(input(mode))).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(attempts);
  });

  it.each([
    ["repeat_one", 4],
    ["ai_varied", 5]
  ] as const)("rejects exhausted dietary retries in %s", async (mode, attempts) => {
    mockFetch.mockResolvedValue(response(valid));
    (scanForViolations as jest.Mock).mockReturnValue(["test violation"]);

    await expect(wmc2Generate(input(mode))).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(attempts);
  });

  it("rejects invalid regeneration measurements", async () => {
    mockFetch.mockResolvedValue(response(invalid));

    await expect(wmc2Regenerate("regen-user", slot)).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("rejects regeneration with dietary violations", async () => {
    mockFetch.mockResolvedValue(response(valid));
    (scanForViolations as jest.Mock).mockReturnValue(["test violation"]);

    await expect(wmc2Regenerate("regen-user", slot)).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not cache an incomplete plan after generation fails", async () => {
    const req = input("ai_varied");
    mockFetch.mockRejectedValueOnce(new Error("Mock generation failure"));

    await expect(wmc2Generate(req)).rejects.toThrow();

    mockFetch.mockResolvedValue(response(valid));
    const result = await wmc2Generate(req);

    expect(result.items).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("rejects a dietary violation introduced by a variety replacement", async () => {
    mockFetch
      .mockResolvedValueOnce(response(valid))
      .mockResolvedValue(response(valid, "Replacement meal"));

    (varietyBank.has as jest.Mock)
      .mockReturnValueOnce(true)
      .mockReturnValue(false);

    (scanForViolations as jest.Mock).mockImplementation(
      (meal: any) => meal.name === "Replacement meal"
        ? ["test violation"]
        : []
    );

    await expect(wmc2Generate(input("ai_varied"))).rejects.toThrow();
  });
});
