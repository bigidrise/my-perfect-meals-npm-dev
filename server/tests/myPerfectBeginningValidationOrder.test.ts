import fs from "node:fs";
import path from "node:path";

describe("My Perfect Beginnings final validation order", () => {
  test("validates the pediatric-patched recipe before image generation and response", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "server/routes/my-perfect-beginning.ts"),
      "utf8",
    );
    const patchIndex = source.indexOf("const finalRecipe = postScan.patchedRecipe ?? recipe");
    const validationIndex = source.indexOf("const universalValidation = validateHumanFoodCandidate");
    const imageIndex = source.indexOf("let recipeImageUrl: string | null = null");
    const responseIndex = source.indexOf("return res.json({", validationIndex);

    expect(patchIndex).toBeGreaterThan(-1);
    expect(validationIndex).toBeGreaterThan(patchIndex);
    expect(imageIndex).toBeGreaterThan(validationIndex);
    expect(responseIndex).toBeGreaterThan(validationIndex);
  });

  test("answers pediatric Nutrition Priority questions after ownership verification and before the LLM", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "server/routes/myPerfectBeginning.ts"),
      "utf8",
    );
    const routeIndex = source.indexOf('router.post("/parents-corner"');
    const ownershipIndex = source.indexOf(
      "await loadOwnedActiveChildProfile",
      routeIndex,
    );
    const deterministicAnswerIndex = source.indexOf(
      "answerNutritionPriorityEducationQuestion",
      ownershipIndex,
    );
    const responseIndex = source.indexOf(
      "return res.json({",
      deterministicAnswerIndex,
    );
    const modelIndex = source.indexOf("const openai = getOpenAI()", routeIndex);

    expect(routeIndex).toBeGreaterThan(-1);
    expect(ownershipIndex).toBeGreaterThan(routeIndex);
    expect(deterministicAnswerIndex).toBeGreaterThan(ownershipIndex);
    expect(responseIndex).toBeGreaterThan(deterministicAnswerIndex);
    expect(modelIndex).toBeGreaterThan(responseIndex);
  });
});