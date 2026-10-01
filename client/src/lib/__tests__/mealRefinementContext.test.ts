import { mealRefinementContextPayload } from "../mealRefinementContext";

describe("meal refinement subject transport", () => {
  it("passes the explicit diabetic builder and patient subject", () => {
    expect(mealRefinementContextPayload("diabetic", "patient-1")).toEqual({
      builderType: "diabetic",
      proClientId: "patient-1",
    });
  });

  it("keeps existing defaults when no patient subject is provided", () => {
    expect(mealRefinementContextPayload()).toEqual({});
    expect(mealRefinementContextPayload("weekly")).toEqual({
      builderType: "weekly",
    });
  });
});