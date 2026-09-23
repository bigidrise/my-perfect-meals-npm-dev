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
  });

  it("does not accept a missing numeric macro or a three-option response", async () => {
    create.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ ...valid, calories: null }) } }],
    });
    await expect(generateMenuRecipe({ concept, authorityPrompt: "", cuisine: null })).rejects.toThrow();
    create.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ options: [valid, valid, valid] }) } }],
    });
    await expect(generateMenuRecipe({ concept, authorityPrompt: "", cuisine: null })).rejects.toThrow();
  });
});