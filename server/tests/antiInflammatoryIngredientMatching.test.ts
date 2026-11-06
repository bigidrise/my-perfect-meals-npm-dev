jest.mock("../db", () => ({
  pool: { query: jest.fn(() => { throw new Error("Live database access forbidden in ingredient fixtures"); }) },
  db: {},
}));

import {
  antiInflammatoryRules, isBlockedIngredient, filterBlockedIngredients,
} from "../services/guardrails/rules/antiInflammatoryRules";
import { validateAntiInflammatoryMeal } from "../services/guardrails/validators/antiInflammatoryValidator";
import { optionalAntiInflammatoryViolations } from "../services/healthProtocols/antiInflammatorySupportValidation";
import { buildGuestEnvelope, scanGeneratedOutput, filterMealsByProtocol } from "../services/protocolEnvelope";
import { validateMealForDiet } from "../services/guardrails";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const food = (ingredient: string) => ({
  name: "Roasted vegetable bowl",
  ingredients: [{ name: ingredient }, { name: "broccoli" }, { name: "olive oil" }],
  instructions: ["Roast and serve."],
});

describe("complete Anti-Inflammatory food concepts, not bidirectional fragments", () => {
  it.each([
    "onion", "onions", "red onion, diced", "onion powder", "corn", "corn kernels",
    "potato", "potatoes", "chicken", "chicken breast", "fish", "salmon",
    "chamomile", "graham flour", "chipotle pepper", "brown rice",
    "whole wheat flour", "olive oil", "coconut cream",
  ])("does not confuse a whole ingredient with a prohibited prepared food: %s", ingredient => {
    expect(isBlockedIngredient(ingredient)).toBe(false);
    expect(validateAntiInflammatoryMeal(food(ingredient)).isValid).toBe(true);
    expect(optionalAntiInflammatoryViolations(food(ingredient), true)).toEqual([]);
  });

  it.each([
    "onion rings", "fried onion rings", "onion ring", "ONION—RINGS (frozen)",
    "onions (rings), breaded", "onionrings", "onion\u200brings", "rings of onions",
    "onion rings with olive oil", "non-fried onion rings", "onion-ring-free coating",
    "chicken, fried", "fish, fried", "potato chip", "French fry", "fries",
    "hotdogs", "doughnuts", "pastries", "muffins", "sausages", "cookies",
    "rapeseed oil", "maize oil", "all purpose flour", "cream-cheese",
  ])("retains prohibited food evidence across aliases and descriptions: %s", ingredient => {
    expect(isBlockedIngredient(ingredient)).toBe(true);
    expect(validateAntiInflammatoryMeal(food(ingredient)).isValid).toBe(false);
    expect(optionalAntiInflammatoryViolations(food(ingredient), true).length).toBeGreaterThan(0);
  });

  it.each(antiInflammatoryRules.blockedIngredients)("keeps every existing prohibited item blocked: %s", ingredient => {
    expect(isBlockedIngredient(ingredient)).toBe(true);
  });

  it("does not let an empty name or ambiguous unqualified material certify compliance", () => {
    expect(isBlockedIngredient(" \u200b ")).toBe(true);
    expect(optionalAntiInflammatoryViolations({ ingredients: [" "] }, true).length).toBeGreaterThan(0);
    for (const name of ["oil", "rice", "flour", "sugar", "cream", "cheese", "bread", "pasta"]) {
      expect(isBlockedIngredient(name)).toBe(true);
    }
    expect(filterBlockedIngredients(["onion", "onion rings", "onion powder"]))
      .toEqual({ allowed: ["onion", "onion powder"], blocked: ["onion rings"] });
  });

  it("keeps nullable saved-grocery ingredients fail-closed when support is active", () => {
    expect(optionalAntiInflammatoryViolations({ ingredients: null }, true)).toEqual([
      "Ingredient details are required to verify optional Anti-Inflammatory support.",
    ]);
    expect(optionalAntiInflammatoryViolations({ ingredients: null }, false)).toEqual([]);
  });
});

