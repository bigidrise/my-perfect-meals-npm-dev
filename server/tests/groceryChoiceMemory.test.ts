import { boundedProductNames, groceryChoiceKey, groceryMemoryPrompt, orderRememberedChoices } from "../services/groceryChoiceMemory";

test("memory keys preserve original food and qualifiers while ignoring quantities and name case", () => {
  expect(groceryChoiceKey(" Olive Oil ")).toBe(groceryChoiceKey("olive oil"));
  expect(groceryChoiceKey("olive oil")).not.toBe(groceryChoiceKey("avocado oil"));
  expect(groceryChoiceKey("tomato sauce")).not.toBe(groceryChoiceKey("tomato sauce", {
    originalName: "tomato sauce", requirements: [{ origin: "explicit_request", value: "low sodium" }],
  }));
  expect(groceryChoiceKey("olive oil", { originalName: "olive oil", requirements: [], matchingName: "olive oil" } as any))
    .toBe(groceryChoiceKey("olive oil"));
});

test("remembered names are bounded, deduplicated and never carry medical clearance", () => {
  expect(boundedProductNames([" A ", "a", "B", "C", "D"])).toEqual(["a", "B", "C"]);
  const prompt = groceryMemoryPrompt({ shownNames: ["A", "B"], preferredName: "A" });
  expect(prompt).toMatch(/CURRENT supplied profile/);
  expect(prompt).toMatch(/never ingredient evidence or medical clearance/);
  expect(prompt).toMatch(/Do not change brands just for variety/);
});

test("usual choices rank first only when the current assessment still returned them", () => {
  const memory = { shownNames: ["A", "B"], preferredName: "B" };
  expect(orderRememberedChoices(["C", "A", "B"], value => value, memory)).toEqual(["B", "A", "C"]);
  expect(orderRememberedChoices(["C"], value => value, memory)).toEqual(["C"]);
  expect(orderRememberedChoices(["C", "A", "B"], value => value, memory, true)).toEqual(["C", "A", "B"]);
  expect(groceryMemoryPrompt(memory, true)).toMatch(/explicitly requested new options/);
});
