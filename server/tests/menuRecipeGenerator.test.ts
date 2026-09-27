jest.mock("openai", () => ({ __esModule: true, default: jest.fn() }));

import OpenAI from "openai";
import type { OneTouchDirection } from "@shared/oneTouch";
import { generateMenuRecipe } from "../services/oneTouch/menuRecipeGenerator";

const create = jest.fn();
const concept = {
  title: "Tomato Lentil Stew",
  description: "A savory stew",
  primaryIngredients: ["lentils", "tomatoes"],
  preparationMethod: "simmered",
  culinaryIdentity: { dishForm: "stew" },
  cuisine: "Mediterranean",
} as OneTouchDirection;
const valid = {
  name: concept.title, description: "A tomato and lentil stew.",
  ingredients: [{ name: "lentils", quantity: "1/2", unit: "cup" },
    { name: "tomatoes", quantity: "1", unit: "cup" }],
  instructions: "Simmer the lentils and tomatoes until fully cooked.",
  calories: 300, protein: 20, starchyCarbs: 25, fibrousCarbs: 10, fat: 5,
  cookingTime: "30 minutes",
};

beforeAll(() => {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "menu-test-placeholder";
  (OpenAI as unknown as jest.Mock).mockImplementation(() => ({
    chat: { completions: { create } },
  }));
});

beforeEach(() => create.mockReset());

describe("isolated Menu recipe generator", () => {
  it("asks for exactly one complete recipe rather than an options array", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(valid) } }] });
    expect(await generateMenuRecipe({ concept, authorityPrompt: "Protocol rules", cuisine: null }))
      .toMatchObject({ name: concept.title });
    expect(create).toHaveBeenCalledTimes(1);
    const request = create.mock.calls[0][0];
    expect(request.messages[0].content).toContain("exactly ONE");
    expect(request.messages[0].content).toContain("Protocol rules");
    expect(request.messages[0].content).toContain("lentils, tomatoes");
    expect(request.messages[0].content).toContain("cauliflower rice or zucchini noodles");
    expect(request.messages[0].content).toContain("NOT dietary-fiber grams");
  });

  it("preserves the selected dessert identity rather than treating snack as the dish", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(valid) } }] });
    await generateMenuRecipe({
      concept: { ...concept, title: "Chocolate Cake", foodIdentity: {
        foodRole: "dessert", polarity: "sweet", formatFamily: "cake",
      } }, authorityPrompt: "Vegan and allergy protections", cuisine: null,
    });
    expect(create.mock.calls[0][0].messages[0].content).toContain("dessert (cake)");
    expect(create.mock.calls[0][0].messages[0].content).toContain("Vegan and allergy protections");
    expect(create.mock.calls[0][0].messages[0].content).toContain("NOT permission to substitute");
  });

  it("guides Low Carb completion to explicit source evidence without changing the dish", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(valid) } }] });
    await generateMenuRecipe({
      concept, authorityPrompt: "No shellfish", cuisine: null, lowCarbSourceGuidance: true,
    });
    const prompt = create.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain("LOW CARB RECIPE STRUCTURE");
    expect(prompt).toContain("actual complete components");
    expect(prompt).toContain("Keep the selected dish");
    expect(prompt).toContain("No shellfish");
  });

  it("retries malformed JSON once, preserving the approved concept and food protections", async () => {
    create.mockResolvedValueOnce({ choices: [{ message: { content: '{"name":' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(valid) } }] });
    expect(await generateMenuRecipe({ concept, authorityPrompt: "No shellfish", cuisine: null }))
      .toMatchObject({ name: concept.title });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].messages[0].content).toContain("No shellfish");
    expect(create.mock.calls[1][0].messages[0].content).toContain("did not match the required JSON");
  });

  it("accepts harmless extra metadata but never fills missing required nutrition", async () => {
    create.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ ...valid, servings: 1 }) } }],
    });
    expect(await generateMenuRecipe({ concept, authorityPrompt: "", cuisine: null }))
      .toEqual(valid);
  });

  it("does not accept a missing numeric macro or a three-option response", async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ ...valid, calories: null }) } }],
    });
    await expect(generateMenuRecipe({ concept, authorityPrompt: "", cuisine: null })).rejects.toThrow();
    create.mockReset().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ options: [valid, valid, valid] }) } }],
    });
    await expect(generateMenuRecipe({ concept, authorityPrompt: "", cuisine: null })).rejects.toThrow();
    expect(create).toHaveBeenCalledTimes(2);
  });
});