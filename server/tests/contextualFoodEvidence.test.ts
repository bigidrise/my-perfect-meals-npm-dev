jest.mock("openai", () => ({ __esModule: true, default: jest.fn() }));

import OpenAI from "openai";
import type { HumanFoodCandidate } from "@shared/humanFoodValidation";
import { resolveContextualFoodEvidence } from "../services/foodAdaptation/contextualFoodEvidence";
import { evaluateLowCarbSourceEvidence } from "../services/foodAdaptation/lowCarbPolicy";

const create = jest.fn();
const recipe = (ingredients: Array<{ name: string; quantity: string; unit: string }>): HumanFoodCandidate => ({
  name: "Chocolate Cheesecake",
  description: "A sliceable chocolate cheesecake.",
  instructions: "Blend and bake until set, then chill.",
  ingredients,
  nutrition: { calories: 350, protein: 12, carbs: 14, starchyCarbs: 0, fat: 25 },
});
const answer = (decisions: unknown[]) => ({ choices: [{ message: { content: JSON.stringify({ decisions }) } }] });
const decision = (ingredient: string, category: string, role: string, identity = "single_source") =>
  ({ ingredient, category, role, identity, reason: "This ingredient has a stated culinary role in this recipe." });

beforeAll(() => {
  process.env.OPENAI_API_KEY ||= "context-test-placeholder";
  (OpenAI as unknown as jest.Mock).mockImplementation(() => ({ chat: { completions: { create } } }));
});
beforeEach(() => create.mockReset());

describe("bounded contextual Low Carb food evidence", () => {
  it("does not call AI for known zucchini noodles, cauliflower rice or added sugar", async () => {
    expect(await resolveContextualFoodEvidence(recipe([
      { name: "zucchini noodles", quantity: "1", unit: "cup" },
      { name: "cauliflower rice", quantity: "1", unit: "cup" },
      { name: "brown sugar", quantity: "1", unit: "tsp" },
    ]))).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it("resolves a measured condiment flavoring by its established grocery role and amount without AI", async () => {
    const candidate = recipe([
      { name: "cream cheese", quantity: "3", unit: "oz" },
      { name: "vanilla extract", quantity: "1/2", unit: "tsp" },
    ]);
    const decisions = await resolveContextualFoodEvidence(candidate);
    expect(decisions).toMatchObject([{ ingredient: "vanilla extract", category: "nonmaterial" }]);
    expect(create).not.toHaveBeenCalled();
    expect(evaluateLowCarbSourceEvidence(candidate.ingredients, candidate.nutrition, decisions).status)
      .toBe("pass");
  });

  it("batches unknowns and admits tiny vanilla flavoring and contextual almond source, not an unknown sweetener", async () => {
    const candidate = recipe([
      { name: "cream cheese", quantity: "3", unit: "oz" },
      { name: "vanilla extract", quantity: "1/2", unit: "tsp" },
      { name: "almond flour", quantity: "1/4", unit: "cup" },
      { name: "powdered erythritol", quantity: "2", unit: "tbsp" },
    ]);
    create.mockResolvedValue(answer([
      decision("almond flour", "whole_plant_fat", "structural"),
      decision("powdered erythritol", "nonmaterial", "sweetener"),
    ]));
    const decisions = await resolveContextualFoodEvidence(candidate);
    expect(create).toHaveBeenCalledTimes(1);
    expect(decisions.map((d) => d.ingredient)).toEqual(["vanilla extract", "almond flour"]);
    expect(evaluateLowCarbSourceEvidence(candidate.ingredients, candidate.nutrition, decisions))
      .toMatchObject({ status: "review_required" });
    expect(create.mock.calls[0][0].messages[0].content).not.toContain('"ingredient":"cream cheese"');
  });

  it("rejects model attempts to invent packaged composition or excuse material unknowns", async () => {
    const candidate = recipe([
      { name: "mystery baking mix", quantity: "1/2", unit: "cup" },
      { name: "vanilla extract", quantity: "1/4", unit: "cup" },
    ]);
    create.mockResolvedValue(answer([
      decision("mystery baking mix", "non_starchy_fibrous", "structural"),
      decision("vanilla extract", "nonmaterial", "flavoring"),
    ]));
    expect(await resolveContextualFoodEvidence(candidate)).toEqual([]);
    expect(evaluateLowCarbSourceEvidence(candidate.ingredients, candidate.nutrition).status)
      .toBe("review_required");
  });

  it("rejects missing and mismatched decisions rather than treating a partial model answer as proof", async () => {
    const candidate = recipe([
      { name: "unsweetened cocoa powder", quantity: "2", unit: "tsp" },
      { name: "almond flour", quantity: "1/4", unit: "cup" },
    ]);
    create.mockResolvedValue(answer([decision("unsweetened cocoa powder", "non_starchy_fibrous", "structural")]));
    expect(await resolveContextualFoodEvidence(candidate)).toEqual([]);
  });

  it("retains canonical sugar and unverified packaged sauce blocks even with contextual claims", () => {
    expect(evaluateLowCarbSourceEvidence(
      ["brown sugar", "bottled sauce"],
      recipe([]).nutrition,
      [decision("brown sugar", "nonmaterial", "flavoring"),
        decision("bottled sauce", "nonmaterial", "flavoring")],
    ).status).toBe("review_required");
  });
});