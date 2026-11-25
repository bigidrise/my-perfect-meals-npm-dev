import { convertToUserFriendlyUnits } from "../utils/unitConverter";

describe("Stable meal ingredient measurement integrity", () => {
  it.each([
    ["salt", 0.125],
    ["paprika", 0.5],
    ["cumin", 1.25],
    ["olive oil", 3.75],
    ["rice", 73.25],
    ["chicken breast", 123.5],
    ["arroz", 73.25],
    ["aceite de oliva", 3.75]
  ])("preserves %s at %s grams", (name, amount) => {
    const original = { name, amount, unit: "g", notes: "" };
    const [result] = convertToUserFriendlyUnits([original]);

    expect(result.amount).toBe(amount);
    expect(result.unit).toBe("g");
    expect(result.name).toBe(name);
  });

  it("preserves ingredient preparation notes", () => {
    const [result] = convertToUserFriendlyUnits([
      { name: "rice", amount: 73.25, unit: "g", notes: "cooked" }
    ]);

    expect(result.notes).toBe("cooked");
  });

  it.each([
    ["0.125g salt"],
    ["3.75g olive oil"],
    ["73.25g rice"],
    ["12.5ml water"],
    ["0.5ml vanilla extract"]
  ])("preserves explicit metric measurement %s", input => {
    expect(convertToUserFriendlyUnits(input)).toBe(input);
  });

  it("does not substitute an approximate chicken portion", () => {
    const [result] = convertToUserFriendlyUnits([
      { name: "chicken breast", amount: 150, unit: "g", notes: "" }
    ]);

    expect(result).toMatchObject({ amount: 150, unit: "g" });
    expect((result as any).displayText || "").not.toContain("5 oz");
  });
});
