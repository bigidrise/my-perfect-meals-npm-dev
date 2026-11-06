import {
  builderMealMacros, summarizeBuilderDay, summarizeBuilderMeals, summarizeBuilderSlots,
  formatBuilderMacro, remainingBuilderMacro,
} from "@/lib/builderMacroCalculation";

const nutrition = { calories: 400, protein: 30, carbs: 30, starchyCarbs: 27, fibrousCarbs: 3, fat: 18 };

describe("read-only Builder serving and carbohydrate contract", () => {
  it("keeps one-serving source-backed nutrition unchanged without mutating the meal", () => {
    const meal = Object.freeze({ servings: 1, nutrition: Object.freeze({ ...nutrition }) });
    expect(builderMealMacros(meal)).toMatchObject({ ...nutrition, estimated: false, uncertainFields: [], unclassifiedCarbs: 0 });
    expect(meal.nutrition).toEqual(nutrition);
  });

  it("normalizes recipe totals exactly once", () => {
    expect(builderMealMacros({ servings: 2, nutrition })).toMatchObject({
      calories: 200, protein: 15, carbs: 15, starchyCarbs: 13.5, fibrousCarbs: 1.5, fat: 9,
    });
  });

  it("uses an explicit partial consumed serving without changing recipe yield", () => {
    expect(builderMealMacros({ servings: 2, consumedServings: 0.5, nutrition })).toMatchObject({
      calories: 100, carbs: 7.5, starchyCarbs: 6.75, fibrousCarbs: 0.75,
    });
    expect(builderMealMacros({ servings: 2, consumedServings: 0, nutrition }).carbs).toBe(0);
  });

  it("does not divide explicitly per-serving nutrition by recipe yield again", () => {
    expect(builderMealMacros({ servings: 4, nutritionBasis: "per-serving", consumedServings: 0.5, nutrition }))
      .toMatchObject({ carbs: 15, starchyCarbs: 13.5, fibrousCarbs: 1.5 });
  });

  it("prefers nested source values over legacy zeros", () => {
    expect(builderMealMacros({ starchyCarbs: 0, fibrousCarbs: 25, nutrition }))
      .toMatchObject({ starchyCarbs: 27, fibrousCarbs: 3 });
  });

  it("preserves genuine nested zero and unclassified carbs instead of inventing a split", () => {
    const result = builderMealMacros({
      starchyCarbs: 20, fibrousCarbs: 20,
      nutrition: { ...nutrition, carbs: 20, starchyCarbs: 0, fibrousCarbs: 0 },
      ingredients: ["rice", "broccoli"],
    });
    expect(result).toMatchObject({ starchyCarbs: 0, fibrousCarbs: 0, unclassifiedCarbs: 20, estimated: false });
  });

  it("uses valid legacy fields only when the nested fields are absent", () => {
    expect(builderMealMacros({ ...nutrition, nutrition: undefined }))
      .toMatchObject({ starchyCarbs: 27, fibrousCarbs: 3 });
    expect(builderMealMacros({ starchyCarbs: 27, fibrousCarbs: 3,
      nutrition: { ...nutrition, starchyCarbs: null, fibrousCarbs: null } }).uncertainFields)
      .toEqual(expect.arrayContaining(["starchyCarbs", "fibrousCarbs"]));
  });

  it("uses only the existing ingredient estimator and clearly labels its output", () => {
    const result = builderMealMacros({
      nutrition: { calories: 200, protein: 10, carbs: 30, fat: 5 },
      ingredients: ["rice", "broccoli"],
    });
    expect(result).toMatchObject({ starchyCarbs: 26, fibrousCarbs: 4, estimated: true, uncertainFields: [] });
  });

  it("does not re-estimate a stored source-backed split from ingredient names", () => {
    expect(builderMealMacros({ nutrition, ingredients: ["broccoli"] }))
      .toMatchObject({ starchyCarbs: 27, fibrousCarbs: 3, estimated: false });
  });

  it("keeps missing or partly known categories incomplete, without subtraction", () => {
    const result = builderMealMacros({
      nutrition: { calories: 200, protein: 10, carbs: 30, starchyCarbs: 20, fat: 5 },
      ingredients: ["rice", "broccoli"],
    });
    expect(result).toMatchObject({ starchyCarbs: 20, fibrousCarbs: 0, unclassifiedCarbs: 10, estimated: false });
    expect(result.uncertainFields).toContain("fibrousCarbs");
    const missing = builderMealMacros({ nutrition: { calories: 200, protein: 10, carbs: 30, fat: 5 } });
    expect(missing.uncertainFields).toEqual(expect.arrayContaining(["starchyCarbs", "fibrousCarbs"]));
  });

  it("reports malformed ingredient evidence as unknown instead of crashing or inventing a split", () => {
    const result = builderMealMacros({
      nutrition: { calories: 100, protein: 10, carbs: 20, fat: 2 }, ingredients: [null],
    });
    expect(result.uncertainFields).toEqual(expect.arrayContaining(["starchyCarbs", "fibrousCarbs"]));
    expect(result.estimated).toBe(false);
  });

  it.each([
    { starchyCarbs: 31, fibrousCarbs: 0 },
    { starchyCarbs: 27, fibrousCarbs: 9 },
    { starchyCarbs: -1, fibrousCarbs: 3 },
  ])("reports irreconcilable split evidence instead of replacing it: %j", split => {
    const result = builderMealMacros({ nutrition: { ...nutrition, ...split }, ingredients: ["rice"] });
    expect(result.uncertainFields).toEqual(expect.arrayContaining(["starchyCarbs", "fibrousCarbs"]));
    expect(result.estimated).toBe(false);
    expect(result.issues).toContain("Stored carbohydrate categories need review");
  });

  it.each([
    { servings: 0 }, { servings: -1 }, { servings: "unknown" },
    { servings: 2, servingCount: 4 }, { servings: 2, consumedServings: -1 },
    { servings: 2, nutritionBasis: "unknown" },
  ])("reports ambiguous serving evidence without inventing precision: %j", metadata => {
    const result = builderMealMacros({ ...metadata, nutrition });
    expect(result.uncertainFields).toHaveLength(6);
    expect(result.issues).toContain("Serving information needs review");
    expect(result.carbs).toBe(0); // known contribution only; the UI marks the total incomplete
  });

  it("counts Meal 4/5/6 and snacks once, including the reported 41g starch case", () => {
    const meal = (starchy: number, fibrous: number) => ({
      servings: 1, nutrition: { ...nutrition, carbs: starchy + fibrous, starchyCarbs: starchy, fibrousCarbs: fibrous },
    });
    const day = {
      breakfast: [meal(3, 5)], lunch: [meal(27, 4)], dinner: [meal(0, 5)],
      meal4: [meal(11, 3)], meal5: [meal(0, 4)], meal6: [meal(0, 4)], snacks: [meal(0, 0)],
    };
    const result = summarizeBuilderDay(day);
    expect(result).toMatchObject({ count: 7, carbs: 66, starchyCarbs: 41, fibrousCarbs: 25 });
    expect(remainingBuilderMacro(37, result.starchyCarbs)).toBe(-4);
    expect(remainingBuilderMacro(64, result.fibrousCarbs)).toBe(39);
    expect(summarizeBuilderSlots(day).meal4.starchyCarbs).toBe(11);
  });

  it("sums unrounded values and reconciles known categories plus unclassified carbs", () => {
    const result = summarizeBuilderMeals([1, 2, 3].map(() => ({
      nutrition: { calories: 1, protein: 0.3, carbs: 0.9, starchyCarbs: 0.3, fibrousCarbs: 0.2, fat: 0 },
    })));
    expect(result.carbs).toBeCloseTo(result.starchyCarbs + result.fibrousCarbs + result.unclassifiedCarbs);
    expect(formatBuilderMacro(result.protein)).toBe("0.9");
    expect(formatBuilderMacro(13.5)).toBe("13.5");
    expect(remainingBuilderMacro(37, 37.25)).toBe(-0.25);
  });
});
