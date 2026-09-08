import {
  canonicalProduceIn,
  validateGlycemicProduce,
} from "../services/glycemicProduceValidator";

describe("glycemic produce validator", () => {
  test("recognizes current produce canonicals and exact aliases only", () => {
    expect(canonicalProduceIn("roasted Tomatoes")).toBe("Tomatoes");
    expect(canonicalProduceIn("Bell Pepper")).toBe("Bell Peppers");
    expect(canonicalProduceIn("applewood smoked bacon")).toBeNull();
    expect(canonicalProduceIn("pineapple salsa")).toBe("Pineapple");
  });

  test("strictly enforces an explicit configured list without flagging unrelated foods", () => {
    const result = validateGlycemicProduce({
      ingredients: ["Apple slices", "Broccoli", "Chicken breast"],
      activePreferences: ["Broccoli"],
      preferencesConfigured: true,
      glucoseState: "IN_RANGE",
    });
    expect(result.allowed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({ ingredient: "Apple slices", canonical: "Apple" }),
    ]);
  });

  test("does not enforce an allowlist until preferences are configured", () => {
    expect(validateGlycemicProduce({
      ingredients: ["Mango"],
      activePreferences: [],
      preferencesConfigured: false,
      glucoseState: "HIGH",
    })).toEqual({ allowed: true, violations: [], overrideApplied: [] });
  });

  test("permits low-glucose overrides only when explicitly supplied", () => {
    const base = {
      ingredients: ["Banana"],
      activePreferences: [],
      preferencesConfigured: true,
      glucoseState: "LOW" as const,
    };
    expect(validateGlycemicProduce(base).allowed).toBe(false);
    const overridden = validateGlycemicProduce({ ...base, safeLowGlucoseOverrides: ["Bananas"] });
    expect(overridden.allowed).toBe(true);
    expect(overridden.overrideApplied).toEqual(["Banana"]);
  });
});