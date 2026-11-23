import { normalizeInstructions } from "../../utils/normalizeInstructions";

describe("normalizeInstructions", () => {
  it("preserves numbered recipe steps", () => {
    expect(normalizeInstructions(
      "1. Preheat oven to 350°F. 2. Bake for 20 minutes."
    )).toEqual([
      "Preheat oven to 350°F.",
      "Bake for 20 minutes.",
    ]);
  });

  it("does not split decimal cooking temperatures", () => {
    expect(normalizeInstructions("Cook until 73.9°C")).toEqual([
      "Cook until 73.9°C",
    ]);
  });

  it("preserves decimals while separating sentences", () => {
    expect(normalizeInstructions(
      "Cook until 73.9°C. Serve immediately."
    )).toEqual([
      "Cook until 73.9°C.",
      "Serve immediately.",
    ]);
  });
});
