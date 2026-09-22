import { resolveNutritionSummaryCardData } from "@/lib/nutritionSummaryDisplay";

describe("Nutrition summary card subject isolation", () => {
  const selfSummary = { subject: "professional-self" };
  const clientSummary = { subject: "client-a" };

  it("never falls back to the professional's self summary in controlled client mode", () => {
    expect(resolveNutritionSummaryCardData("provided", null, selfSummary)).toBeNull();
    expect(resolveNutritionSummaryCardData("provided", undefined, selfSummary)).toBeUndefined();
  });

  it("renders only the explicitly provided client summary in controlled mode", () => {
    expect(resolveNutritionSummaryCardData("provided", clientSummary, selfSummary))
      .toBe(clientSummary);
  });

  it("preserves the customer self-summary behavior", () => {
    expect(resolveNutritionSummaryCardData("self", undefined, selfSummary))
      .toBe(selfSummary);
  });
});