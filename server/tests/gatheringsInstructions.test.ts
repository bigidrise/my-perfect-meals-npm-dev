import { normalizeRecipeInstructions } from "../../shared/recipeInstructions";
import { assertRecipeDraft, recipeInstructions, SAFE_RECIPE_FAILURE } from "../../shared/recipeDraftSafety";
import { gatheringsCompletion, gatheringsCourseOutcome } from "../../shared/gatheringsCourseOutcome";
import { parseUniversalRecipeResponse } from "../services/universalRecipeContract";

const steps = ["Preheat the oven to 350 F.", "Bake the apples for 20 minutes."];
const formats = [
  "1. Preheat the oven to 350 F.\n2. Bake the apples for 20 minutes.",
  "  1. Preheat the oven to 350 F.\n    2. Bake the apples for 20 minutes.",
  "1) Preheat the oven to 350 F.\n2) Bake the apples for 20 minutes.",
  "- Preheat the oven to 350 F.\n- Bake the apples for 20 minutes.",
  "• Preheat the oven to 350 F.\n• Bake the apples for 20 minutes.",
  "Step 1: Preheat the oven to 350 F.\nStep 2: Bake the apples for 20 minutes.",
  "1. Preheat the oven to 350 F. 2. Bake the apples for 20 minutes.",
  JSON.stringify(steps),
  JSON.stringify([{ step: 1, text: steps[0] }, { step: 2, instruction: steps[1] }]),
];
const draft = { name: "Baked Apples", description: "Warm baked apples.", ingredients: [{ name: "apples" }] };
const text = (instructions: string, header = "Instructions") =>
  `Meal Name: Baked Apples\nDescription: Warm baked apples.\nIngredients:\n- 6 oz apples\n${header}:\n${instructions}\nNutrition:\nCalories: 120\nProtein: 1g\nCarbs: 28g\nFat: 1g`;

it.each(formats)("normalizes supplied text without inventing steps: %s", format => {
  expect(normalizeRecipeInstructions(format)).toEqual(steps);
  expect(parseUniversalRecipeResponse(text(format)).instructions).toEqual(steps);
});
it.each([
  steps, steps.map((text, i) => ({ step: i + 1, text })),
  steps.map(instruction => ({ instruction })), steps.map(description => ({ description })),
  steps.map(step => ({ step })),
].map(instructions => ({ instructions })))("supports genuine structured instruction arrays: %j", ({ instructions }) => {
  expect(recipeInstructions({ ...draft, instructions })).toEqual(steps);
  expect(() => assertRecipeDraft({ ...draft, instructions })).not.toThrow();
});
it("retains continuation details, temperatures, fractions and decimal quantities", () => {
  expect(normalizeRecipeInstructions(" 1) Add 1.5 cups water.\n Stir for 2 minutes.\n2) Bake at 350 F."))
    .toEqual(["Add 1.5 cups water. Stir for 2 minutes.", "Bake at 350 F."]);
});
it("supports historical cookingInstructions without allowing a bad primary field to bypass privacy", () => {
  expect(recipeInstructions({ ...draft, cookingInstructions: steps })).toEqual(steps);
  expect(parseUniversalRecipeResponse(text(formats[0], "Cooking Instructions")).instructions).toEqual(steps);
  expect(() => assertRecipeDraft({ ...draft, instructions: "USER PROFILE: PRIVATE_SENTINEL", cookingInstructions: steps }))
    .toThrow(SAFE_RECIPE_FAILURE);
});
it.each([undefined, null, "", [], [" "], [{}], [{ step: 1 }], ["123"], ["[step one]"],
  "1.\n2.", ["Bake apples.", {}], "[not valid JSON]",
  ["Prepare all ingredients according to recipe", "Cook using appropriate methods for each ingredient", "Season to taste and serve hot"],
  ["Cook using appropriate methods"], [SAFE_RECIPE_FAILURE],
  "Prepare all ingredients according to recipe. Cook using appropriate methods for each ingredient. Season to taste and serve hot.",
  ["No cooking instructions provided"], ["Cooking instructions are unavailable"],
].map(instructions => ({ instructions })))("does not accept missing, fabricated or malformed instructions: %j", ({ instructions }) => {
  expect(() => assertRecipeDraft({ ...draft, instructions })).toThrow(SAFE_RECIPE_FAILURE);
});
it("rejects refusals and internal prompt echoes in every supported instruction source", () => {
  for (const instructions of [["I'm sorry, I cannot provide that recipe."], [{ text: "COURSE POSITION: PRIVATE_SENTINEL" }]]) {
    expect(() => assertRecipeDraft({ ...draft, instructions })).toThrow(SAFE_RECIPE_FAILURE);
  }
});
it("counts genuine recipes only, never cached success flags or fallback placeholders", () => {
  const good = { ...draft, instructions: steps };
  const bad = { ...good, instructions: [], outcome: "success" };
  const withheld = { ...good, _fallback: true, outcome: "clinical_withheld" };
  expect(gatheringsCourseOutcome(bad)).toBe("incomplete");
  expect(gatheringsCompletion([good, bad, withheld], 3)).toMatchObject({ state: "partial", completed: 1, requested: 3 });
  expect(gatheringsCompletion([bad, bad, withheld], 3)).toMatchObject({ state: "failed", completed: 0 });
  expect(gatheringsCompletion([good, good, good], 3)).toMatchObject({ state: "complete", completed: 3 });
  expect(gatheringsCompletion([good, bad, withheld], 1)).toMatchObject({ state: "partial", completed: 1, requested: 3 });
});
