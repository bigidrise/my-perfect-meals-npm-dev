import {
  verifyGeneratedIngredient,
  verifyGeneratedIngredients
} from "../services/generatedIngredientAdapter";

describe("Shared generated ingredient adapter integrity", () => {
  it.each([
    ["1/2 cup rice", "rice", 0.5, "cup"],
    ["1 1/2 cups rice", "rice", 1.5, "cup"],
    ["0,5 taza de arroz", "arroz", 0.5, "cup"],
    ["100 gramos de arroz", "arroz", 100, "g"],
    ["1 fl oz milk", "milk", 1, "fl oz"]
  ])("preserves explicit legacy string %s", (input, name, quantity, unit) => {
    expect(verifyGeneratedIngredients([input])).toEqual([
      { name, quantity, unit }
    ]);
  });

  it("preserves explicitly measured object maps", () => {
    expect(verifyGeneratedIngredients({
      rice: "1/2 cup",
      chicken: "100 g"
    })).toEqual([
      { name: "rice", quantity: 0.5, unit: "cup" },
      { name: "chicken", quantity: 100, unit: "g" }
    ]);
  });

  it("preserves explicitly measured multiline ingredients", () => {
    expect(verifyGeneratedIngredients(
      "100 g rice\n200 g chicken"
    )).toEqual([
      { name: "rice", quantity: 100, unit: "g" },
      { name: "chicken", quantity: 200, unit: "g" }
    ]);
  });

  it("preserves explicit legacy ounces", () => {
    expect(verifyGeneratedIngredient({
      name: "chicken", amountOz: 4
    })).toEqual({
      name: "chicken", quantity: 4, unit: "oz"
    });
  });

  it("rejects conflicting legacy ounce quantities", () => {
    expect(verifyGeneratedIngredient({
      name: "chicken", amountOz: 4, amount: "6 oz"
    })).toBeNull();
  });

  it("rejects conflicting legacy ounce units", () => {
    expect(verifyGeneratedIngredient({
      name: "chicken", amountOz: 4, unit: "g"
    })).toBeNull();
  });

  it("rejects conflicting ingredient identities", () => {
    expect(verifyGeneratedIngredient({
      name: "chicken", item: "shrimp", amount: "100 g"
    })).toBeNull();
  });

  it("accepts equivalent singular and plural clove units", () => {
    expect(verifyGeneratedIngredient({
      name: "garlic", amount: "2 cloves", unit: "clove"
    })).toEqual({
      name: "garlic", quantity: 2, unit: "clove"
    });
  });

  it("accepts equivalent singular and plural scoop units", () => {
    expect(verifyGeneratedIngredient({
      name: "protein powder", amount: "2 scoops", unit: "scoop"
    })).toEqual({
      name: "protein powder", quantity: 2, unit: "scoop"
    });
  });

  it.each([
    "rice",
    "1 rice",
    "1 handful rice",
    "1/0 cup rice",
    "-1 cup rice",
    "0 cup rice"
  ])("rejects ambiguous or invalid legacy string %s", input => {
    expect(verifyGeneratedIngredients([input])).toBeNull();
  });

  it("rejects an object map without explicit units", () => {
    expect(verifyGeneratedIngredients({ rice: 100 })).toBeNull();
  });

  it("rejects a partially invalid ingredient collection", () => {
    expect(verifyGeneratedIngredients([
      "100 g rice",
      "handful chicken"
    ])).toBeNull();
  });
});

describe("Generated measurement serialization integrity", () => {
  it.each([
    0.0000001,
    0.000000125,
    0.000000001,
    0.125,
    0.249,
    1 / 3,
    1.5
  ])("preserves quantity %s through serialization", quantity => {
    const original = verifyGeneratedIngredient({
      name: "salt", quantity, unit: "g"
    });

    expect(original).not.toBeNull();

    const restored = verifyGeneratedIngredient({
      name: original!.name,
      amount: `${original!.quantity} ${original!.unit}`
    });

    expect(restored).toEqual(original);
  });
});