describe("actual generation final scan and Menu protocol-filter consumers", () => {
  const envelope = { ...buildGuestEnvelope(), personalAntiInflammatorySupport: true };

  it.each(["onion", "onion powder", "corn", "chicken breast"])(
    "allows the safe ingredient in the real final scan and keeps it in Menu: %s", ingredient => {
      const meal = food(ingredient);
      expect(scanGeneratedOutput(meal, envelope).passed).toBe(true);
      expect(filterMealsByProtocol([meal], envelope, { generatorName: "my-perfect-menu" })).toEqual([meal]);
    },
  );

  it.each(["onion rings", "fried onion rings", "canola oil", "white flour", "bacon"])(
    "rejects the prohibited ingredient at final output and removes only the unsafe Menu option: %s", ingredient => {
      const safe = food("onion");
      const unsafe = food(ingredient);
      expect(scanGeneratedOutput(unsafe, envelope).passed).toBe(false);
      expect(filterMealsByProtocol([unsafe, safe], envelope, { generatorName: "my-perfect-menu" })).toEqual([safe]);
    },
  );

  it("does not waive allergies or saved dietary identity to permit an ingredient", () => {
    expect(scanGeneratedOutput(food("peanuts"), { ...envelope, allergies: ["peanuts"] }).passed).toBe(false);
    expect(scanGeneratedOutput(food("chicken breast"), { ...envelope, dietaryIdentity: ["vegan"] }).passed).toBe(false);
    expect(scanGeneratedOutput(food("salmon"), { ...envelope, dietaryIdentity: ["vegetarian"] }).passed).toBe(false);
    expect(scanGeneratedOutput(food("chicken breast"), { ...envelope, dietaryIdentity: ["pescatarian"] }).passed).toBe(false);
  });

  it("still inspects prohibited cooking instructions", () => {
    expect(scanGeneratedOutput({ ...food("onion"), instructions: ["Deep-fry in canola oil."] }, envelope).passed).toBe(false);
  });

  it("does not waive current GLP-1 clinical fat restrictions for an otherwise safe onion meal", () => {
    const meal = {
      ...food("onion"),
      ingredients: [
        { name: "onion", quantity: "20", unit: "g" },
        { name: "broccoli", quantity: "100", unit: "g" },
        { name: "olive oil", quantity: "40", unit: "g" },
      ],
      macros: { calories: 500, protein: 30, fat: 40, carbs: 10 },
    };
    expect(validateMealForDiet(meal, "anti-inflammatory").isValid).toBe(true);
    const clinical = validateMealForDiet(meal, "anti-inflammatory", undefined, false, {
      maximumToleratedFatGrams: 12, resolvedMealCalories: 350,
      targetProteinGrams: 25, treatmentPhase: "active",
    } as any);
    expect(clinical.isValid).toBe(false);
    expect(clinical.violations.some(message => /fat/i.test(message))).toBe(true);
  });

  it("exercises the same final-scan functions wired into Chef and My Perfect Menu", () => {
    const pipeline = readFileSync("server/services/unifiedMealPipeline.ts", "utf8");
    expect(pipeline).toContain("const chefScan = scanGeneratedOutput(");
    const menu = readFileSync("server/routes/myPerfectMenu.ts", "utf8");
    expect(menu).toContain("scanGeneratedOutput(conceptMeal(concept), envelope");
  });

  it("passes the actual My Perfect Menu concept adapter into the real final scan", () => {
    const source = ts.createSourceFile("myPerfectMenu.ts",
      readFileSync("server/routes/myPerfectMenu.ts", "utf8"), ts.ScriptTarget.Latest, true);
    const adapter = source.statements.find(node =>
      ts.isFunctionDeclaration(node) && node.name?.text === "conceptMeal");
    if (!adapter) throw new Error("Actual My Perfect Menu concept adapter not found");
    const module = { exports: undefined as any };
    vm.runInNewContext(ts.transpileModule(`module.exports = (${adapter.getText(source)});`, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { module }, { timeout: 1500 });
    const concept = {
      title: "Roasted vegetable bowl", description: "A vegetable bowl",
      primaryIngredients: ["onion", "broccoli", "olive oil"], preparationMethod: "roasting",
    };
    expect(scanGeneratedOutput(module.exports(concept), envelope).passed).toBe(true);
    expect(scanGeneratedOutput(module.exports({
      ...concept, primaryIngredients: ["onion rings", "broccoli", "olive oil"],
    }), envelope).passed).toBe(false);
  });
});
