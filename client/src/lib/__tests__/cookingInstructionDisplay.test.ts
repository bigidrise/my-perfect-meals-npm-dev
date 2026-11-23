import { formatCookingInstruction } from "@/lib/cookingInstructionDisplay";

const format = formatCookingInstruction;

describe("cooking instruction measurement display", () => {
  test("converts olive oil using the recipe ingredient quantity", () => {
    expect(format(
      "Heat 1 tbsp of olive oil in a skillet.",
      [{ quantity: 1, unit: "tbsp", name: "olive oil" }],
      "metric", "en",
    )).toBe("Heat 15 mL of olive oil in a skillet.");
  });

  test("preserves practical solid-food and seasoning measures", () => {
    expect(format(
      "Add ½ cup of mushrooms and ¼ tsp salt.",
      [
        { quantity: "1/2", unit: "cup", name: "mushrooms" },
        { quantity: "1/4", unit: "tsp", name: "salt" },
      ],
      "metric", "en",
    )).toBe("Add ½ cup of mushrooms and ¼ tsp salt.");
  });

  test("converts chicken weight without estimating ingredient density", () => {
    expect(format(
      "Add 4 oz chicken breast.",
      [{ quantity: 4, unit: "oz", name: "chicken breast" }],
      "metric", "en",
    )).toBe("Add 113 g chicken breast.");
  });

  test("supports Spanish liquid measurements", () => {
    expect(format(
      "Calienta 1 cucharada de aceite de oliva.",
      [{ quantity: 1, unit: "cucharada", name: "aceite de oliva" }],
      "metric", "es",
    )).toBe("Calienta 15 mL de aceite de oliva.");
  });

  test("supports legacy string ingredients", () => {
    expect(format(
      "Heat 1 tbsp of olive oil.",
      ["1 tbsp olive oil"],
      "metric", "en",
    )).toBe("Heat 15 mL of olive oil.");
  });

  test("leaves unmatched quantities, cooking times and temperatures unchanged", () => {
    const instruction = "Bake at 350°F for 20 minutes, then add 2 tbsp of oil.";
    expect(format(
      instruction,
      [{ quantity: 1, unit: "tbsp", name: "olive oil" }],
      "metric", "en",
    )).toBe(instruction);
  });

  test("does not mutate stored recipe data", () => {
    const ingredients = Object.freeze([
      Object.freeze({ quantity: 1, unit: "tbsp", name: "olive oil" }),
    ]);
    const instruction = "Heat 1 tbsp of olive oil.";
    format(instruction, ingredients, "metric", "en");
    expect(instruction).toBe("Heat 1 tbsp of olive oil.");
    expect(ingredients[0].quantity).toBe(1);
  });
});
