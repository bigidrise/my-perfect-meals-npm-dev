import fs from "node:fs";

describe("GLP-1 creator fallback contracts", () => {
  const source = fs.readFileSync("server/services/unifiedMealPipeline.ts", "utf8");

  it("uses a low-fat high-protein fallback for Create with Chef", () => {
    expect(source).toContain('name: "Lean Turkey and Steamed Vegetable Plate"');
    expect(source).toContain("Math.max(glp1Targets.targetProteinGrams, 35)");
    expect(source).toContain("Math.min(glp1Targets.maximumToleratedFatGrams, 2)");
  });

  it("uses a zero-fat high-protein fallback for Snack Creator", () => {
    expect(source).toContain('name: "Strawberry Egg White Protein Cup"');
    expect(source).toContain("Math.max(Math.round(glp1Targets.minimumProteinFloor * 0.5), 26)");
    expect(source).toContain("fat: 0");
  });

  it("keeps full protocol scans on both fallback paths", () => {
    expect(source).toContain("scanGeneratedOutput(fallbackMeal, _chefFallbackEnvelope");
    expect(source).toContain("scanGeneratedOutput(fallbackSnack, _snackFallbackEnvelope");
  });
});