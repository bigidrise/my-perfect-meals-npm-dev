import { formatQuantity } from "../formatQuantity";
import { formatAmount } from "../../utils/formatAmount";

describe("measurement display precision", () => {
  test.each([
    [0.005, "0.005 tsp"],
    [0.001, "0.001 tsp"],
    [0.249, "0.249 tsp"],
    [0.125, "⅛ tsp"],
    [0.375, "⅜ tsp"],
    [0.625, "⅝ tsp"],
    [0.875, "⅞ tsp"],
    [1.125, "1⅛ tsp"],
    [1.005, "1.005 tsp"],
  ])("preserves quantity %s", (quantity, expected) => {
    expect(formatQuantity(quantity, "tsp")).toBe(expected);
  });

  test.each([
    ["1/2", "0.5"],
    ["1 1/2", "1.5"],
    ["⅛", "0.125"],
    ["0,125", "0.125"],
    [0.005, "0.005"],
    [0.249, "0.249"],
    ["1,000", "1,000"],
    ["2-3", "2-3"],
    ["1/0", "1/0"],
  ])("formats amount %s without losing precision", (quantity, expected) => {
    expect(formatAmount(quantity)).toBe(expected);
  });
});

describe("recipe conversion precision", () => {
  const { convertServingDisplay } = require("@shared/units");

  test.each([
    [7, "ml", "imperial", "1.4 tsp"],
    [20, "ml", "imperial", "1.3333333 tbsp"],
    [22.5, "ml", "imperial", "1.5 tbsp"],
    [270, "ml", "imperial", "1.125 cup"],
    [330, "ml", "imperial", "1.375 cup"],
    [456, "ml", "imperial", "1.9 cup"],
    [0.5, "taza", "metric", "120 ml"],
    [240, "mililitros", "imperial", "1 cup"],
    [1, "cucharada", "metric", "15 ml"],
    [1, "onza", "metric", "28 g"],
    [28.3495, "gramos", "imperial", "1 oz"],
  ])("converts %s %s into %s accurately", (amount, unit, system, expected) => {
    expect(convertServingDisplay(amount, unit, system)).toBe(expected);
  });
});
