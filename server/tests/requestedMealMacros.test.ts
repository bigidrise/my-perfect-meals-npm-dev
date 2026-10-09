import {
  resolveRequestedMealMacros,
  buildRequestedMealMacroPrompt,
  validateRequestedMealMacros,
  REQUESTED_MACRO_APPROXIMATION_G,
  extractRequestedMealMacroTargets,
  type RequestedMealMacroTargets,
} from "../services/requestedMealMacros";

describe("Create With Chef requested macro contract", () => {
  it.each([
    ["Steak dinner with potatoes, but keep the starchy carbohydrates at 15 grams", "approximately"],
    ["Cheesecake with no more than 15 grams of starchy carbohydrates per serving", "at_most"],
  ])("extracts the explicit nutrient request from %s", (text, relationship) => {
    expect(extractRequestedMealMacroTargets(text)).toEqual({
      starchy_carbs_g: 15, relationships: { starchy_carbs_g: relationship },
    });
  });
  it.each(["Steak dinner with 15 grams of potatoes", "Reduce starch by 10 grams without changing protein", "I have 10 grams remaining today", "I have 15 grams of starchy carbohydrates left today"])("does not turn %s into an absolute recipe target", text => {
    expect(extractRequestedMealMacroTargets(text)).toBeUndefined();
  });
  it("separates a mentioned daily budget from an actual recipe request", () => {
    expect(extractRequestedMealMacroTargets("I have 10 grams of starch remaining today, but make this dinner with no more than 20 grams of starch")).toEqual({
      starchy_carbs_g: 20, relationships: { starchy_carbs_g: "at_most" },
    });
  });
  it("distinguishes nutrient contribution from food weight and reports uncertainty", () => {
    const prompt = buildRequestedMealMacroPrompt(resolveRequestedMealMacros({ starchy_carbs_g: 15 }));
    expect(prompt).toContain("NOT ingredient weight");
    expect(prompt).toContain("recompute nutrition");
    expect(prompt).toContain("never falsely claim exact compliance");
  });
  it("reuses the existing requested-macro ±5g convention", () => {
    expect(REQUESTED_MACRO_APPROXIMATION_G).toBe(5);
  });

  it.each([undefined, null, {}])("has no instructions or checks without targets: %j", input => {
    const targets = resolveRequestedMealMacros(input as RequestedMealMacroTargets);
    expect(targets).toEqual([]);
    expect(buildRequestedMealMacroPrompt(targets)).toBe("");
    expect(validateRequestedMealMacros({}, targets)).toEqual([]);
  });

  it.each([25, 30, 35])("accepts %ig for an approximately 30g protein request", protein => {
    expect(validateRequestedMealMacros({ protein }, resolveRequestedMealMacros({ protein_g: 30 }))).toEqual([]);
  });

  it.each([24.9, 35.1])("rejects %fg outside the approximate protein tolerance", protein => {
    expect(validateRequestedMealMacros({ protein }, resolveRequestedMealMacros({ protein_g: 30 }))).toHaveLength(1);
  });

  it.each([
    ["at_most", 30, true], ["at_most", 30.01, false],
    ["at_least", 40, true], ["at_least", 39.99, false],
  ] as const)("keeps %s one-sided without approximate tolerance", (relationship, protein, matches) => {
    const target = relationship === "at_most" ? 30 : 40;
    const violations = validateRequestedMealMacros({ protein }, resolveRequestedMealMacros({
      protein_g: target, relationships: { protein_g: relationship },
    }));
    expect(violations.length === 0).toBe(matches);
  });

  it("keeps total carbohydrate, carbohydrate categories, and dietary fiber distinct", () => {
    const targets = resolveRequestedMealMacros({ carbs_g: 25, starchy_carbs_g: 20, fibrous_carbs_g: 5 });
    expect(validateRequestedMealMacros({ carbs: 25, starchyCarbs: 20, fibrousCarbs: 5 }, targets)).toEqual([]);
    expect(validateRequestedMealMacros({ carbs: 40, starchyCarbs: 20, fibrousCarbs: 5 }, targets)).toHaveLength(1);
    const prompt = buildRequestedMealMacroPrompt(targets);
    expect(prompt).toContain("TOTAL carbohydrates");
    expect(prompt).toContain("not dietary fiber");
  });

  it.each([NaN, Infinity, -1, "30", undefined])("does not certify invalid or missing returned protein: %j", protein => {
    expect(validateRequestedMealMacros({ protein }, resolveRequestedMealMacros({ protein_g: 30 }))).toHaveLength(1);
  });

  it.each([
    { protein_g: -1 },
    { protein_g: NaN },
    { protein_g: "30" },
    { carbs_g: Infinity },
    { fiber_g: 25 },
    { protein_g: 30, relationships: { protein_g: "exact" } },
    { relationships: { protein_g: "at_least" } },
    { protein_g: 30, relationships: [] },
    [],
    "30",
  ])("rejects malformed targets rather than silently ignoring the request: %j", input => {
    expect(() => resolveRequestedMealMacros(input as RequestedMealMacroTargets)).toThrow();
  });

  it("does not mutate the supplied targets or relationships", () => {
    const input = Object.freeze({
      protein_g: 40,
      relationships: Object.freeze({ protein_g: "at_least" as const }),
    });
    const targets = resolveRequestedMealMacros(input);
    buildRequestedMealMacroPrompt(targets);
    validateRequestedMealMacros({ protein: 40 }, targets);
    expect(input).toEqual({ protein_g: 40, relationships: { protein_g: "at_least" } });
  });
});