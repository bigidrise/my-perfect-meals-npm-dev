import {
  BEVERAGE_DIET_FIT_EXPLANATION_INSTRUCTION,
  ensureBeverageDietTitle,
  getBeverageDietTitleLabel,
} from "../services/beverageTitle";

describe("Beverage Creator dietary title identity", () => {
  const supportedDiets = [
    ["mediterranean", "Mediterranean"],
    ["vegan", "Vegan"],
    ["vegetarian", "Vegetarian"],
    ["pescatarian", "Pescatarian"],
    ["keto", "Keto"],
    ["paleo", "Paleo"],
    ["flexitarian", "Flexitarian"],
    ["gluten-free", "Gluten-Free"],
    ["kosher", "Kosher"],
    ["halal", "Halal"],
    ["carnivore", "Carnivore"],
    ["low-sugar", "Low-Sugar"],
    ["dairy-free", "Dairy-Free"],
    ["high-protein", "High-Protein"],
    ["low-calorie", "Low-Calorie"],
    ["no-alcohol", "No-Alcohol"],
  ] as const;

  test.each(supportedDiets)(
    "prefixes a %s beverage with its identity",
    (diet, expectedLabel) => {
      expect(
        ensureBeverageDietTitle("Tropical Berry Cooler", [diet]),
      ).toBe(`${expectedLabel} Tropical Berry Cooler`);
    },
  );

  test("uses the explicit override before profile restrictions", () => {
    expect(
      ensureBeverageDietTitle(
        "Lime Vodka Soda",
        ["keto", "vegan"],
      ),
    ).toBe("Keto Lime Vodka Soda");
  });

  test.each([
    "Vegan Tropical Berry Cooler",
    "vegan: Tropical Berry Cooler",
    "Tropical Berry Cooler (vegan)",
  ])("does not duplicate an existing Vegan label: %s", (name) => {
    expect(ensureBeverageDietTitle(name, ["vegan"])).toBe(name);
  });

  test("does not duplicate a hyphenated identity when the title uses spaces", () => {
    const title = "Gluten Free Berry Fizz";
    expect(ensureBeverageDietTitle(title, ["gluten-free"])).toBe(title);
  });

  test("localizes the deterministic fallback label", () => {
    expect(
      getBeverageDietTitleLabel(["vegan"], "es-MX"),
    ).toBe("Vegano");
    expect(
      ensureBeverageDietTitle("Enfriador de Frutos Rojos", ["keto"], "fr"),
    ).toBe("Kéto Enfriador de Frutos Rojos");
  });

  test("leaves titles unchanged when no supported diet is explicit", () => {
    expect(ensureBeverageDietTitle("Tropical Berry Cooler", ["none"])).toBe(
      "Tropical Berry Cooler",
    );
  });

  test("requires an ingredient-specific explanation without certification claims", () => {
    expect(BEVERAGE_DIET_FIT_EXPLANATION_INSTRUCTION).toMatch(
      /active dietary identity/i,
    );
    expect(BEVERAGE_DIET_FIT_EXPLANATION_INSTRUCTION).toMatch(
      /actual ingredients and mixers/i,
    );
    expect(BEVERAGE_DIET_FIT_EXPLANATION_INSTRUCTION).toMatch(
      /substitutions, exclusions, and preparation choices/i,
    );
    expect(BEVERAGE_DIET_FIT_EXPLANATION_INSTRUCTION).toMatch(
      /never claim certification/i,
    );
  });
});