import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import {
  filterPreparedMealResponse, RECIPE_PREPARATION_GUIDANCE, validateRecipePreparation,
} from "../services/recipePreparationValidator";

// Execute the saved release wrappers without importing their DB, images or
// provider graph. Their actual bodies (not rewritten equivalents) run here.
const source = fs.readFileSync("server/services/unifiedMealPipeline.ts", "utf8");
const ast = ts.createSourceFile("pipeline.ts", source, ts.ScriptTarget.Latest, true);
function wrapper(name: string, context: Record<string, unknown>) {
  const declaration = ast.statements.find(node =>
    ts.isFunctionDeclaration(node) && node.name?.text === name)!;
  const compiled = ts.transpileModule(declaration.getText(ast).replace("export ", ""), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return vm.runInNewContext(`${compiled}\n${name}`, {
    console: { log() {}, warn() {} }, filterPreparedMealResponse, ...context,
  });
}
const invalid = { name: "Lentil salad", ingredients: [{ name: "dried lentils", quantity: "1", unit: "cup" }], instructions: "Add cooked lentils to salad." };
const valid = { ...invalid, ingredients: [{ name: "canned lentils", quantity: "1", unit: "cup" }] };

describe("actual unified recipe-release wrappers with isolated generators", () => {
  it("feeds preparation failures into the existing variety retry without another validator model call", async () => {
    let attemptNode: ts.VariableDeclaration | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "attempt") attemptNode = node;
      if (!attemptNode) ts.forEachChild(node, visit);
    };
    visit(ast);
    const compiled = ts.transpileModule(`const attempt = ${attemptNode!.initializer!.getText(ast)};`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const create = jest.fn()
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify([invalid, valid]) } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify([valid]) } }] });
    const context = vm.createContext({
      refillSignal: undefined, refillModelCalls: 0, preparationIssues: [],
      isRecipeMode: false, cravingInput: "lentil salad", validMealType: "lunch",
      category: "meal", dishFamily: "salad", dietBlock: "", dietRestrictions: [], excludeClause: "",
      allergyBlock: "", strictMode: false, avoidanceBlock: "", cuisineGroundingBlock: "",
      varietyMeasurementSystem: "us", createDishContract: undefined, cravingSelection: undefined,
      dishDirective: undefined, varietyLanguageInstruction: "", specialtyMedicalBlock: "",
      proceduralBlock: "", fastMode: false,
      buildVarietyPrompt: () => "Lentil salad within current protections.",
      parseVarietyContent: JSON.parse, validateRecipePreparation, RECIPE_PREPARATION_GUIDANCE,
      openai: { chat: { completions: { create } } },
    });
    const attempt = vm.runInContext(`${compiled}\nattempt`, context);
    expect(await attempt(false)).toEqual([valid]);
    expect(context.preparationIssues).toEqual(expect.arrayContaining([expect.stringContaining("cooking method")]));
    expect(await attempt(true)).toEqual([valid]);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].messages[0].content).toContain("Correct the previous ingredient-form/preparation issues");
    expect(create.mock.calls[1][0].messages[0].content).toContain("cooking method");
    context.refillSignal = { aborted: true } as any;
    await expect(attempt(true)).rejects.toThrow("time budget");
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("applies the preparation gate to direct craving callers and cached/template results", async () => {
    const internal = jest.fn().mockResolvedValueOnce({ success: true, source: "catalog", meal: invalid })
      .mockResolvedValueOnce({ success: true, source: "ai", meals: [invalid, valid], meal: invalid });
    const generate = wrapper("generateCravingMealUnified", { generateCravingMealUnifiedInternal: internal });
    expect((await generate("lentils", "lunch")).success).toBe(false);
    expect(await generate("lentils", "lunch")).toMatchObject({ success: true, meals: [valid], meal: valid });
    expect(internal).toHaveBeenCalledTimes(2);
  });

  it.each(["craving", "create-with-chef", "snack-creator", "premade"])(
    "rejects preparation-inconsistent %s output at the shared release boundary", async type => {
      const generate = jest.fn().mockResolvedValue({ success: true, source: "ai", meal: invalid });
      const release = wrapper("generateMealUnified", {
        generateCravingMealUnified: generate, generateFromDescriptionUnified: generate,
        generateSnackFromCravingUnified: generate, generateFridgeRescueUnified: generate,
      });
      expect((await release({ type, input: "lentils", mealType: "lunch" })).success).toBe(false);
      expect(generate).toHaveBeenCalledTimes(1);
    },
  );

  it("leaves Fridge Rescue output untouched, as explicitly required", async () => {
    const response = { success: true, source: "ai", meal: invalid };
    const release = wrapper("generateMealUnified", {
      generateFridgeRescueUnified: jest.fn().mockResolvedValue(response),
    });
    expect(await release({ type: "fridge-rescue", input: ["lentils"], mealType: "lunch" })).toBe(response);
  });

  it("preserves source-backed preparation notes when mapping variety options", () => {
    const declaration = ast.statements.find(node =>
      ts.isFunctionDeclaration(node) && node.name?.text === "mapToUnifiedMeal")!.getText(ast);
    expect(declaration).toContain("normalizeIngredients(opt.ingredients || [], true)");
    const normalizer = ast.statements.find(node =>
      ts.isFunctionDeclaration(node) && node.name?.text === "normalizeIngredients")!;
    const compiled = ts.transpileModule(normalizer.getText(ast), {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const normalize = vm.runInNewContext(`${compiled}\nnormalizeIngredients`, {
      normalizeIngredientsToUS: () => [{ name: "lentils", amount: "1", unit: "cup", preparationNote: "canned, drained" }],
    });
    expect(normalize([{}], true)[0].notes).toBe("canned, drained");
    expect(normalize([{}])[0].notes).toBeUndefined(); // Fridge Rescue's default is unchanged.
  });
});
