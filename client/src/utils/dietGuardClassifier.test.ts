import { detectDietConflicts } from "./dietGuardClassifier";

describe("diet guard food-intent semantics", () => {
  it.each([
    "Strawberry vegan ice cream",
    "Chinese strawberry vegan ice cream",
    "Strawberry ice cream with coconut milk",
    "Strawberry ice cream with oat milk and cashew cream",
    "Peanut butter ice cream with almond milk",
  ])("does not classify a compatible compound food request as non-vegan: %s", (request) => {
    expect(detectDietConflicts(request, "vegan")).toMatchObject({
      hasConflict: false,
      matchedTerms: [],
    });
  });

  it("still identifies actual heavy cream when no dietary qualifier overrides preflight", () => {
    const result = detectDietConflicts(
      "Strawberry ice cream made with heavy cream",
      "vegan",
    );

    expect(result.hasConflict).toBe(true);
    expect(result.matchedTerms).toEqual(
      expect.arrayContaining(["cream", "heavy cream"]),
    );
  });
});