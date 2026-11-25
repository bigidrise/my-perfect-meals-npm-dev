import fs from "node:fs";

describe("GLP-1 creator fallback contracts", () => {
  const source = fs.readFileSync("server/services/unifiedMealPipeline.ts", "utf8");

  it("does not manufacture nutrition for Create with Chef", () => {
    expect(source).not.toContain('name: "Lean Turkey and Steamed Vegetable Plate"');
    expect(source).not.toContain("Math.max(glp1Targets.targetProteinGrams, 35)");
    expect(source).not.toContain("Math.min(glp1Targets.maximumToleratedFatGrams, 2)");
  });

  it("does not manufacture nutrition for Snack Creator", () => {
    expect(source).not.toContain('name: "Strawberry Egg White Protein Cup"');
    expect(source).not.toContain("Math.max(Math.round(glp1Targets.minimumProteinFloor * 0.5), 26)");
  });

  it("fails closed when clinical fallback nutrition is unavailable", () => {
    const matches = source.match(
      /if \(glp1Targets\) \{\s*return unavailableTemplateResponse\(preferredLanguage\);\s*\}/g
    );
    expect(matches).toHaveLength(2);
  });

  it("provides English and Spanish nutrition verification messages", () => {
    expect(source).toContain("We could not verify the nutrition of an alternative recipe.");
    expect(source).toContain("No pudimos verificar la información nutricional de una receta alternativa.");
  });

  it("keeps full protocol scans on both fallback paths", () => {
    expect(source).toContain("scanGeneratedOutput(fallbackMeal, _chefFallbackEnvelope");
    expect(source).toContain("scanGeneratedOutput(fallbackSnack, _snackFallbackEnvelope");
  });
});
