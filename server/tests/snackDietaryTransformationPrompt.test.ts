import fs from "fs";
import path from "path";

describe("Snack Creator dietary transformation contract", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "server/services/unifiedMealPipeline.ts"),
    "utf8",
  );
  const snackCreator = source.slice(
    source.indexOf("SNACK PRODUCT DEFINITION:"),
    source.indexOf("SNACK_MAX_REGENERATION_ATTEMPTS"),
  );

  it("preserves named food identity while transforming incompatible ingredients", () => {
    expect(snackCreator).toContain("Preserve the requested food identity");
    expect(snackCreator).toContain(
      "Every ingredient, description, and instruction must comply",
    );
  });

  it("does not seed the generator with animal dairy examples", () => {
    expect(snackCreator).not.toContain("Greek yogurt");
    expect(snackCreator).not.toContain("cottage cheese");
    expect(snackCreator).toContain("coconut yogurt");
  });

  it("does not impose legacy universal calorie, protein, fiber, or shrinking assumptions", () => {
    expect(snackCreator).not.toContain("100-300");
    expect(snackCreator).not.toContain("empty carbs");
    expect(snackCreator).not.toContain("Prioritize protein and fiber");
    expect(snackCreator).toContain("Do not equate healthier with smaller");
  });

  it("carries authoritative context through dispatch and fails explicitly for protected identities", () => {
    expect(source).toContain("request.protocolEnvelope, request.generationContext");
    expect(source).toContain("if (protectedIdentity)");
    expect(source).toContain("without changing it into a different food");
  });
});